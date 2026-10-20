'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const messages = require('../messages.js');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('Ten collapsed lessons each contain a table and an isolated primary-source link', () => {
  const lessons = [...read('index.html').matchAll(/<details id="lesson-\d+">([\s\S]*?)<\/details>/g)];
  assert.equal(lessons.length, 10);
  for (const [, lesson] of lessons) {
    assert.match(lesson, /<table>/);
    assert.match(lesson, /<caption /);
    assert.match(lesson, /rel="noopener noreferrer"/);
  }
});

test('Functional claims exclude tracking detection, diagnosis and age estimation', () => {
  const files = ['README.md', 'README.en.md'].filter(file => fs.existsSync(path.join(__dirname, '..', file)));
  const copy = [...Object.values(messages.ja), ...Object.values(messages.en), ...files.map(read)].join('\n')
    .replaceAll('追跡されているかを判定するものではありません。', '');
  assert.doesNotMatch(copy, /追跡を検出|追跡されているか|聴力検査|聴力年齢|耳年齢|歳相当/);
  assert.doesNotMatch(copy, /照合|突き合わせ|効く|走る|注目すべきは|ここで重要なのは/);
});

test('English body copy has no untranslated Japanese', () => {
  for (const [key,value] of Object.entries(messages.en)) {
    if (key === 'language') continue;
    assert.doesNotMatch(value, /[\u3040-\u30ff\u3400-\u9fff]/, key);
  }
});

test('Research tables preserve the published reference values in both languages', () => {
  const lee = [['48','83','93'],['63','95','95'],['92','100','—'],['101','—','—']];
  const wang = [['21.7','47.8'],['80.0','92.0'],['97.7','—'],['—','100']];
  for (const language of ['ja','en']) {
    lee.forEach((row,r) => row.forEach((value,c) => assert.equal(messages[language][`lesson6Row${r}Col${c+1}`],value)));
    wang.forEach((row,r) => row.forEach((value,c) => assert.equal(messages[language][`wangRow${r}Col${c+1}`],value)));
    assert.match(messages[language].lesson6Body, /352/);
    assert.match(messages[language].lesson6Body, /162/);
    assert.match(messages[language].receiveFloor, /10⁻¹²/);
    assert.match(messages[language].receiveFloor, /−120dB/);
  }
});
