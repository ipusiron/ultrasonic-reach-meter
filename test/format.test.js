'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');

test('Source and tests remain readable without minification', () => {
  const files = [...fs.readdirSync(root).map(file => path.join(root,file)),
    ...fs.readdirSync(__dirname).map(file => path.join(__dirname,file))]
    .filter(file => /\.(js|css|html)$/.test(file));
  assert.ok(files.length >= 12);
  for (const file of files) {
    const limit = file.endsWith('.html') ? 250 : 160;
    const lines = fs.readFileSync(file,'utf8').split('\n');
    lines.forEach((line,i) => assert.ok(line.length <= limit, `${path.basename(file)}:${i+1} (${line.length})`));
  }
  for (const [file,minimum] of Object.entries({
    'tone-core.js':180, 'audio-io.js':220, 'app.js':250, 'messages.js':200, 'style.css':100, 'index.html':300
  })) assert.ok(fs.readFileSync(path.join(root,file),'utf8').split('\n').length >= minimum, file);
});
