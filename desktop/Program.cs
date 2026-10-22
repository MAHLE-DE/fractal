using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Nodes;
using Mahle.Fractal.Data;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Mahle.Fractal.Workspace;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var configIndex = Array.IndexOf(args, "--config");
        var config = configIndex >= 0 && configIndex + 1 < args.Length ? Path.GetFullPath(args[configIndex + 1]) : Path.Combine(AppContext.BaseDirectory, "config", "appsettings.json");
        Application.Run(new WorkspaceWindow(config, args.Contains("--smoke-test")));
    }
}

internal sealed class WorkspaceWindow : Form
{
    private const string Host = "fractal.mahle.invalid";
    private readonly WebView2 _view = new() { Dock = DockStyle.Fill };
    private readonly bool _smokeTest;
    private readonly string _configPath;
    private readonly WorkspaceRepository _repository = null!;
    private readonly string _mode = "production";
    private readonly string? _configurationError;
    private bool _choosing;

    public WorkspaceWindow(string configPath, bool smokeTest)
    {
        _smokeTest = smokeTest; _configPath = configPath;
        try
        {
            if (!File.Exists(configPath)) throw new FileNotFoundException("Configuration not found: " + configPath);
            var config = JsonNode.Parse(File.ReadAllText(configPath))!;
            _mode = config["mode"]?.GetValue<string>() ?? "production";
            if (smokeTest) _mode = "production";
            if (_mode is not ("production" or "demo")) throw new InvalidDataException("mode must be production or demo.");
            var root = config["dataRoot"]?.GetValue<string>() ?? throw new InvalidDataException("Fill in dataRoot in " + configPath);
            if (smokeTest) root = Path.Combine(Path.GetTempPath(), "Fractal-Smoke-" + Guid.NewGuid());
            _repository = new WorkspaceRepository(root, Environment.UserDomainName + "\\" + Environment.UserName);
        }
        catch (Exception e) { _configurationError = e.Message; }
        if (smokeTest) { Opacity = 0; ShowInTaskbar = false; }
        Text = "MAHLE BU2 Workspace · Standards Workspace 0.2.0";
        ClientSize = new Size(1580, 930); MinimumSize = new Size(1060, 720); StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(11, 33, 60);
        var icon = Path.Combine(AppContext.BaseDirectory, "frontend", "assets", "app.ico");
        if (File.Exists(icon)) Icon = new Icon(icon);
        Controls.Add(_view); Shown += async (_, _) => await InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        try
        {
            var content = Path.Combine(AppContext.BaseDirectory, "frontend");
            if (!File.Exists(Path.Combine(content, "index.html"))) throw new FileNotFoundException("Extract the complete package, including frontend/.");
            var cache = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MAHLE", "FractalWorkspace", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: cache);
            await _view.EnsureCoreWebView2Async(environment);
            var core = _view.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false; core.Settings.AreDevToolsEnabled = false; core.Settings.IsStatusBarEnabled = false;
            await core.AddScriptToExecuteOnDocumentCreatedAsync("window.__MAHLE_FRACTAL_HOST__ = true; window.__MAHLE_FRACTAL_DEMO__ = " + (_mode == "demo" ? "true" : "false") + ";");
            core.SetVirtualHostNameToFolderMapping(Host, content, CoreWebView2HostResourceAccessKind.DenyCors);
            core.NavigationStarting += (_, e) => { if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.Host != Host) e.Cancel = true; };
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.AddWebResourceRequestedFilter("https://fractal-data.mahle.invalid/subgroup-image/*", CoreWebView2WebResourceContext.Image);
            core.WebResourceRequested += async (_, e) =>
            {
                using var deferral = e.GetDeferral();
                try
                {
                    var uri = new Uri(e.Request.Uri); var id = uri.AbsolutePath.Split('/').Last();
                    var loaded = await Task.Run(() => { var path = _repository.ResolveImage(id); return (path, bytes: File.ReadAllBytes(path)); });
                    var path = loaded.path; var stream = new MemoryStream(loaded.bytes);
                    e.Response = core.Environment.CreateWebResourceResponse(stream, 200, "OK", "Content-Type: " + (path.EndsWith(".png") ? "image/png" : "image/jpeg") + "\r\nCache-Control: no-cache");
                }
                catch { e.Response = core.Environment.CreateWebResourceResponse(null, 404, "Not found", ""); }
            };
            core.WebMessageReceived += OnMessage;
            if (_smokeTest) await Task.Run(SeedSmokeFixtures);
            if (_smokeTest) core.NavigationCompleted += async (_, _) =>
            {
                for (var i = 0; i < 100; i++)
                {
                    try
                    {
                        var ok = await core.ExecuteScriptAsync("Boolean(window.FractalWorkspace?.ready && !FractalWorkspace.data.preview_only && FractalWorkspace.data.standards.length === 2 && FractalWorkspace.renderer?.root.coverage.minimumEntries === 1 && document.querySelector('.subgroup-photo')?.complete && document.querySelector('.subgroup-photo')?.naturalWidth > 0 && document.querySelector('[data-new-standard]'))");
                        if (ok == "true") { Environment.ExitCode = 0; Close(); return; }
                    }
                    catch { }
                    await Task.Delay(100);
                }
                Environment.ExitCode = 2; Close();
            };
            core.Navigate($"https://{Host}/index.html");
        }
        catch (Exception e)
        {
            if (_smokeTest) { Environment.ExitCode = 1; Close(); return; }
            MessageBox.Show(this, "Standards Workspace could not start.\n\n" + e.Message + "\n\nCheck Microsoft Edge WebView2 Runtime and extract the complete package.", "Standards Workspace", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }

    private void SeedSmokeFixtures()
    {
        // Always runs against the unique --smoke-test temporary root, never dataRoot.
        var snapshot = _repository.Execute("subgroup.save", new() { ["record"] = new JsonObject { ["name"] = "Smoke subgroup", ["description"] = "Isolated native test", ["product_group_ids"] = new JsonArray("FLUID-SYSTEMS-LIQUID"), ["image_path"] = "" } });
        var subgroup = snapshot["subgroups"]!.AsArray()[0]!; var subgroupId = WorkspaceRepository.Text(subgroup, "id");
        _repository.SaveImage(subgroupId, WorkspaceRepository.Text(subgroup,"_etag"), File.ReadAllBytes(Path.Combine(AppContext.BaseDirectory,"frontend","assets","logo.png")), ".png");
        foreach (var code in new[] { "SMOKE-A", "SMOKE-B" }) snapshot = _repository.Execute("standard.save", new() { ["record"] = new JsonObject {
            ["identification"] = new JsonObject { ["document_no"] = code, ["revision_no"] = "1.0", ["title"] = "Native test", ["previous_document_numbers"] = new JsonArray() },
            ["classification"] = new JsonObject { ["origin"] = "international", ["internal_category"] = null, ["organization"] = "ISO" },
            ["applicability"] = new JsonObject { ["product_group_ids"] = new JsonArray(), ["product_subgroup_ids"] = new JsonArray(subgroupId), ["is_general"] = false },
            ["tree_entry"] = new JsonObject { ["family"] = "design", ["strength_level"] = 3 },
            ["document_location"] = new JsonObject { ["file_path"] = null, ["online_url"] = "" }
        } });
        var standards = snapshot["standards"]!.AsArray();
        _repository.Execute("relation.save", new() { ["record"] = new JsonObject { ["source_standard_id"] = WorkspaceRepository.Text(standards[0],"id"), ["target_standard_id"] = WorkspaceRepository.Text(standards[1],"id"), ["strength_level"] = 3 } });
    }

    private async void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string? id = null;
        try
        {
            if (!Uri.TryCreate(e.Source, UriKind.Absolute, out var source) || source.Host != Host || source.Scheme != "https") return;
            var message = JsonNode.Parse(e.WebMessageAsJson)!; id = message["id"]!.GetValue<string>();
            var type = message["type"]!.GetValue<string>(); var payload = message["payload"] as JsonObject ?? new();
            if (_configurationError is not null) throw new WorkspaceException("configuration", _configurationError);
            if (_mode == "demo" && type == "subgroup.selectImage") throw new WorkspaceException("demo", "Demo mode cannot save shared images.");
            object result;
            if (type == "app.environment") result = new { data_root = _repository.Root, config_path = _configPath, mode = _mode, user = Environment.UserName };
            else if (type == "standard.selectFile")
            {
                if (_choosing) throw new WorkspaceException("busy", "A file chooser is already open.");
                _choosing = true;
                try
                {
                    using var chooser = new OpenFileDialog { Title = "Select the current standard document", Filter = "Standard documents (*.pdf;*.doc;*.docx)|*.pdf;*.doc;*.docx", CheckFileExists = true, Multiselect = false };
                    var selected = chooser.ShowDialog(this) == DialogResult.OK;
                    if (selected && !new[] { ".pdf", ".doc", ".docx" }.Contains(Path.GetExtension(chooser.FileName), StringComparer.OrdinalIgnoreCase)) throw new WorkspaceException("invalid_file", "Choose a PDF, DOC or DOCX.");
                    result = new { canceled = !selected, name = selected ? Path.GetFileName(chooser.FileName) : "", path = selected ? chooser.FileName : "" };
                }
                finally { _choosing = false; }
            }
            else if (type == "subgroup.selectImage")
            {
                using var chooser = new OpenFileDialog { Title = "Select subgroup image", Filter = "Images (*.png;*.jpg;*.jpeg)|*.png;*.jpg;*.jpeg", CheckFileExists = true };
                if (chooser.ShowDialog(this) != DialogResult.OK) result = new { canceled = true };
                else
                {
                    var bytes = File.ReadAllBytes(chooser.FileName); if (bytes.Length > 12 * 1024 * 1024) throw new WorkspaceException("invalid_image", "Choose an image smaller than 12 MB.");
                    using var stream = new MemoryStream(bytes); using var image = Image.FromStream(stream);
                    if ((long)image.Width * image.Height > 40000000) throw new WorkspaceException("invalid_image", "This image is too large. Use a smaller image.");
                    var format = image.RawFormat.Guid == System.Drawing.Imaging.ImageFormat.Png.Guid ? ".png" : image.RawFormat.Guid == System.Drawing.Imaging.ImageFormat.Jpeg.Guid ? ".jpg" : throw new WorkspaceException("invalid_image", "Choose PNG or JPEG.");
                    result = await Task.Run(() => _repository.SaveImage(WorkspaceRepository.Text(payload, "id"), WorkspaceRepository.Text(payload, "expected_etag"), bytes, format));
                }
            }
            else if (type is "standard.openFile" or "standard.openLink")
            {
                var snapshot = await Task.Run(() => _repository.Execute("workspace.get"));
                var record = snapshot["standards"]!.AsArray().FirstOrDefault(s => WorkspaceRepository.Text(s, "id") == WorkspaceRepository.Text(payload, "id")) ?? throw new WorkspaceException("not_found", "This standard no longer exists.");
                var target = WorkspaceRepository.Text(record["document_location"], type == "standard.openFile" ? "file_path" : "online_url");
                if (type == "standard.openFile" && !File.Exists(target)) throw new WorkspaceException("missing_file", "Document not found at " + target + ". Use Relocate file to select its new location.");
                if (type == "standard.openLink" && (!Uri.TryCreate(target, UriKind.Absolute, out var url) || url.Scheme is not ("http" or "https"))) throw new WorkspaceException("missing_link", "No valid online link is registered.");
                Process.Start(new ProcessStartInfo(target) { UseShellExecute = true }); result = new { opened = true };
            }
            else if (type == "storage.openFolder") { Directory.CreateDirectory(_repository.Root); Process.Start(new ProcessStartInfo(_repository.Root) { UseShellExecute = true }); result = new { opened = true }; }
            else
            {
                if (_mode == "demo" && type is not ("workspace.get" or "workspace.validate")) throw new WorkspaceException("demo", "Demo mode never saves shared data. Change mode in config/appsettings.json to production.");
                result = await Task.Run(() => _repository.Execute(type, payload));
            }
            Reply(new { id, ok = true, data = result });
        }
        catch (WorkspaceException exception) { Reply(new { id, ok = false, error = new { code = exception.Code, message = exception.Message, details = exception.Details } }); }
        catch (Exception exception) { Reply(new { id, ok = false, error = new { code = "io_error", message = exception.Message } }); }
    }
    private void Reply(object message) { if (!IsDisposed && _view.CoreWebView2 is not null) _view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message)); }
}
