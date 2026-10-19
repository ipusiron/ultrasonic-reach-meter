'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const html = read('index.html');
const dictionary = require('../messages.js');

test('Exact restrictive CSP, referrer and local assets', () => {
  const expected = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; " +
    "base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; connect-src 'none'";
  assert.equal(/http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1], expected);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /rel="icon" href="data:,"/);
  const scripts = [...html.matchAll(/<script src="([^"]+)" defer><\/script>/g)];
  assert.ok(scripts.length >= 3);
  for (const [, file] of scripts) assert.ok(fs.existsSync(path.join(__dirname, '..', file)));
  assert.doesNotMatch(html, /type="module"|\son\w+=|\sstyle=/i);
});

test('Unique IDs, six sections in order, native dialogs and header buttons', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.ok(ids.length > 30);
  assert.equal(ids.length, new Set(ids).size);
  const sections = [...html.matchAll(/<section class="card" aria-labelledby="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(sections, ['before-title', 'environment-title', 'reach-title', 'hearing-title', 'results-title', 'learn-title']);
  assert.equal([...html.matchAll(/class="icon-button"/g)].length, 3);
  assert.match(html, /<dialog id="help-dialog"/);
  assert.match(read('app.js'), /showModal\(\)/);
  assert.match(read('style.css'), /\[hidden\]\s*\{\s*display:\s*none\s*!important/);
});

test('Japanese and English keys match and every static key exists', () => {
  assert.deepEqual(Object.keys(dictionary.ja).sort(), Object.keys(dictionary.en).sort());
  const keys = [...html.matchAll(/data-(?:i18n|label)="([^"]+)"/g)].map(match => match[1]);
  assert.ok(keys.length > 40);
  for (const key of keys) {
    assert.equal(typeof dictionary.ja[key], 'string', key);
    assert.equal(typeof dictionary.en[key], 'string', key);
  }
});

test('Product scripts do not record, transmit, run workers or insert markup', () => {
  const files = fs.readdirSync(path.join(__dirname, '..')).filter(file => file.endsWith('.js'));
  assert.ok(files.length >= 3);
  for (const file of files) {
    assert.doesNotMatch(read(file), /AudioWorklet|ScriptProcessorNode|OscillatorNode|MediaRecorder|\bfetch\s*\(|Worker\s*\(/);
    assert.doesNotMatch(read(file), /innerHTML|outerHTML|insertAdjacentHTML|XMLHttpRequest|WebSocket|sendBeacon/);
    assert.doesNotMatch(read(file), /sessionStorage|indexedDB|document\.cookie|userAgentData/);
  }
});

test('Only explicit display preferences are persisted and output gain is capped', () => {
  const app = read('app.js');
  assert.match(app, /ultrasonic-reach-meter\./);
  const saved = [...app.matchAll(/save\('([^']+)'/g)].map(match => match[1]).sort();
  assert.deepEqual(saved, ['lang', 'theme']);
  assert.match(html, /id="gain"[^>]+max="-12"[^>]+value="-30"/);
});

test('External HTML links are explicitly allowed and isolated', () => {
  const allowed = ['https://github.com/ipusiron/ultrasonic-reach-meter'];
  const links = [...html.matchAll(/<a\b([^>]+)>/g)];
  assert.equal(links.length, allowed.length);
  assert.deepEqual(links.map(([, attrs]) => /href="([^"]+)"/.exec(attrs)[1]).sort(), allowed.sort());
  for (const [, attrs] of links) assert.match(attrs, /rel="noopener noreferrer"/);
});
