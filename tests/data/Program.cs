using System.Diagnostics;
using System.Text.Json.Nodes;
using Mahle.Fractal.Data;

if (args.FirstOrDefault() == "bridge")
{
    var repository = new WorkspaceRepository(args[1], "TEST\\WindowsUser");
    var pdf = Path.Combine(args[1], "test-document.pdf"); Directory.CreateDirectory(args[1]); File.WriteAllText(pdf,"%PDF-1.4 test");
    string? line;
    while ((line = Console.ReadLine()) is not null)
    {
        string? id = null;
        try
        {
            var request = JsonNode.Parse(line)!; id = request["id"]!.GetValue<string>(); var type = request["type"]!.GetValue<string>();
            var payload = request["payload"] as JsonObject ?? new(); object result;
            if (type == "app.environment") result = new { data_root = args[1], config_path = "Test configuration", mode = "production" };
            else if (type == "standard.selectFile") result = new { name = "test-document.pdf", path = pdf, canceled = false };
            else if (type == "subgroup.selectImage") result = repository.SaveImage(WorkspaceRepository.Text(payload,"id"), WorkspaceRepository.Text(payload,"expected_etag"), Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="), ".png");
            else if (type is "standard.openFile" or "standard.openLink") result = new { opened = true };
            else result = repository.Execute(type,payload);
            Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { id, ok = true, data = result }));
        }
        catch(WorkspaceException error) { Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { id, ok=false, error = new { code=error.Code, message=error.Message, details=error.Details } })); }
        catch(Exception error) { Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new { id, ok=false, error = new { code="test_io", message=error.Message } })); }
    }
    return 0;
}

if (args.FirstOrDefault() == "worker")
{
    try
    {
        var repository = new WorkspaceRepository(args[1], args[2]);
        var record = JsonNode.Parse(args[3])!.AsObject();
        repository.Execute("standard.save", new() { ["record"] = record, ["expected_etag"] = args.Length > 4 ? args[4] : "" });
        return 0;
    }
    catch (WorkspaceException e) { Console.WriteLine(e.Code + ": " + e.Message); return e.Code == "conflict" ? 10 : 20; }
}

var testRoot = Path.Combine(Path.GetTempPath(), "Fractal-Data-Tests-" + Guid.NewGuid());
Directory.CreateDirectory(testRoot);
var passed = 0;
void Check(bool value, string message) { if (!value) throw new Exception(message); }
void Test(string name, Action test) { test(); passed++; Console.WriteLine("PASS " + name); }
void Throws(string code, Action action) { try { action(); throw new Exception("Expected " + code); } catch (WorkspaceException e) { Check(e.Code == code, "Expected " + code + "; got " + e.Code + ": " + e.Message); } }
JsonObject Record(string code, string? subgroup = null) => new()
{
    ["identification"] = new JsonObject { ["document_no"] = code, ["title"] = "Test standard " + code, ["revision_no"] = "1.0", ["previous_document_numbers"] = new JsonArray() },
    ["classification"] = new JsonObject { ["origin"] = "international", ["internal_category"] = null, ["organization"] = "ISO" },
    ["applicability"] = new JsonObject { ["product_group_ids"] = new JsonArray(), ["product_subgroup_ids"] = subgroup is null ? new JsonArray() : new JsonArray(subgroup), ["is_general"] = subgroup is null },
    ["tree_entry"] = new JsonObject { ["family"] = "test", ["strength_level"] = 3 },
    ["document_location"] = new JsonObject { ["file_path"] = null, ["online_url"] = "https://example.org/standard" }
};
JsonObject Row(JsonObject snapshot, string key, string? id = null) => snapshot[key]!.AsArray().OfType<JsonObject>().First(r => id is null || WorkspaceRepository.Text(r, "id") == id).DeepClone().AsObject();
JsonObject Save(WorkspaceRepository repository, JsonObject record) => repository.Execute("standard.save", new() { ["record"] = record.DeepClone(), ["expected_etag"] = WorkspaceRepository.Text(record, "_etag") });
Process Worker(string root, string name, JsonObject record, string etag = "")
{
    var info = new ProcessStartInfo(Environment.ProcessPath!) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
    foreach (var argument in new[] { "worker", root, name, record.ToJsonString(), etag }) info.ArgumentList.Add(argument);
    return Process.Start(info)!;
}

try
{
    var root = Path.Combine(testRoot, "main"); var repo = new WorkspaceRepository(root, "DOMAIN\\Editor A");
    var snapshot = repo.Execute("workspace.get");
    Test("new production database is empty, not fictional", () => Check(snapshot["standards"]!.AsArray().Count == 0 && snapshot["taxonomy"]!["product_groups"]!.AsArray().Count == 2, "Unexpected initial records"));
    snapshot = repo.Execute("subgroup.save", new() { ["record"] = new JsonObject { ["name"] = "Oil filtration", ["description"] = "Test subgroup", ["product_group_ids"] = new JsonArray("FLUID-SYSTEMS-LIQUID"), ["image_path"] = "" } });
    var subgroup = Row(snapshot, "subgroups"); var subgroupId = WorkspaceRepository.Text(subgroup, "id");
    snapshot = Save(repo, Record("ISO-ONE", subgroupId)); var first = Row(snapshot, "standards"); var firstId = WorkspaceRepository.Text(first, "id");
    Test("records survive a new repository instance", () => { var saved = new WorkspaceRepository(root, "B").Execute("workspace.get"); Check(Row(saved, "standards")["identification"]!["revision_no"]!.GetValue<string>() == "1.0", "Lost record"); });
    Test("invalid types and unknown subgroup references are rejected without changes", () =>
    {
        var bad = Record("BAD"); bad["identification"]!["revision_no"] = 1; Throws("invalid_schema", () => Save(repo, bad));
        bad = Record("BAD", Guid.NewGuid().ToString()); Throws("invalid_schema", () => Save(repo, bad));
        Check(repo.Execute("workspace.get")["standards"]!.AsArray().Count == 1, "Invalid save mutated database");
    });
    Test("real local document references and renaming keep the permanent identity", () =>
    {
        var file = Path.Combine(testRoot, "document.pdf"); File.WriteAllText(file, "%PDF-1.4 test"); var record = first.DeepClone().AsObject();
        record["classification"]!["origin"] = "internal"; record["classification"]!["internal_category"] = "test"; record["document_location"]!["file_path"] = file;
        record["identification"]!["document_no"] = "MAHLE-NEW-CODE";
        snapshot = Save(repo, record); Check(WorkspaceRepository.Text(Row(snapshot, "standards"), "id") == firstId, "Changed UUID");
        var bad = Record("INTERNAL"); bad["classification"]!["origin"] = "internal"; bad["classification"]!["internal_category"] = "test"; Throws("invalid_schema", () => Save(repo, bad));
    });
    Test("stale edits cannot overwrite another user's saved standard", () =>
    {
        var latest = Row(repo.Execute("workspace.get"), "standards"); latest["identification"]!["title"] = "Editor A saved title"; Save(repo, latest);
        first["identification"]!["title"] = "Editor B stale title"; Throws("conflict", () => Save(repo, first));
        Check(Row(repo.Execute("workspace.get"), "standards")["identification"]!["title"]!.GetValue<string>() == "Editor A saved title", "Stale overwrite");
    });
    Test("separate processes add records concurrently without lost writes", () =>
    {
        using var a = Worker(root, "A", Record("CONCURRENT-A")); using var b = Worker(root, "B", Record("CONCURRENT-B"));
        Check(a.WaitForExit(20000) && b.WaitForExit(20000), "Worker timeout"); Check(a.ExitCode == 0 && b.ExitCode == 0, a.StandardOutput.ReadToEnd() + b.StandardOutput.ReadToEnd());
        Check(repo.Execute("workspace.get")["standards"]!.AsArray().Count == 3, "Lost concurrent creation");
    });
    Test("two processes saving one revision produce exactly one success and one conflict", () =>
    {
        var latest = Row(repo.Execute("workspace.get"), "standards", firstId); var etag = WorkspaceRepository.Text(latest, "_etag");
        var aRecord = latest.DeepClone().AsObject(); aRecord["identification"]!["title"] = "Process A";
        var bRecord = latest.DeepClone().AsObject(); bRecord["identification"]!["title"] = "Process B";
        using var a = Worker(root, "A", aRecord, etag); using var b = Worker(root, "B", bRecord, etag);
        Check(a.WaitForExit(20000) && b.WaitForExit(20000), "Worker timeout"); Check(new[] { a.ExitCode, b.ExitCode }.Order().SequenceEqual(new[] { 0, 10 }), a.StandardOutput.ReadToEnd() + b.StandardOutput.ReadToEnd());
    });
    Test("an external JSON edit invalidates a stale fingerprint even without a revision change", () =>
    {
        var latest = Row(repo.Execute("workspace.get"), "standards", firstId); var path = Path.Combine(root, "standards", firstId + ".json");
        var manual = JsonNode.Parse(File.ReadAllText(path))!; manual["identification"]!["title"] = "External maintenance title"; File.WriteAllText(path, manual.ToJsonString());
        Throws("conflict", () => Save(repo, latest)); Check(File.ReadAllText(path).Contains("External maintenance title"), "External edit lost");
    });
    Test("maintenance blocks writes, validates JSON, and cannot resume over broken references", () =>
    {
        repo.Execute("maintenance.begin"); Throws("maintenance", () => Save(repo, Record("BLOCKED")));
        var path = Path.Combine(root, "relations.json"); var original = File.ReadAllText(path); File.WriteAllText(path, "{\"schema_version\":\"2.0\",\"standard_standard_relations\":[{\"id\":\"" + Guid.NewGuid() + "\",\"source_standard_id\":\"missing\",\"target_standard_id\":\"missing\",\"strength_level\":3}],\"subgroup_standard_relations\":[]}");
        Throws("invalid_schema", () => repo.Execute("maintenance.end")); Check(JsonNode.Parse(File.ReadAllText(Path.Combine(root, "maintenance.json")))!["active"]!.GetValue<bool>(), "Maintenance incorrectly resumed");
        File.WriteAllText(path, original); repo.Execute("maintenance.end");
        File.WriteAllText(path, "{\"a\":1,\"a\":2}"); Throws("invalid_json", () => repo.Execute("workspace.get")); Check(File.ReadAllText(path).Contains("\"a\":2"), "Corrupt JSON overwritten"); File.WriteAllText(path, original);
    });
    Test("relation concurrency merges different additions and requires confirmation for cycles", () =>
    {
        var rows = repo.Execute("workspace.get")["standards"]!.AsArray(); var a = WorkspaceRepository.Text(rows[0], "id"); var b = WorkspaceRepository.Text(rows[1], "id"); var c = WorkspaceRepository.Text(rows[2], "id");
        JsonObject Relation(string source, string target) => new() { ["record"] = new JsonObject { ["source_standard_id"] = source, ["target_standard_id"] = target, ["strength_level"] = 3 } };
        repo.Execute("relation.save", Relation(a,b)); new WorkspaceRepository(root,"B").Execute("relation.save", Relation(b,c));
        var cycle = Relation(c,a); Throws("cycle", () => repo.Execute("relation.save",cycle)); cycle["allow_cycle"] = true; snapshot = repo.Execute("relation.save",cycle);
        Check(snapshot["relations"]!["standard_standard_relations"]!.AsArray().Count == 3, "Lost relations");
    });
    Test("committed multi-file transaction recovers after an interrupted write", () =>
    {
        var crashRoot = Path.Combine(testRoot, "recovery"); var crash = new WorkspaceRepository(crashRoot,"A"); crash.Execute("workspace.get");
        crash.CommitFaultForTest = index => { if(index == 1) throw new IOException("Simulated interruption"); };
        try { crash.Execute("subgroup.save",new() { ["record"] = new JsonObject { ["name"] = "Recovery subgroup", ["description"] = "", ["product_group_ids"] = new JsonArray("FLUID-SYSTEMS-AIR"), ["image_path"] = "" } }); } catch(IOException) { }
        crash = new WorkspaceRepository(crashRoot,"B"); var group = Row(crash.Execute("workspace.get"),"subgroups");
        crash.CommitFaultForTest = index => { if(index == 1) throw new IOException("Simulated two-file interruption"); };
        try { crash.Execute("standard.save",new() { ["record"] = Record("RECOVERED",WorkspaceRepository.Text(group,"id")), ["add_root_references"] = true }); } catch(IOException) { }
        var recovered = new WorkspaceRepository(crashRoot,"C").Execute("workspace.get");
        Check(recovered["standards"]!.AsArray().Count == 1 && recovered["relations"]!["subgroup_standard_relations"]!.AsArray().Count == 1, "Partial transaction");
        Check(Directory.EnumerateDirectories(Path.Combine(crashRoot,"backups")).Any(), "No recoverable backups");
    });
    Test("subgroup image files and stale edits use the same concurrency checks", () =>
    {
        var group = Row(repo.Execute("workspace.get"), "subgroups"); var id = WorkspaceRepository.Text(group,"id");
        repo.SaveImage(id, WorkspaceRepository.Text(group,"_etag"), [1,2,3], ".png");
        Check(File.Exists(repo.ResolveImage(id)),"Image not stored"); Throws("conflict",()=>repo.SaveImage(id, WorkspaceRepository.Text(group,"_etag"),[4,5],".png"));
    });
    Console.WriteLine($"PASS {passed} data checks. Isolated fixtures: {testRoot}");
    return 0;
}
catch(Exception error) { Console.Error.WriteLine(error); Console.Error.WriteLine("Fixtures preserved: " + testRoot); return 1; }
