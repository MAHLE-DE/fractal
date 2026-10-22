using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace Mahle.Fractal.Data;

public sealed class WorkspaceException(string code, string message, JsonNode? details = null) : Exception(message)
{
    public string Code { get; } = code;
    public JsonNode? Details { get; } = details;
}

/// <summary>Cooperating writers serialize short commits. Entity fingerprints detect stale edits,
/// including manually changed JSON. Durable transactions are rolled forward before any read.</summary>
public sealed class WorkspaceRepository
{
    public string Root { get; }
    private readonly string _user;
    private readonly Dictionary<string, string> _observed = new(StringComparer.OrdinalIgnoreCase);
    public Action<int>? CommitFaultForTest { get; set; }
    private static readonly JsonSerializerOptions Pretty = new() { WriteIndented = true };
    private static readonly HashSet<string> Families = ["test", "material", "design", "measurement", "manufacturing"];

    public WorkspaceRepository(string root, string user)
    {
        var expanded = Environment.ExpandEnvironmentVariables(root);
        if (!Path.IsPathFullyQualified(expanded)) throw new ArgumentException("The data folder must be an absolute local or UNC path.");
        Root = Path.GetFullPath(expanded); _user = user;
    }

    public JsonObject Execute(string operation, JsonObject? payload = null) => Locked(() =>
    {
        Initialize(); Recover();
        var p = payload ?? new();
        if (operation is "workspace.get" or "workspace.validate") return Snapshot();
        if (operation == "maintenance.begin") return SetMaintenance(true);
        if (operation == "maintenance.end") { Snapshot(); return SetMaintenance(false); }
        if (Read("maintenance.json")?["active"]?.GetValue<bool>() == true) throw new WorkspaceException("maintenance", "External JSON maintenance is active. Saving is paused for everyone. Your form has been kept.");
        var current = Snapshot(); // Refuse every write while references/schema are invalid.
        return operation switch
        {
            "standard.save" => SaveStandard(p, current),
            "subgroup.save" => SaveSubgroup(p, current),
            "group.save" => SaveGroup(p, current),
            "relation.save" => SaveRelation(p, current, false),
            "root.save" => SaveRelation(p, current, true),
            "relation.delete" => DeleteRelation(p, current, false),
            "root.delete" => DeleteRelation(p, current, true),
            _ => throw new WorkspaceException("unsupported", "Unknown workspace operation.")
        };
    });

    public JsonObject SaveImage(string subgroupId, string expected, byte[] bytes, string extension) => Locked(() =>
    {
        Initialize(); Recover();
        if (Read("maintenance.json")?["active"]?.GetValue<bool>() == true) throw new WorkspaceException("maintenance", "Saving is paused for external JSON maintenance.");
        var snapshot = Snapshot(); var record = Find(snapshot["subgroups"]!.AsArray(), subgroupId);
        Expect(record, expected); var image = "images/" + Id(subgroupId) + "/" + Hash(bytes) + extension;
        var saved = Clean(record); saved["image_path"] = image; Stamp(saved, record);
        Commit(new() { ["subgroups/" + subgroupId + ".json"] = Encode(saved), [image] = bytes });
        return Snapshot();
    });

    public string ResolveImage(string subgroupId)
    {
        return Locked(() => { Initialize(); Recover(); var record = Read("subgroups/" + Id(subgroupId) + ".json"); var relative = Text(record, "image_path"); if (string.IsNullOrEmpty(relative)) throw new FileNotFoundException(); return SafePath(relative); });
    }

    private T Locked<T>(Func<T> action)
    {
        Directory.CreateDirectory(Root); var until = DateTime.UtcNow.AddSeconds(12);
        while (true)
        {
            FileStream gate;
            try { gate = new FileStream(Path.Combine(Root, ".write.lock"), FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None); }
            catch (IOException) { if (DateTime.UtcNow >= until) throw new WorkspaceException("busy", "The shared data folder is busy. No changes were saved; try again shortly."); Thread.Sleep(65); continue; }
            using (gate) { _observed.Clear(); return action(); }
        }
    }

    private void Initialize()
    {
        foreach (var directory in new[] { "standards", "subgroups", "images", ".transactions", "backups" }) Directory.CreateDirectory(Path.Combine(Root, directory));
        var existingRecords = Directory.EnumerateFiles(Path.Combine(Root, "standards"), "*.json").Any() || Directory.EnumerateFiles(Path.Combine(Root, "subgroups"), "*.json").Any();
        if (existingRecords && (!File.Exists(SafePath("groups.json")) || !File.Exists(SafePath("relations.json")))) throw new WorkspaceException("missing_database_file", "groups.json or relations.json is missing from an existing database. Restore it from backup; empty files were not created over your data.");
        if (!File.Exists(SafePath("groups.json"))) WriteAtomic(SafePath("groups.json"), Encode(new JsonObject { ["schema_version"] = "2.0", ["groups"] = new JsonArray(new JsonObject { ["id"] = "FLUID-SYSTEMS-LIQUID", ["name"] = "Fluid Systems Liquid" }, new JsonObject { ["id"] = "FLUID-SYSTEMS-AIR", ["name"] = "Fluid Systems Air" }) }));
        if (!File.Exists(SafePath("relations.json"))) WriteAtomic(SafePath("relations.json"), Encode(new JsonObject { ["schema_version"] = "2.0", ["subgroup_standard_relations"] = new JsonArray(), ["standard_standard_relations"] = new JsonArray() }));
    }

    private JsonObject Snapshot()
    {
        var standards = new JsonArray(); var subgroups = new JsonArray();
        foreach (var (folder, output) in new[] { ("standards", standards), ("subgroups", subgroups) })
            foreach (var file in Directory.EnumerateFiles(Path.Combine(Root, folder), "*.json").Order(StringComparer.Ordinal))
            {
                var relative = folder + "/" + Path.GetFileName(file); var bytes = File.ReadAllBytes(file); var record = Parse(bytes, relative);
                _observed[relative] = Hash(bytes);
                if (Id(Text(record, "id")) + ".json" != Path.GetFileName(file)) Invalid(relative + ": the filename must match its UUID.");
                record["_etag"] = Hash(bytes); output.Add(record);
            }
        var groupsFile = Read("groups.json")!; var groups = Array(groupsFile, "groups"); var relations = Read("relations.json")!;
        if (Text(groupsFile, "schema_version") != "2.0" || Text(relations, "schema_version") != "2.0") Invalid("groups.json and relations.json must use schema_version 2.0.");
        foreach (var r in groups.Concat(Array(relations, "subgroup_standard_relations")).Concat(Array(relations, "standard_standard_relations"))) r!["_etag"] = NodeHash(r);
        var result = new JsonObject { ["schema_version"] = "2.0", ["preview_only"] = false, ["standards"] = standards, ["subgroups"] = subgroups, ["taxonomy"] = new JsonObject { ["product_groups"] = groups.DeepClone() }, ["relations"] = relations, ["maintenance"] = Read("maintenance.json") ?? new JsonObject { ["active"] = false }, ["storage"] = new JsonObject { ["data_root"] = Root, ["windows_user"] = _user } };
        Validate(result);
        foreach (var subgroup in subgroups)
        {
            subgroup!["group"] = string.Join(", ", Array(subgroup, "product_group_ids").Select(id => Text(groups.FirstOrDefault(g => Text(g, "id") == id!.GetValue<string>()), "name")));
            var imagePath = Text(subgroup, "image_path"); subgroup["image_url"] = imagePath.Length == 0 ? "" : "https://fractal-data.mahle.invalid/subgroup-image/" + Text(subgroup, "id") + "?v=" + Uri.EscapeDataString(imagePath);
        }
        result["data_etag"] = NodeHash(result); return result;
    }

    public static void Validate(JsonObject dataset)
    {
        var standards = Array(dataset, "standards"); var subgroups = Array(dataset, "subgroups"); var groups = Array(dataset["taxonomy"], "product_groups");
        var ids = standards.Select(s => Id(Text(s, "id"))).ToHashSet(); var subgroupIds = subgroups.Select(s => Id(Text(s, "id"))).ToHashSet(); var groupIds = groups.Select(g => Required(g, "id")).ToHashSet();
        Unique(groups.Select(g => Required(g, "id")), "Group ID");
        Unique(standards.Select(s => Required(s?["identification"], "document_no")), "Document No"); Unique(subgroups.Select(s => Required(s, "name")), "Subgroup name"); Unique(groups.Select(g => Required(g, "name")), "Group name");
        foreach (var s in standards)
        {
            if (Text(s, "schema_version") != "2.0") Invalid("Standard records must use schema_version 2.0.");
            var label = Text(s?["identification"], "document_no"); Required(s?["identification"], "revision_no"); Required(s?["identification"], "title");
            if (s?["identification"]?["revision_no"] is not JsonValue revision || !revision.TryGetValue<string>(out _)) Invalid(label + ": revision_no must be a string.");
            var origin = Text(s?["classification"], "origin"); if (origin is not ("internal" or "international")) Invalid(label + ": only internal/international standards are supported.");
            Required(s?["classification"], "organization");
            if (origin == "internal" && !Families.Contains(Text(s?["classification"], "internal_category"))) Invalid(label + ": invalid internal category.");
            var file = Text(s?["document_location"], "file_path");
            if (origin == "internal" && file.Length == 0) Invalid(label + ": an internal standard needs a document path.");
            if (file.Length > 0 && (!Path.IsPathFullyQualified(file) || !new[] { ".pdf", ".doc", ".docx" }.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase))) Invalid(label + ": document path must be an absolute PDF, DOC or DOCX path.");
            var url = Text(s?["document_location"], "online_url"); if (url.Length > 0 && (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme is not ("http" or "https"))) Invalid(label + ": online link must start with http:// or https://.");
            foreach (var id in Array(s?["applicability"], "product_group_ids")) if (!groupIds.Contains(id!.GetValue<string>())) Invalid(label + ": unknown product group.");
            foreach (var id in Array(s?["applicability"], "product_subgroup_ids")) if (!subgroupIds.Contains(id!.GetValue<string>())) Invalid(label + ": unknown subgroup.");
            if (!Families.Contains(Text(s?["tree_entry"], "family"))) Invalid(label + ": invalid default tree family.");
            if (s?["applicability"]?["is_general"] is not JsonValue general || !general.TryGetValue<bool>(out _)) Invalid(label + ": is_general must be true or false.");
            if (s?["tree_entry"]?["strength_level"] is not JsonValue entryStrength || !entryStrength.TryGetValue<int>(out var weight) || weight is < 1 or > 3) Invalid(label + ": default strength must be 1, 2 or 3.");
            foreach (var number in Array(s?["identification"], "previous_document_numbers")) if (number is not JsonValue value || !value.TryGetValue<string>(out _)) Invalid(label + ": previous document numbers must be strings.");
        }
        foreach (var s in subgroups)
        {
            if (Text(s, "schema_version") != "2.0") Invalid("Subgroup records must use schema_version 2.0.");
            Required(s, "name"); foreach (var id in Array(s, "product_group_ids")) if (!groupIds.Contains(id!.GetValue<string>())) Invalid(Text(s, "name") + ": unknown group.");
            var image = Text(s, "image_path"); if (image.Length > 0 && !System.Text.RegularExpressions.Regex.IsMatch(image, "^images/[a-f0-9-]{36}/[A-F0-9]{64}\\.(png|jpg)$")) Invalid("Invalid subgroup image path.");
        }
        var relations = dataset["relations"]!;
        foreach (var key in new[] { "subgroup_standard_relations", "standard_standard_relations" })
        {
            var pairs = new HashSet<string>(); var relationIds = new HashSet<string>();
            foreach (var r in Array(relations, key))
            {
                if (!relationIds.Add(Id(Text(r, "id")))) Invalid("Duplicate relation UUID.");
                var target = Text(r, key == "standard_standard_relations" ? "target_standard_id" : "standard_id"); var source = Text(r, key == "standard_standard_relations" ? "source_standard_id" : "subgroup_id");
                if (!ids.Contains(target) || !(key == "standard_standard_relations" ? ids.Contains(source) : subgroupIds.Contains(source))) Invalid("relations.json: a relation refers to a missing standard/subgroup (" + source + " → " + target + ").");
                if (source == target) Invalid("A standard cannot reference itself."); if (!pairs.Add(source + "|" + target)) Invalid("Duplicate source/destination pair in " + key + ".");
                if (r?["strength_level"] is not JsonValue strength || !strength.TryGetValue<int>(out var n) || n is < 1 or > 3) Invalid("Relation strength must be an integer: 1, 2 or 3.");
                if (key == "subgroup_standard_relations")
                {
                    var placement = Text(r, "placement"); var family = Text(r, placement == "island" ? "island" : "branch");
                    if (placement is not ("island" or "radial_branch") || !Families.Contains(family) || (placement == "island") != (family is "measurement" or "manufacturing")) Invalid("Invalid root placement/family.");
                }
            }
        }
    }

    private JsonObject SaveStandard(JsonObject p, JsonObject snapshot)
    {
        var incoming = Clean(p["record"]!); var id = Text(incoming, "id"); var old = id.Length > 0 ? Find(Array(snapshot, "standards"), id) : null;
        if (old is not null) Expect(old, Text(p, "expected_etag")); else incoming["id"] = id = Guid.NewGuid().ToString();
        var location = incoming["document_location"] ??= new JsonObject(); var file = Text(location, "file_path");
        if (file.Length > 0 && (old is null || file != Text(old["document_location"], "file_path")) && !File.Exists(file)) throw new WorkspaceException("missing_file", "The selected document could not be found. Choose its current local/UNC location.");
        location["file_name"] = file.Length == 0 ? null : Path.GetFileName(file); incoming["schema_version"] = "2.0"; Stamp(incoming, old);
        Replace(Array(snapshot, "standards"), incoming); var changes = new Dictionary<string, byte[]> { ["standards/" + id + ".json"] = Encode(incoming) };
        if (p["add_root_references"]?.GetValue<bool>() == true)
        {
            var roots = Array(snapshot["relations"], "subgroup_standard_relations");
            foreach (var subgroup in Array(incoming["applicability"], "product_subgroup_ids"))
                if (!roots.Any(r => Text(r, "subgroup_id") == subgroup!.GetValue<string>() && Text(r, "standard_id") == id)) roots.Add(RootRelation(id, subgroup!.GetValue<string>(), Text(incoming["tree_entry"], "family")));
            changes["relations.json"] = Encode(Clean(snapshot["relations"]!));
        }
        Validate(snapshot); Commit(changes); return Snapshot();
    }

    private JsonObject SaveSubgroup(JsonObject p, JsonObject snapshot)
    {
        var incoming = Clean(p["record"]!); var id = Text(incoming, "id"); var old = id.Length > 0 ? Find(Array(snapshot, "subgroups"), id) : null;
        if (old is not null) { Expect(old, Text(p, "expected_etag")); incoming["image_path"] = Text(old, "image_path"); } else incoming["id"] = id = Guid.NewGuid().ToString();
        incoming["schema_version"] = "2.0"; Stamp(incoming, old); Replace(Array(snapshot, "subgroups"), incoming); Validate(snapshot);
        Commit(new() { ["subgroups/" + id + ".json"] = Encode(incoming) }); return Snapshot();
    }

    private JsonObject SaveGroup(JsonObject p, JsonObject snapshot)
    {
        var groups = Array(snapshot["taxonomy"], "product_groups"); var record = Clean(p["record"]!); var id = Text(record, "id");
        if (id.Length > 0) Expect(Find(groups, id), Text(p, "expected_etag")); else record["id"] = Guid.NewGuid().ToString();
        Required(record, "name"); Replace(groups, record); Validate(snapshot); Commit(new() { ["groups.json"] = Encode(new JsonObject { ["schema_version"] = "2.0", ["groups"] = CleanArray(groups) }) }); return Snapshot();
    }

    private JsonObject SaveRelation(JsonObject p, JsonObject snapshot, bool root)
    {
        var rows = Array(snapshot["relations"], root ? "subgroup_standard_relations" : "standard_standard_relations"); var record = Clean(p["record"]!); var id = Text(record, "id");
        if (id.Length > 0) Expect(Find(rows, id), Text(p, "expected_etag")); else record["id"] = Guid.NewGuid().ToString();
        if (!root && CreatesCycle(rows, Text(record, "source_standard_id"), Text(record, "target_standard_id"), id) && p["allow_cycle"]?.GetValue<bool>() != true) throw new WorkspaceException("cycle", "This connection creates a cycle. It is allowed, but expansion stops at the return. Confirm to keep the reference.");
        Replace(rows, record); Validate(snapshot); Commit(new() { ["relations.json"] = Encode(Clean(snapshot["relations"]!)) }); return Snapshot();
    }

    private JsonObject DeleteRelation(JsonObject p, JsonObject snapshot, bool root)
    {
        var rows = Array(snapshot["relations"], root ? "subgroup_standard_relations" : "standard_standard_relations"); var record = Find(rows, Text(p, "id")); Expect(record, Text(p, "expected_etag")); rows.Remove(record);
        Commit(new() { ["relations.json"] = Encode(Clean(snapshot["relations"]!)) }); return Snapshot();
    }

    private JsonObject SetMaintenance(bool active)
    {
        Commit(new() { ["maintenance.json"] = Encode(new JsonObject { ["active"] = active, ["by"] = _user, ["at_utc"] = DateTimeOffset.UtcNow.ToString("O") }) }); return Snapshot();
    }

    private void Stamp(JsonObject record, JsonNode? old)
    {
        record["record_control"] = new JsonObject { ["revision"] = (old?["record_control"]?["revision"]?.GetValue<int>() ?? 0) + 1, ["created_at"] = Text(old?["record_control"], "created_at") is { Length: > 0 } at ? at : DateTimeOffset.UtcNow.ToString("O"), ["updated_at"] = DateTimeOffset.UtcNow.ToString("O"), ["updated_by"] = _user, ["status"] = "active" };
    }

    private void Commit(Dictionary<string, byte[]> changes)
    {
        var transaction = Path.Combine(Root, ".transactions", Guid.NewGuid().ToString()); Directory.CreateDirectory(transaction); var items = new JsonArray();
        foreach (var (relative, content) in changes)
        {
            var target = SafePath(relative); var staged = Path.Combine(transaction, "after", relative.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(staged)!); Durable(staged, content);
            var before = File.Exists(target) ? File.ReadAllBytes(target) : null;
            if (_observed.TryGetValue(relative, out var observed) && observed != (before is null ? "" : Hash(before))) throw new WorkspaceException("conflict", "A JSON file changed while your save was being prepared. Nothing was committed; your form has been kept.");
            if (before is not null) { var backup = Path.Combine(transaction, "before", relative.Replace('/', Path.DirectorySeparatorChar)); Directory.CreateDirectory(Path.GetDirectoryName(backup)!); Durable(backup, before); }
            items.Add(new JsonObject { ["path"] = relative, ["old_hash"] = before is null ? "" : Hash(before), ["new_hash"] = Hash(content) });
        }
        Durable(Path.Combine(transaction, "manifest.json"), Encode(new JsonObject { ["items"] = items, ["by"] = _user, ["at_utc"] = DateTimeOffset.UtcNow.ToString("O") }));
        Durable(Path.Combine(transaction, "committed"), [1]); ApplyTransaction(transaction, items); Durable(Path.Combine(transaction, "complete"), [1]); Archive(transaction);
    }

    private void Recover()
    {
        foreach (var directory in Directory.EnumerateDirectories(Path.Combine(Root, ".transactions")))
        {
            if (!Guid.TryParse(Path.GetFileName(directory), out _) || !File.Exists(Path.Combine(directory, "committed"))) continue;
            if (File.Exists(Path.Combine(directory, "complete"))) { Archive(directory); continue; }
            var manifest = Parse(File.ReadAllBytes(Path.Combine(directory, "manifest.json")), "transaction manifest"); ApplyTransaction(directory, Array(manifest, "items")); Durable(Path.Combine(directory, "complete"), [1]); Archive(directory);
        }
    }

    private void Archive(string transaction)
    {
        var name = Path.GetFileName(transaction); var source = Path.GetFullPath(transaction); var pending = Path.GetFullPath(Path.Combine(Root, ".transactions")) + Path.DirectorySeparatorChar;
        if (!Guid.TryParseExact(name, "D", out _) || !source.StartsWith(pending, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Unsafe recovery path.");
        var destination = Path.Combine(Root, "backups", name); if (!Directory.Exists(destination)) Directory.Move(source, destination);
    }

    private void ApplyTransaction(string directory, JsonArray items)
    {
        var index = 0;
        foreach (var item in items)
        {
            var relative = Text(item, "path"); var target = SafePath(relative); var bytes = File.ReadAllBytes(Path.Combine(directory, "after", relative.Replace('/', Path.DirectorySeparatorChar)));
            if (Hash(bytes) != Text(item, "new_hash")) throw new WorkspaceException("recovery", "A transaction backup is damaged. No recovery files were removed.");
            var hash = File.Exists(target) ? Hash(File.ReadAllBytes(target)) : "";
            if (hash != Text(item, "new_hash"))
            {
                if (hash != Text(item, "old_hash")) throw new WorkspaceException("recovery_conflict", "An external edit conflicts with a pending transaction. Automatic overwrite was blocked. Preserve .transactions before recovering the shared data.");
                WriteAtomic(target, bytes);
            }
            CommitFaultForTest?.Invoke(++index);
        }
    }

    private string SafePath(string relative)
    {
        relative = relative.Replace('\\', '/');
        var allowed = relative is "groups.json" or "relations.json" or "maintenance.json" || System.Text.RegularExpressions.Regex.IsMatch(relative, "^(standards|subgroups)/[a-f0-9-]{36}\\.json$") || System.Text.RegularExpressions.Regex.IsMatch(relative, "^images/[a-f0-9-]{36}/[A-F0-9]{64}\\.(png|jpg)$");
        if (!allowed) throw new InvalidDataException("Unsupported database path.");
        var absolute = Path.GetFullPath(Path.Combine(Root, relative)); if (!absolute.StartsWith(Root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) throw new InvalidDataException("Path outside the data folder."); return absolute;
    }

    private JsonObject? Read(string relative) { var path = SafePath(relative); if (!File.Exists(path)) return null; var bytes = File.ReadAllBytes(path); _observed[relative] = Hash(bytes); return Parse(bytes, relative); }
    private static JsonObject Parse(byte[] bytes, string source)
    {
        try
        {
            var text = Encoding.UTF8.GetString(bytes).TrimStart('\uFEFF'); using var document = JsonDocument.Parse(text);
            void Check(JsonElement node) { if (node.ValueKind == JsonValueKind.Object) { var names = new HashSet<string>(); foreach (var p in node.EnumerateObject()) { if (!names.Add(p.Name)) throw new JsonException("Duplicate property: " + p.Name); Check(p.Value); } } else if (node.ValueKind == JsonValueKind.Array) foreach (var child in node.EnumerateArray()) Check(child); }
            Check(document.RootElement); return JsonNode.Parse(text)!.AsObject();
        }
        catch (Exception e) when (e is JsonException or InvalidOperationException) { throw new WorkspaceException("invalid_json", source + ": invalid JSON. No data was overwritten. " + e.Message); }
    }
    private static void Durable(string path, byte[] bytes) { using var file = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None); file.Write(bytes); file.Flush(true); }
    private static void WriteAtomic(string target, byte[] bytes) { Directory.CreateDirectory(Path.GetDirectoryName(target)!); var temporary = target + "." + Guid.NewGuid().ToString("N") + ".tmp"; Durable(temporary, bytes); File.Move(temporary, target, true); }
    private static byte[] Encode(JsonNode value) => Encoding.UTF8.GetBytes(value.ToJsonString(Pretty) + "\n");
    private static string Hash(byte[] bytes) => Convert.ToHexString(SHA256.HashData(bytes));
    private static string NodeHash(JsonNode? n) => Hash(Encoding.UTF8.GetBytes(Clean(n!).ToJsonString()));
    private static JsonObject Clean(JsonNode record) { var copy = record.DeepClone().AsObject(); void Strip(JsonNode? node) { if (node is JsonObject obj) { foreach (var key in new[] { "_etag", "image_url", "group", "preview_only" }) obj.Remove(key); foreach (var p in obj.ToArray()) Strip(p.Value); } else if (node is JsonArray arr) foreach (var child in arr) Strip(child); } Strip(copy); return copy; }
    private static JsonArray CleanArray(JsonArray rows) => new(rows.Select(r => (JsonNode)Clean(r!)).ToArray());
    private static JsonArray Array(JsonNode? node, string key) => node?[key] as JsonArray ?? throw new WorkspaceException("invalid_schema", "Required array is missing: " + key);
    public static string Text(JsonNode? node, string key) { var value = node?[key]; if (value is null) return ""; if (value is JsonValue text && text.TryGetValue<string>(out var result)) return result; throw new WorkspaceException("invalid_schema", key + " must be a string."); }
    private static string Required(JsonNode? node, string key) { var s = Text(node, key).Trim(); if (s.Length == 0) Invalid("Required field is missing: " + key); return s; }
    private static string Id(string value) { if (!Guid.TryParseExact(value, "D", out _) || value != value.ToLowerInvariant()) Invalid("Invalid UUID (use lowercase UUID format): " + value); return value; }
    private static void Unique(IEnumerable<string> values, string label) { var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase); foreach (var value in values) if (!set.Add(value)) Invalid("Duplicate " + label + ": " + value); }
    private static void Invalid(string message) => throw new WorkspaceException("invalid_schema", message);
    private static JsonObject Find(JsonArray rows, string id) => rows.OfType<JsonObject>().FirstOrDefault(r => Text(r, "id") == id) ?? throw new WorkspaceException("not_found", "This record no longer exists. Reload the shared data; your entries have been kept.");
    private static void Replace(JsonArray rows, JsonObject record) { var old = rows.FirstOrDefault(r => Text(r, "id") == Text(record, "id")); if (old is not null) rows.Remove(old); rows.Add(record.DeepClone()); }
    private static void Expect(JsonNode record, string expected) { if (expected.Length == 0 || Text(record, "_etag") != expected) throw new WorkspaceException("conflict", "Another user or an external JSON edit changed this record. Your entries have been kept; reload the saved version before trying again.", record.DeepClone()); }
    private static bool CreatesCycle(JsonArray rows, string source, string target, string excluding) { var seen = new HashSet<string>(); bool Visit(string id) { if (id == source) return true; if (!seen.Add(id)) return false; return rows.Any(r => Text(r, "id") != excluding && Text(r, "source_standard_id") == id && Visit(Text(r, "target_standard_id"))); } return Visit(target); }
    private static JsonObject RootRelation(string standard, string subgroup, string family) => new() { ["id"] = Guid.NewGuid().ToString(), ["subgroup_id"] = subgroup, ["standard_id"] = standard, ["placement"] = family is "measurement" or "manufacturing" ? "island" : "radial_branch", [family is "measurement" or "manufacturing" ? "island" : "branch"] = family, ["strength_level"] = 3, ["display_order"] = 1 };
}
