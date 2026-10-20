<!--
---
id: day119
slug: ultrasonic-reach-meter
title: "Ultrasonic Reach Meter"
subtitle_ja: "端末の到達と耳の上限を分けて確かめる"
subtitle_en: "Separate device reach from your hearing limit"
description_ja: "スピーカーとマイクの14〜21.5kHzでの到達と、自分の耳で聞こえた最高周波数を分けて確かめる教材"
description_en: "Explore speaker-to-microphone reach at 14–21.5kHz separately from the highest frequency you hear"
category_ja: [プライバシー, 音響監視]
category_en: [Privacy, Acoustic Surveillance]
difficulty: 2
tags: [ultrasound, privacy, web-audio, microphone, hearing, offline]
repo_url: "https://github.com/ipusiron/ultrasonic-reach-meter"
demo_url: "https://ipusiron.github.io/ultrasonic-reach-meter/"
hub: true
---
-->

# Ultrasonic Reach Meter - 端末の到達と耳の上限を分けて確かめる

![GitHub Repo stars](https://img.shields.io/github/stars/ipusiron/ultrasonic-reach-meter?style=social)
![GitHub forks](https://img.shields.io/github/forks/ipusiron/ultrasonic-reach-meter?style=social)
![GitHub last commit](https://img.shields.io/github/last-commit/ipusiron/ultrasonic-reach-meter)
![GitHub license](https://img.shields.io/github/license/ipusiron/ultrasonic-reach-meter)
[![GitHub Pages](https://img.shields.io/badge/demo-GitHub%20Pages-blue?logo=github)](https://ipusiron.github.io/ultrasonic-reach-meter/)

**Day119 - 生成AIで作るセキュリティツール200**

[English](README.en.md) · 日本語

Ultrasonic Reach Meterは、自分の端末のスピーカーとマイクが超音波の近くの帯域（14〜21.5kHz）をどこまで出して拾えるかと、自分の耳がどこまで聞こえるかを、分けて確かめる学習ツールです。

聞こえない音でも、端末は出して拾えることがあります。端末の到達を先に調べ、同じ周波数での耳の回答を並べると、端末では届いていたのか、端末の出力・入力のどこかで届かなかったのかを考えられます。超音波ビーコンが使う18〜20kHzの帯域を学ぶ入口になります。

## 🌐 デモページ

👉 **[Ultrasonic Reach Meterを開く](https://ipusiron.github.io/ultrasonic-reach-meter/)**

ダウンロードした`index.html`をブラウザーで開くと、file://でも使えます。マイクの利用可否はブラウザーと許可設定によります。iPhoneではHTTPSの公開ページを使ってください。インストールとビルドは不要です。

## 📸 スクリーンショット

![この環境のサンプルレートと音の加工](assets/environment.png)

*WindowsのヘッドレスChromiumに合成WAVを入力した表示です。AudioContextは48000Hz、上限は21.5kHz、音の加工3項目はオフです。実機のスピーカーとマイクの測定値ではありません。*

![拾うだけの高域の判定](assets/reach.png)

*合成WAVに含めた18〜20kHzは「届いた」、含めていない20.5〜21.5kHzは「届かない」と表示されています。各行の差は、FFTのパワーから求めた相対値です。*

![耳の上限の回答と端末の結果](assets/hearing.png)

*操作例として14kHzまで「聞こえた」、15・16kHzで「聞こえない」、確認の14kHzで「聞こえた」を選びました。人の耳を測った結果ではありません。「拾うだけ」の値と耳の回答は別の条件として表示します。*

## ✨ 機能

| 節 | 内容 |
|---|---|
| 1. 始める前に | 音量と使用場所の注意、初期−30dBFS・上限−12dBFSのゲイン |
| 2. この環境 | AudioContextのsampleRate、上限周波数、エコーキャンセル・ノイズ抑制・自動ゲインの実値 |
| 3. 端末の到達 | 両方・出すだけ・拾うだけの3役、周波数ごとの棒と判定 |
| 4. 耳の上限 | 聞こえた／聞こえない、各段で1回だけ再生し直せる操作 |
| 5. 結果 | 周波数ごとの端末の結果と耳の回答、条件に応じた読み取り |
| 6. 座学 | 超音波ビーコン、MFSK、端末の帯域、年齢別の研究上の参考値など10節と一次資料 |

日本語・英語、明暗の表示を切り替えられます。言語を変えても測定結果と回答の位置は保ちます。初期表示は青焼きのダーク配色です。見出し右の「?」でヘルプを開き、Escで閉じられます。

## 📖 使い方

まずは1台で「出して拾う（両方）」を終えてから、「耳の上限」へ進む手順が手軽です。ヘルプには、両方、出すだけ、拾うだけの3つのSVG図があります。2台で使う場合も、この端末と相手の端末の役割を確認できます。

1. 周りの人やペットがいない場所で、端末の音量を小さくする。スピーカーを耳に近づけない
2. 1台で確かめるときは「両方」を選び、「測る」を押す。マイクの使用を許可し、「この環境」の実値を読む
3. 1kHzの自己点検から高域へ進む。自己点検で「届かない」なら停止するので、音量・出力先・マイクの許可・音の加工を確かめる
4. 端末の到達が終わったら「耳の上限」を始め、各段で聞こえたかを回答する。「もう一度」は各段で1回まで。2段続けて聞こえなければ上りを終え、最後に聞こえた最高の段を確認する
5. 結果の表を読む。音量を変えた場合や上限に近い帯域は参考値として扱う

2台で使う場合は、PCを「出すだけ」、iPhoneなどの受信側を「拾うだけ」にします。スピーカーとマイクを正面10cm前後に置き、受信側を始めてからPCを始めてください。「拾うだけ」は60秒で終了します。送信側の階段が60秒を超える環境では、全段を含められない場合があります。受信側での到達は、そのPCからその受信側までの条件を表します。

「両方」は2回の独立した測定を行います。48kHzの確認環境では約79秒、「出すだけ」は約38秒でした。所要時間はsampleRate・出力遅延・描画の遅れで変わり、画面には推定時間を出します。

## 🔬 試験音と判定

試験音は整数Hzの正弦波1秒分をAudioBufferに計算し、ループして短く鳴らします。前後20msの直線ランプを付けます。耳の試験音は1.5秒です。端末の試験音は、出力遅延を待ってから独立した8フレームを取れる長さにします。

| sampleRate | 出力する上限 | 参考値の境界 |
|---|---|---|
| 44100Hz | 19500Hz | 18389.7Hzより上 |
| 48000Hz | 21500Hz | 20016Hzより上 |

上限は`min(21500, floor(0.45 × sampleRate / 500) × 500)`Hzです。`0.417 × sampleRate`より上には参考値の印を付けます。上限を超える段は鳴らしません。端末の階段は1・14・15・16・17・18・18.5・19・19.5・20・20.5・21・21.5kHzです。

AnalyserNodeはfftSize＝8192、smoothingTimeConstant＝0です。読む間隔は`max(171ms, ceil(8192 / sampleRate × 1000)ms)`とし、48kHzでは171ms、44.1kHzでは186msです。対象ビン±2の最大パワーを取り、8フレームの線形パワーを平均します。dB値をそのまま平均しません。

| 役割 | 判定 |
|---|---|
| 両方 | 直前の無音8フレームと発音中8フレームの差。独立した2回が続けて+10dB以上なら「届いた」、最大差が+4dB以上なら「弱い」、それ未満は「届かない」 |
| 出すだけ | 周波数の表示と短い発音。マイクを開かず、到達は判定しない |
| 拾うだけ | 60秒の各帯域の時間中央値を暗騒音とし、8フレーム移動平均を比較。+10dBを超えた評価時点が0.5秒以上離れて2回あれば「届いた」。同じ発音内でもよい |

「拾うだけ」では、信号と暗騒音のパワーをそれぞれ最低10⁻¹²（FFT値で−120dB）としてから比を取ります。極小の成分同士の比だけで「届いた」になることを防ぐ設計値です。合成入力で、含めていない21.5kHzが約−173dBの暗騒音に対して+15.1dBになる例を確認したため加えました。音圧の校正値ではなく、微弱な信号を拾いにくくなる場合があります。「両方」の判定にはこの下限を適用しません。

耳の結果は「この端末とこの音量で聞こえた最高周波数」です。最後の確認で聞こえなければ確定しません。途中でゲインを変えた場合、端末測定とsampleRateやゲインが違う場合、参考帯域の場合は読み取りを参考扱いにします。

## 🎯 ユースケース

このツールならではの使い方として、次の4例を試せます。

- 18・19・20kHzの端末の到達と耳の回答を並べ、聞こえない音を端末が拾える条件を考える
- PCのスピーカーから別の端末へ音を出し、正面10cm前後で「出すだけ」と「拾うだけ」を組み合わせて入力側の帯域を調べる
- 44.1kHzでは19.5kHz、48kHzでは21.5kHzになる上限を読み、サンプルレートが試せる帯域を変える理由を学ぶ
- エコーキャンセルとノイズ抑制の実値と到達を並べ、周波数の差が耳だけで決まらないことを説明する

授業では、座学のMFSKの表を使って周波数と記号の対応を説明できます。長い時間の音の変化を記録したい場合は、関連ツールのMic Gain Loggerへ進めます。

## 🌍 ブラウザーごとの違い

ブラウザー名で処理を分岐しません。機能の有無を確かめ、取得したsampleRateとgetSettings()の実値に従います。表のSafari・実機に関する記述は文献と既存の報告に基づき、このツールでの実機確認とは分けています。

| 項目 | Chrome・Vivaldi（Chromium） | Firefox | Safari（Mac・iPhone） | 見分け方 |
|---|---|---|---|---|
| sampleRate | 出力機器しだい。強制指定しない | 同左。マイクとのレート不一致で接続を拒否する版がある | 機器と音声経路しだい。切り替わる報告あり | `ctx.sampleRate`の実値 |
| 試験音 | OscillatorNodeでは高域が減衰するためAudioBuffer | ナイキスト超過の折り返しを避け、計算した上限を守る | 同じAudioBuffer方式 | 実レートから作る階段 |
| 加工を切れるか | EC・NS・AGCのfalseを要求。実値は別に確認 | 対応する制約を要求し、報告された値を表示 | ECだけ報告する例あり。NS・AGCは「報告なし」になり得る | `getSettings()`のオン／オフ／報告なし |
| 加工が残る場合 | ECかNSがオンだと高域が失われる場合あり | 入力と設定しだい | 高域が届かない過去の報告あり | 警告、1kHz自己点検、階段の結果 |
| file://とマイク | 自動試験では利用可 | 自動試験で機能の存在を確認 | 実機未確認。iPhoneはHTTPSを推奨 | `navigator.mediaDevices`と許可結果 |
| 開始の操作 | ボタンの押下 | 同左 | 同左 | AudioContextの状態 |
| マナーモード・音声経路 | 出力先に依存 | 出力先に依存 | audioSessionがあれば、マイク使用時はplay-and-record、それ以外はplayback | `navigator.audioSession`の有無 |
| マイク使用中の出力 | 機器と経路に依存 | 同左 | 音質の低下や受話口への切り替えの報告あり | 自己点検と実際の出力先 |
| Bluetooth | ヘッドセットのマイクで帯域が狭まる場合あり | 同左 | 同左 | 接続先と自己点検 |

iPhoneのChromeもWebKitを使うため、Safariと同じ音声経路の制約に注意してください。Safariの「報告なし」はオフと同じ意味ではありません。ECまたはNSがオンなら、開始前に警告して続行か中止を選べます。

確認済みの範囲は、Windows上のPlaywrightによるChromium・Firefox・WebKitの配置、HTTPとfile://、日本語と英語、幅320〜1280pxです。音の通し確認はヘッドレスChromiumと合成WAVで行いました。Firefoxでは実レートと上限を確認しました。Windows版WebKitは音声APIがないポートであり、Safariの実機の代わりにはなりません。

Safariの実機（Mac・iPhone）、Chrome・Vivaldiの実機のスピーカーとマイク、Android、スクリーンリーダーの読み上げは未確認です。合成入力ではマイクが44100Hz、AudioContextが48000Hzと報告されました。入力のレートも加工も、要求がそのまま採用されるとは限りません。

## ⚠️ 制約と前提

- 医療の検査ではなく、周波数から年齢を推定しない。端末も音量も校正されていない
- 追跡されているかを判定するものではありません。アプリの反応、ビーコンの内容や送信元も判定しない
- 端末の「届かない」は、スピーカー・マイク・音の加工・距離などのどこが原因かを分離しない
- 拾うだけでは環境中の別の音も判定に入る。長く続く音は時間中央値にも入り、差が小さくなる
- ゲインのdBFSとFFTの差は音圧のdB SPLではない。研究の年代別の表と直接比較しない
- 耳の回答には集中・周囲の音・音量が影響する。聞こえないときに端末の音量を上げて追わない

音量は小さいところから始めてください。イヤホン・ヘッドホンではとくに音量に注意し、耳鳴り・頭痛・不快を感じたらすぐに止めてください。スピーカーを耳に近づけず、周りの人やペットがいない場所で使ってください。

作者のIPUSIRONはセキュリティ分野の技術書の著者です。作者は本ツールの悪用を勧めません。

## 🔒 プライバシーと安全対策

録音しません。マイクの値は端末内でその場でFFTにかけ、判定用の帯域パワーを一時的に保持します。測定結果と耳の回答を保存・送信する機能はありません。

localStorageに保存するのは`ultrasonic-reach-meter.lang`と`ultrasonic-reach-meter.theme`だけです。sessionStorage・Cookie・IndexedDBは使いません。CSPの`connect-src 'none'`で通信を制限し、表示はtextContentとcreateElementで作ります。CDN・外部フォント・依存パッケージはありません。

連続再生のボタンはなく、階段は自動で終わります。停止ボタン、タブが隠れたとき、マイクの切断や音声の中断で停止します。ページを離れるとAudioContextを閉じ、停止時にはマイクを解放します。

## 🔗 参考文献と関連ツール

- [Mavroudis et al., On the Privacy and Security of the Ultrasound Ecosystem（2017）](https://www.petsymposium.org/popets/2017/popets-2017-0018.pdf)
- [Arp et al., Privacy Threats through Ultrasonic Side Channels on Mobile Devices（2017）](https://vamos.mlsec.org/docs/2017a-eurosp.pdf)
- [FTCのSilverPushに関する警告（2016）](https://www.ftc.gov/news-events/press-releases/2016/03/ftc-issues-warning-letters-app-developers-using-silverpush-code)
- [W3C Web Audio API](https://www.w3.org/TR/webaudio-1.0/)、[Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)
- [Lee et al.（2012）の高域の参考値](https://pmc.ncbi.nlm.nih.gov/articles/PMC3606020/)、[Wang et al.（2021）の参考値](https://pmc.ncbi.nlm.nih.gov/articles/PMC8394048/)
- [WebKitの過去の報告179411](https://bugs.webkit.org/show_bug.cgi?id=179411)、[311451](https://bugs.webkit.org/show_bug.cgi?id=311451)、[326286](https://bugs.webkit.org/show_bug.cgi?id=326286)
- [Day041 Mic Gain Logger](https://github.com/ipusiron/mic-gain-logger)（[デモ](https://ipusiron.github.io/mic-gain-logger/)）—録音せずに音の強さを長時間記録する関連ツール

## 📁 ディレクトリー構造

```text
ultrasonic-reach-meter/
├── .github/workflows/test.yml
├── .gitignore
├── LICENSE
├── README.md
├── README.en.md
├── CLAUDE.md
├── package.json
├── index.html
├── style.css
├── tone-core.js
├── audio-io.js
├── messages.js
├── app.js
├── assets/
│   ├── environment.png
│   ├── reach.png
│   ├── hearing.png
│   └── en/
│       ├── reach.png
│       └── hearing.png
└── test/
    ├── audio.test.js
    ├── claims.test.js
    ├── contrast.test.js
    ├── format.test.js
    ├── html.test.js
    ├── readme.test.js
    └── tone-core.test.js
```

tone-core.jsはDOMに依存しない計算、audio-io.jsは音とマイク、app.jsは画面と操作、messages.jsは日英の文章を担当します。

## 💻 動作環境

実行にはWeb Audio APIを使えるブラウザーが必要です。「両方」「拾うだけ」はマイクの許可も必要です。開発用のNode.jsは22以上です。依存パッケージのインストールは不要です。

```sh
npm test
find . -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
```

構文検査の例はGit Bashなどのシェルで実行します。CIはpushとpull_requestで同じ検査を行います。

## 📄 ライセンス

[MIT License](LICENSE)です。配色・ヘルプ・日英切り替え・テストとCIの構成は、同じ作者の[Day118 SHA-256 Byte Inspector](https://github.com/ipusiron/sha256-byte-inspector)と[Day117 Hash Chain Tamper Trainer](https://github.com/ipusiron/hash-chain-tamper-trainer)を手本にしています。

## 🛠️ このツールについて

本ツールは、「生成AIで作るセキュリティツール200」プロジェクトの一環として開発されました。AIの支援を使いながら、Day101〜200の100日間にわたりセキュリティに関するツールを制作・公開する取り組みです。

🔗 [プロジェクトの詳細と他のツール](https://akademeia.info/?page_id=44607)
