'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../tone-core.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('index.html');
const app = read('app.js');

function fakeNode(text) {
  let value = text;
  const node = { writes: 0 };
  Object.defineProperty(node, 'textContent', {
    get: () => value,
    set: next => { value = String(next); node.writes++; }
  });
  return node;
}

test('writeText leaves unchanged text alone and reports real writes', () => {
  const node = fakeNode('');
  assert.equal(core.writeText(node, ''), false);
  assert.equal(core.writeText(node, 'Ready'), true);
  assert.equal(core.writeText(node, 'Ready'), false);
  assert.equal(core.writeText(node, 'Ready'), false);
  assert.equal(core.writeText(node, 'Stopped'), true);
  assert.equal(node.writes, 2);
  assert.equal(node.textContent, 'Stopped');
});

test('Live regions are limited to spoken status, alert and hearing text', () => {
  const live = [...html.matchAll(/<(\w+)[^>]*\b(?:role="(?:status|alert)"|aria-live=)[^>]*>/g)]
    .map(match => /\bid="([^"]+)"/.exec(match[0])[1]).sort();
  assert.deepEqual(live, ['error', 'hearing-reference', 'hearing-status', 'status-live']);
  assert.doesNotMatch(html, /<output\b/);
  assert.match(html, /<p id="status" class="readout"><\/p>/);
  assert.match(html, /id="status-live" class="sr-only" role="status"/);
  assert.match(html, /id="gain"[^>]+aria-valuetext=/);
});

test('Live regions are written only through writeText', () => {
  for (const id of ['error', 'hearing-reference', 'hearing-status', 'status-live']) {
    assert.doesNotMatch(app, new RegExp(`\\$\\('${id}'\\)\\.textContent\\s*=`), id);
    assert.match(app, new RegExp(`core\\.writeText\\(\\$\\('${id}'\\)`), id);
  }
});

test('Slider input and measurement steps update visuals without speaking', () => {
  const input = /addEventListener\('input', \(\) => \{([\s\S]*?)\n {2}\}\);/.exec(app)[1];
  assert.match(input, /render\(false\);/);
  assert.doesNotMatch(input, /render\(\)/);
  assert.match(app, /\$\('gain'\)\.addEventListener\('change', \(\) => render\(\)\)/);
  assert.match(app, /setAttribute\('aria-valuetext'/);
  assert.match(app, /statusKey = step\.phase; \}\n\s+render\(false\);/);
  assert.match(app, /silentKeys = new Set\(\['idle', 'quiet', 'tone'\]\)/);
  assert.match(app, /if \(spoken !== errorText && spoken !== hearingText\) core\.writeText\(\$\('status-live'\), spoken\);/);
});
