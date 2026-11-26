using System.Diagnostics;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Bu2.Loom;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var configIndex = Array.IndexOf(args, "--config");
        var config = configIndex >= 0 && configIndex + 1 < args.Length
            ? Path.GetFullPath(args[configIndex + 1])
            : Path.Combine(AppContext.BaseDirectory, "config", "loom.config.json");
        Application.Run(new LoomWindow(config, args.Contains("--smoke-test")));
    }
}

/// <summary>Indice dos documentos fisicos de uma pasta qualquer (com subpastas).</summary>
internal sealed partial class DocumentIndex
{
    private static readonly string[] Extensions = [".pdf", ".docx", ".doc"];
    private readonly List<(string Path, string Name, string Key)> _files = [];
    public string Folder { get; }
    public bool Ready { get; private set; }
    public string? Error { get; private set; }
    public int Count => _files.Count;

    public DocumentIndex(string folder, bool subfolders)
    {
        Folder = folder;
        Task.Run(() =>
        {
            try
            {
                if (!Directory.Exists(folder)) throw new DirectoryNotFoundException("Folder not found: " + folder);
                var options = new EnumerationOptions { RecurseSubdirectories = subfolders, IgnoreInaccessible = true, AttributesToSkip = FileAttributes.System };
                foreach (var path in Directory.EnumerateFiles(folder, "*", options))
                {
                    if (!Extensions.Contains(Path.GetExtension(path), StringComparer.OrdinalIgnoreCase)) continue;
                    var name = Path.GetFileName(path);
                    if (name.StartsWith("~$")) continue; // arquivo temporario do Word
                    _files.Add((path, name, Key(Path.GetFileNameWithoutExtension(path))));
                }
            }
            catch (Exception e) { Error = e.Message; }
            finally { Ready = true; }
        });
    }

    /// <summary>Normaliza para comparar: maiusculas, separadores viram '-'.</summary>
    public static string Key(string text) => "-" + NonAlnum().Replace(text.ToUpperInvariant(), "-").Trim('-') + "-";

    [GeneratedRegex("[^A-Z0-9]+")] private static partial Regex NonAlnum();
    [GeneratedRegex(@"^[SGW]-[A-Z]{1,2}-[A-Z]{2}-\d+", RegexOptions.IgnoreCase)] private static partial Regex OldCode();

    /// <summary>Encontra o arquivo da norma: nome exato do cadastro, codigo antigo, codigo novo ou codigo legado.</summary>
    public (string Path, string Name)? Find(JsonObject request)
    {
        if (!Ready || _files.Count == 0) return null;
        string Text(string k) => request[k]?.GetValue<string>() ?? "";
        var file = Text("file");
        var previous = Text("previous");
        var tokens = new List<(string Token, int Score)>();
        var old = OldCode().Match(previous);
        if (old.Success) tokens.Add((Key(old.Value), 90));
        if (Text("id").Length > 0) tokens.Add((Key(Text("id")), 80));
        foreach (var alias in request["aliases"] as JsonArray ?? [])
            if (alias?.GetValue<string>() is { Length: > 3 } a) tokens.Add((Key(a), 60));

        (string Path, string Name, int Score)? best = null;
        foreach (var f in _files)
        {
            var score = file.Length > 0 && string.Equals(f.Name, file, StringComparison.OrdinalIgnoreCase) ? 100 : 0;
            foreach (var (token, value) in tokens)
                if (value > score && f.Key.Contains(token, StringComparison.Ordinal)) score = value;
            if (score == 0) continue;
            // Desempate: PDF antes de DOCX; nome mais curto (menos "copia", "(1)" etc.).
            var rank = score * 1000 + (f.Path.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) ? 500 : 0) - Math.Min(f.Name.Length, 499);
            if (best is null || rank > best.Value.Score) best = (f.Path, f.Name, rank);
        }
        return best is null ? null : (best.Value.Path, best.Value.Name);
    }
}

internal sealed class LoomWindow : Form
{
    private const string Host = "loom.app.invalid";
    private readonly WebView2 _view = new() { Dock = DockStyle.Fill };
    private readonly bool _smokeTest;
    private readonly string _configPath;
    private readonly DocumentIndex? _documents;
    private readonly string? _configurationError;

    public LoomWindow(string configPath, bool smokeTest)
    {
        _smokeTest = smokeTest;
        _configPath = configPath;
        try
        {
            if (!File.Exists(configPath)) throw new FileNotFoundException("Configuration not found: " + configPath);
            var config = JsonNode.Parse(File.ReadAllText(configPath), documentOptions: new JsonDocumentOptions { AllowTrailingCommas = true, CommentHandling = JsonCommentHandling.Skip })!;
            var folder = config["documentsFolder"]?.GetValue<string>();
            if (string.IsNullOrWhiteSpace(folder)) throw new InvalidDataException("Fill in documentsFolder in " + configPath);
            folder = Environment.ExpandEnvironmentVariables(folder);
            if (!Path.IsPathRooted(folder)) folder = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(configPath)!, folder));
            _documents = new DocumentIndex(folder, config["searchSubfolders"]?.GetValue<bool>() ?? true);
        }
        catch (Exception e) { _configurationError = e.Message; }
        if (smokeTest) { Opacity = 0; ShowInTaskbar = false; }
        Text = "LOOM · Standards Loom";
        ClientSize = new Size(1600, 960);
        MinimumSize = new Size(1100, 720);
        StartPosition = FormStartPosition.CenterScreen;
        WindowState = smokeTest ? FormWindowState.Normal : FormWindowState.Maximized;
        BackColor = Color.FromArgb(11, 18, 32);
        var icon = Path.Combine(AppContext.BaseDirectory, "app.ico");
        if (File.Exists(icon)) Icon = new Icon(icon);
        Controls.Add(_view);
        Shown += async (_, _) => await InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        try
        {
            var content = Path.Combine(AppContext.BaseDirectory, "frontend");
            if (!File.Exists(Path.Combine(content, "index.html"))) throw new FileNotFoundException("Extract the complete package, including frontend/.");
            var cache = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "BU2Loom", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: cache);
            await _view.EnsureCoreWebView2Async(environment);
            var core = _view.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            core.Settings.IsZoomControlEnabled = false;
            core.SetVirtualHostNameToFolderMapping(Host, content, CoreWebView2HostResourceAccessKind.DenyCors);
            core.NavigationStarting += (_, e) =>
            {
                if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.Host != Host) e.Cancel = true;
            };
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.WebMessageReceived += OnMessage;
            if (_smokeTest) core.NavigationCompleted += async (_, _) => await SmokeAsync(core);
            core.Navigate($"https://{Host}/index.html");
        }
        catch (Exception e)
        {
            if (_smokeTest) { Environment.ExitCode = 1; Close(); return; }
            MessageBox.Show(this, "LOOM could not start.\n\n" + e.Message + "\n\nCheck that Microsoft Edge WebView2 Runtime is installed and that the complete package was extracted.",
                "LOOM", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }

    /// <summary>Teste automatico do pacote: interface carregada, dados completos e busca de documento respondendo.</summary>
    private async Task SmokeAsync(CoreWebView2 core)
    {
        for (var i = 0; i < 150; i++)
        {
            try
            {
                var ok = await core.ExecuteScriptAsync("Boolean(window.cascade && window.cascade.nodes.length > 1000 && window.chrome && window.chrome.webview)");
                if (ok == "true" && (_documents?.Ready ?? true))
                {
                    var report = Path.Combine(Path.GetTempPath(), "loom-smoke.json");
                    await core.ExecuteScriptAsync("window.cascade.hostCall('documents.find', {id:'DSGN-348', previous:'S-G-DN-5001-en', file:'', aliases:[]}).then(r => window.__smoke = JSON.stringify(r), e => window.__smoke = 'ERR ' + e.message)");
                    for (var j = 0; j < 50; j++)
                    {
                        var result = await core.ExecuteScriptAsync("window.__smoke || ''");
                        if (result != "\"\"") { File.WriteAllText(report, JsonSerializer.Deserialize<string>(result) ?? ""); break; }
                        await Task.Delay(100);
                    }
                    Environment.ExitCode = 0;
                    Close();
                    return;
                }
            }
            catch { }
            await Task.Delay(100);
        }
        Environment.ExitCode = 2;
        Close();
    }

    private void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string? id = null;
        try
        {
            if (!Uri.TryCreate(e.Source, UriKind.Absolute, out var source) || source.Host != Host || source.Scheme != "https") return;
            var message = JsonNode.Parse(e.WebMessageAsJson)!;
            id = message["id"]!.GetValue<string>();
            var type = message["type"]!.GetValue<string>();
            var payload = message["payload"] as JsonObject ?? new();
            object result;
            if (type == "app.info")
                result = new { config_path = _configPath, folder = _documents?.Folder, ready = _documents?.Ready, count = _documents?.Count, error = _configurationError ?? _documents?.Error };
            else if (type is "documents.find" or "documents.open")
            {
                if (_configurationError is not null)
                    result = new { found = false, ready = true, message = "Check config/loom.config.json: " + _configurationError };
                else if (!_documents!.Ready)
                    result = new { found = false, ready = false, message = "Indexing " + _documents.Folder };
                else if (_documents.Error is not null)
                    result = new { found = false, ready = true, message = _documents.Error + " (config/loom.config.json)" };
                else
                {
                    var hit = _documents.Find(payload);
                    if (hit is null)
                        result = new { found = false, ready = true, message = "Not found in " + _documents.Folder };
                    else
                    {
                        if (type == "documents.open") Process.Start(new ProcessStartInfo(hit.Value.Path) { UseShellExecute = true });
                        result = new { found = true, ready = true, name = hit.Value.Name, path = hit.Value.Path };
                    }
                }
            }
            else throw new InvalidOperationException("Unknown request: " + type);
            Reply(new { id, ok = true, data = result });
        }
        catch (Exception exception) { Reply(new { id, ok = false, error = new { message = exception.Message } }); }
    }

    private void Reply(object message)
    {
        if (!IsDisposed && _view.CoreWebView2 is not null) _view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message));
    }
}
