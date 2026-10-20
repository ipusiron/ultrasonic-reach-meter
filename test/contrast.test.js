'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
function luminance(hex) {
  const rgb = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
const blocks = [...css.matchAll(/:root(?:\[data-theme="light"\])?\s*\{([^}]+)\}/g)];
assert.equal(blocks.length, 2);
for (const [index, [, block]] of blocks.entries()) {
  const colors = Object.fromEntries([...block.matchAll(/--([\w]+):\s*(#[\da-f]{6})/g)].map(m => [m[1], m[2]]));
  for (const foreground of ['fg', 'muted', 'accent', 'good', 'warn', 'border', 'focus']) {
    test(`Theme ${index}: ${foreground} contrast on background and cards`, () => {
      for (const background of ['bg', 'surface']) {
        const a = luminance(colors[foreground]);
        const b = luminance(colors[background]);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        assert.ok(ratio >= (['border', 'focus'].includes(foreground) ? 3 : 4.5), `${foreground}: ${ratio}`);
      }
    });
  }
}
