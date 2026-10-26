'use strict';
const fs = require('node:fs'), path = require('node:path');

// Read only JSON, including the JSON assignment used for offline file:// pages.
// Never evaluate the supplied JavaScript snapshot.
function readVisualSnapshot(source, project = path.resolve(__dirname, '..')) {
  let input = source && path.resolve(source);
  if (!input) {
    const qa = path.join(project, 'artifacts/qa');
    const latest = fs.existsSync(qa) ? fs.readdirSync(qa).filter(n => n.startsWith('real-data-') && fs.existsSync(path.join(qa, n, 'snapshot.json'))).sort().at(-1) : null;
    input = latest ? path.join(qa, latest) : path.join(project, 'html-preview');
  }
  const files = fs.existsSync(input) && fs.statSync(input).isFile() ? [input] : [path.join(input, 'snapshot.json'), path.join(input, 'data/workspace-snapshot.js')];
  const filename = files.find(f => fs.existsSync(f));
  if (!filename) throw Error('No snapshot found. Pass a validated snapshot folder or the published html-preview folder.');
  const text = fs.readFileSync(filename, 'utf8'); let snapshot;
  if (filename.endsWith('.json')) snapshot = JSON.parse(text);
  else {
    const prefix = 'window.FractalVisualSnapshot = ', start = text.indexOf(prefix);
    if (start < 0) throw Error('Unsupported visual snapshot format.');
    snapshot = JSON.parse(text.slice(start + prefix.length).trim().replace(/;\s*$/, ''));
  }
  if (!Array.isArray(snapshot.standards) || !Array.isArray(snapshot.subgroups) || !Array.isArray(snapshot.relations?.standard_standard_relations)) throw Error('Invalid workspace snapshot.');
  return { input: path.dirname(filename), snapshot, snapshotText: JSON.stringify(snapshot) };
}
module.exports = { readVisualSnapshot };
