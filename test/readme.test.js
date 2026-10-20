/* Documentation is part of the public behavior. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const core = require('../tone-core.js');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const docs = [read('README.md'), read('README.en.md')];
const headings = [
  ['🌐 デモページ', '📸 スクリーンショット', '✨ 機能', '📖 使い方', '🔬 試験音と判定',
    '🎯 ユースケース', '🌍 ブラウザーごとの違い', '⚠️ 制約と前提', '🔒 プライバシーと安全対策',
    '🔗 関連ツール', '📚 参考文献', '📁 ディレクトリー構造', '💻 動作環境', '📄 ライセンス', '🛠️ このツールについて'],
  ['🌐 Demo', '📸 Screenshots', '✨ Features', '📖 Usage', '🔬 Test tones and classification',
    '🎯 Use cases', '🌍 Browser differences', '⚠️ Limitations and assumptions', '🔒 Privacy and safeguards',
    '🔗 Related tools', '📚 References', '📁 Directory structure', '💻 Requirements', '📄 License', '🛠️ About this tool']
];

test('Readmes retain the ordered bilingual sections and project identity', () => {
  docs.forEach((text, i) => {
    assert.deepEqual([...text.matchAll(/^## (.+)$/gm)].map(match => match[1]), headings[i]);
    assert.equal([...text.matchAll(/^# /gm)].length, 1);
    assert.match(text, /Day119/);
    assert.match(text, /page_id=44607/);
    assert.match(text, /img.shields.io\/github\/license\/ipusiron\/ultrasonic-reach-meter/);
  });
  assert.match(docs[0], /\[English\]\(README.en.md\) · 日本語/);
  assert.match(docs[1], /^English · \[日本語\]\(README.md\)/);
});

test('Related tools sections link only to Day041 with identical repository, demo and Tone Sweep URLs', () => {
  const sectionHeadings = ['🔗 関連ツール', '🔗 Related tools'];
  const expected = [
    'https://github.com/ipusiron/mic-gain-logger',
    'https://ipusiron.github.io/mic-gain-logger/',
      'https://ipusiron.github.io/mic-gain-logger/tone_sweep.html'
  ];
  const links = docs.map((text, i) => {
    const section = text.match(new RegExp(`^## ${sectionHeadings[i]}\\n([\\s\\S]*?)(?=^## )`, 'm'));
    assert.ok(section, sectionHeadings[i]);
    assert.match(section[1], /^### Day041 Mic Gain Logger$/m);
    const urls = [...section[1].matchAll(/\]\((https:\/\/[^)\s]+)\)/g)].map(match => match[1]);
    assert.deepEqual([...urls].sort(), [...expected].sort(), sectionHeadings[i]);
    return urls;
  });
  assert.deepEqual([...links[0]].sort(), [...links[1]].sort());
});

test('Japanese metadata supplies the complete hub entry', () => {
  const metadata = docs[0].match(/^<!--\n---\n([\s\S]*?)\n---\n-->/)[1];
  const fields = Object.fromEntries(metadata.split('\n').map(line => {
    const split = line.indexOf(':');
    return [line.slice(0, split), line.slice(split + 1).trim()];
  }));
  assert.deepEqual(Object.keys(fields).sort(), ['id', 'slug', 'title', 'subtitle_ja', 'subtitle_en',
    'description_ja', 'description_en', 'category_ja', 'category_en', 'difficulty', 'tags',
    'repo_url', 'demo_url', 'hub'].sort());
  assert.equal(fields.id, 'day119');
  assert.equal(fields.slug, 'ultrasonic-reach-meter');
  assert.equal(fields.category_ja, '[プライバシー, 音響監視]');
  assert.equal(fields.category_en, '[Privacy, Acoustic Surveillance]');
  assert.equal(fields.hub, 'true');
  assert.ok(Object.values(fields).every(Boolean));
});

test('Eight captioned screenshots exist as 1280 by 800 PNGs under 300KB', () => {
  const images = docs.map(text => [...text.matchAll(/!\[([^\]]+)\]\((assets\/[^)]+)\)\n\n\*([^\n]+)\*/g)]);
  assert.deepEqual(images.map(list => list.length), [4, 4]);
  const names = new Set();
  for (const [, alt, file, caption] of images.flat()) {
    assert.ok(alt.length > 5 && caption.length > 20);
    assert.equal(names.has(file), false);
    names.add(file);
    const bytes = fs.readFileSync(path.join(root, file));
    assert.equal(bytes.toString('hex', 0, 8), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), 1280);
    assert.equal(bytes.readUInt32BE(20), 800);
    assert.ok(bytes.length <= 300 * 1024);
  }
  assert.match(docs[0], /人の耳を測った結果ではありません/);
  assert.match(docs[1], /not a measurement of a person's hearing/);
});

function actualFiles(directory = root, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === '.git') return [];
    const relative = prefix + entry.name;
    return entry.isDirectory() ? actualFiles(path.join(directory, entry.name), relative + '/') : [relative];
  });
}

function treeFiles(text) {
  const lines = text.match(/```text\n([\s\S]*?)```/)[1].trim().split('\n').slice(1);
  const parents = [];
  const files = [];
  for (const line of lines) {
    const branch = line.search(/[├└]/);
    assert.ok(branch >= 0);
    const depth = branch / 4;
    assert.match(line, / # .+/);
    const name = line.slice(branch + 4).split(' # ')[0].trim();
    parents.length = depth;
    if (name.endsWith('/')) parents.push(name.slice(0, -1));
    else files.push([...parents, name].join('/'));
  }
  return files.sort();
}

test('Both directory trees enumerate the actual public files', () => {
  for (const text of docs) assert.deepEqual(treeFiles(text), actualFiles().sort());
});

test('Browser tables distinguish observation methods and untested devices', () => {
  assert.match(docs[0], /\| 項目 \| Chrome・Vivaldi（Chromium） \| Firefox \| Safari（Mac・iPhone） \| 見分け方 \|/);
  assert.match(docs[1], /\| Item \| Chrome \/ Vivaldi \(Chromium\) \| Firefox \| Safari \(Mac \/ iPhone\) \| How to tell \|/);
  for (const text of docs) {
    for (const term of ['getSettings()', 'WebKit', 'Android', '44100Hz', '48000Hz', 'EC', 'NS', 'AGC']) {
      assert.ok(text.includes(term), term);
    }
  }
  assert.match(docs[0], /スクリーンリーダーの読み上げは未確認/);
  assert.match(docs[1], /Unverified: physical Safari/);
});

test('Published numeric examples agree with core formulas and design limits', () => {
  for (const text of docs) {
    for (const rate of [44100, 48000]) {
      assert.ok(text.includes(`| ${rate}Hz | ${core.upperFrequency(rate)}Hz |`));
      assert.ok(text.includes(`${Number((rate * .417).toFixed(1))}Hz`));
    }
    for (const term of ['8192', '20ms', '−30dBFS', '−12dBFS', '10⁻¹²', '−120dB', '0.5', '+10dB', '+4dB']) {
      assert.ok(text.includes(term), term);
    }
    assert.ok(text.includes('ultrasonic-reach-meter.lang') && text.includes('ultrasonic-reach-meter.theme'));
  }
});

test('F5: bilingual README trial examples reproduce classifications and timings', () => {
  const labels = [{ weak: '弱い', reached: '届いた', absent: '届かない' },
    { weak: 'Weak', reached: 'Reached', absent: 'Not reached' }];
  docs.forEach((text, language) => {
    const examples = [...text.matchAll(/^\| \+([\d.]+)dB \| \+([\d.]+)dB \| ([^|]+) \|$/gm)];
    assert.equal(examples.length, 5);
    for (const [, first, second, label] of examples) {
      assert.equal(label, labels[language][core.classify([Number(first), Number(second)])]);
    }
    const timing = core.timing(48000, 0.02);
    for (const value of [Math.ceil(timing.total), Math.ceil(timing.total / 2), timing.burst.toFixed(3)]) {
      assert.ok(text.includes(String(value)));
    }
  });
});

test('Japanese spacing, limited emphasis and public-source boundaries are preserved', () => {
  const body = docs[0].replace(/^<!--[\s\S]*?-->/, '').replace(/```[\s\S]*?```/g, '');
  assert.doesNotMatch(body, /[\u3040-\u30ff\u3400-\u9fff] +[A-Za-z0-9]|[A-Za-z0-9] +[\u3040-\u30ff\u3400-\u9fff]/);
  for (const text of docs) {
    for (const section of text.split(/^## /m)) assert.ok((section.match(/\*\*[^*]+\*\*/g) || []).length <= 2);
  }
  for (const file of actualFiles().filter(file => /\.(md|js|html|css|yml|json)$/.test(file))) {
    assert.doesNotMatch(read(file), /[CD]:[\\/]|\u6e1a|\u4ed5\u69d8\u66f8|\u8abf\u67fb\u5831\u544a|\u70b9\u691c\u8a18\u9332/, file);
  }
});
