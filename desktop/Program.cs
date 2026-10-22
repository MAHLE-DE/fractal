using System.Text.Json;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Mahle.Fractal.Preview;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new PreviewWindow(args.Contains("--smoke-test")));
    }
}

// A thin, replaceable host. This visual milestone deliberately has no repository
// and no shared-folder access. Future integration can reuse the frontend intact.
internal sealed class PreviewWindow : Form
{
    private const string Host = "fractal.mahle.invalid";
    private readonly WebView2 _view = new() { Dock = DockStyle.Fill };
    private readonly bool _smokeTest;

    public PreviewWindow(bool smokeTest = false)
    {
        _smokeTest = smokeTest;
        if (smokeTest) { Opacity = 0; ShowInTaskbar = false; }
        Text = "MAHLE BU2 Workspace · Standards — Visual Preview 0.1.0";
        ClientSize = new Size(1580, 930);
        MinimumSize = new Size(1060, 720);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(11, 33, 60);
        var icon = Path.Combine(AppContext.BaseDirectory, "frontend", "assets", "app.ico");
        if (File.Exists(icon)) Icon = new Icon(icon);
        Controls.Add(_view);
        Shown += async (_, _) => await InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        try
        {
            var content = Path.Combine(AppContext.BaseDirectory, "frontend");
            if (!File.Exists(Path.Combine(content, "index.html"))) throw new FileNotFoundException("Extract the complete preview package, including the frontend folder.");
            var cache = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "MAHLE", "FractalPreview", "WebView2");
            var environment = await CoreWebView2Environment.CreateAsync(userDataFolder: cache);
            await _view.EnsureCoreWebView2Async(environment);
            var core = _view.CoreWebView2;
            core.Settings.AreDefaultContextMenusEnabled = false;
            core.Settings.AreDevToolsEnabled = false;
            core.Settings.IsStatusBarEnabled = false;
            await core.AddScriptToExecuteOnDocumentCreatedAsync("window.__MAHLE_FRACTAL_HOST__ = true;");
            core.SetVirtualHostNameToFolderMapping(Host, content, CoreWebView2HostResourceAccessKind.DenyCors);
            core.NavigationStarting += (_, e) => { if (!Uri.TryCreate(e.Uri, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.Host != Host) e.Cancel = true; };
            core.NewWindowRequested += (_, e) => e.Handled = true;
            core.WebMessageReceived += OnMessage;
            if (_smokeTest) core.NavigationCompleted += async (_, args) =>
            {
                try
                {
                    var result = await core.ExecuteScriptAsync("Boolean(window.__MAHLE_FRACTAL_HOST__ && window.FractalWorkspace && FractalWorkspace.data.preview_only && FractalWorkspace.data.standards.length === 104 && FractalWorkspace.renderer.nodes.length > 100 && document.querySelector('[data-new-standard]'))");
                    Environment.ExitCode = args.IsSuccess && result == "true" ? 0 : 2;
                }
                catch { Environment.ExitCode = 3; }
                finally { Close(); }
            };
            core.Navigate($"https://{Host}/index.html");
        }
        catch (Exception e)
        {
            if (_smokeTest) { Environment.ExitCode = 1; Close(); return; }
            MessageBox.Show(this, "The visual preview could not start.\n\n" + e.Message + "\n\nInstall Microsoft Edge WebView2 Runtime if it is missing. The HTML preview can also be opened directly in Edge.", "Standards visual preview", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }

    private void OnMessage(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string? id = null;
        try
        {
            if (!Uri.TryCreate(e.Source, UriKind.Absolute, out var source) || source.Host != Host || source.Scheme != "https") return;
            using var message = JsonDocument.Parse(e.WebMessageAsJson);
            id = message.RootElement.GetProperty("id").GetString();
            var type = message.RootElement.GetProperty("type").GetString();
            if (type != "standard.selectFile") throw new InvalidOperationException("This visual preview does not expose a database or arbitrary file operations.");
            using var chooser = new OpenFileDialog { Title = "Select the current standard document", Filter = "Standard documents (*.pdf;*.doc;*.docx)|*.pdf;*.doc;*.docx", CheckFileExists = true, Multiselect = false };
            var selected = chooser.ShowDialog(this) == DialogResult.OK;
            if (selected && !new[] { ".pdf", ".doc", ".docx" }.Contains(Path.GetExtension(chooser.FileName), StringComparer.OrdinalIgnoreCase)) throw new InvalidOperationException("Choose a PDF, DOC or DOCX document.");
            object result = selected
                ? new { canceled = false, name = Path.GetFileName(chooser.FileName), path = chooser.FileName }
                : new { canceled = true, name = "", path = "" };
            Reply(new { id, ok = true, data = result });
        }
        catch (Exception exception) { Reply(new { id, ok = false, error = exception.Message }); }
    }

    private void Reply(object message) => _view.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(message));
}
