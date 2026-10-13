// Bundles the content scripts into one userscript for Safari (Mac + iPhone)
// via the free "Userscripts" app. Output: dist/mrfantastic.user.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));

const header = [
  '// ==UserScript==',
  '// @name        mrfantastic',
  `// @version     ${manifest.version}`,
  `// @description ${manifest.description}`,
  ...manifest.content_scripts.flatMap((cs) => cs.matches.map((m) => `// @match       ${m}`)),
  '// @run-at      document-start',
  '// @inject-into content',
  '// ==/UserScript==',
  '',
].join('\n');

// One file per unique script, in manifest order.
const files = [...new Set(manifest.content_scripts.flatMap((cs) => cs.js))];
const body = files
  .map((f) => `// --- ${f} ---\n` + fs.readFileSync(path.join(root, f), 'utf8'))
  .join('\n');

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist', 'mrfantastic.user.js'), header + body);
console.log('wrote dist/mrfantastic.user.js');
