# Ultrasonic Reach Meterの開発

Day119の静的な学習ツールです。端末の出力から入力までの到達と、耳の回答を分けて表示します。

## 構成とコマンド

- tone-core.js：UMDの純関数。サンプル列・上限・FFTの帯域パワー・判定・耳の状態遷移
- audio-io.js：UMDの音声入出力。ブラウザーの機能、許可、音声の中断、停止処理
- messages.js：日英の文章。app.jsはtextContentとcreateElementで描画
- index.html・style.css：タブのない1ページ、44px以上の操作対象、dialogによるヘルプ
- test/：node:test。外部の依存パッケージは不要

Node.jsは22以上です。`npm test`で全件を実行します。Git Bashの構文検査は次の形です。

```sh
find . -name '*.js' -not -path './.git/*' -print0 | xargs -0 -n1 node --check
```

CIはpushとpull_requestで構文とテストを確認します。構文エラーを終了コードに伝えないfindの-exec形式に変えないでください。

## 音と判定の規則

- AudioContextは操作時に作り、sampleRateを指定しない。整数Hz・1秒のAudioBufferをループして短く鳴らす
- ゲインは初期−30dBFS、上限−12dBFS。前後20msの直線ランプ。耳の発音は1.5秒
- 上限は`min(21500, floor(0.45 * sampleRate / 500) * 500)`Hz。0.417倍より上は参考値
- FFTは8192、平滑化は0、対象ビン±2の最大パワー。間隔は171msとFFT窓長の切り上げの大きい方
- 両方は無音8フレームと発音8フレームを独立して2回測る。2回続けて+10dB以上で到達、最大+4dB以上で弱い。所要時間の短縮のために窓を重ねない
- 拾うだけは60秒。時間中央値を背景、8フレーム移動平均を信号とする。+10dB超の2時点が0.5秒以上離れる条件。同じ発音でもよい
- 拾うだけの信号と背景は各10⁻¹²（FFT値−120dB）を下限として比を取る。極小成分による誤判定を避ける設計値であり、音圧の校正ではない。微弱信号を落とす場合がある。両方には適用しない
- 1kHzの自己点検で届かなければ停止する。出すだけではマイクを開かない
- 耳は2段連続の否定で上りを終え、最高段を再確認する。再生し直しは各段1回。音量の変更と条件差は参考扱い

## ブラウザーの事実と確認範囲

| 項目 | 対応と根拠 |
|---|---|
| Chromiumの高域の発音 | OscillatorNodeの減衰を避けるためAudioBufferを使用 |
| Firefoxの折り返し | ナイキストを超える発音をアプリの上限で防止 |
| Firefoxのマイク接続 | 版によりレート不一致でNotSupportedError。レートを強制せず、例外を画面に表示 |
| Chromiumの入力加工 | EC・NSが有効だと高域が失われる場合がある。falseをidealで要求し、実値で警告 |
| getSettings | true＝オン、false＝オフ、項目なし＝報告なし。SafariでECのみ報告する例あり |
| file:// | Chromium・Firefoxで配置とAPIの存在を確認。音の通し試験はChromium |
| WindowsのWebKit | AudioContextとmediaDevicesがないポート。配置確認のみで、Safari実機の代わりではない |
| iPhone | ChromeもWebKit。audioSessionがあればマイク使用時play-and-record、その他playback |
| 入力の実レート | 合成WAVは48000Hzだがマイクの報告は44100Hz、AudioContextは48000Hzだった |
| 未確認 | Mac・iPhoneのSafari、実機のChrome・Vivaldiの音声、Android、スクリーンリーダーの読み上げ |

動作の分岐には機能の有無と実測値を使います。UAで処理を切り替えないでください。最新の挙動はREADMEの一次資料と実ブラウザーで確認します。

## 変更時の確認

- HTTPとfile://、Chromiumの幅320・390・1280pxと日英、Firefoxの320・1280px、WebKitの390pxで配置を確認
- console・pageerror・CSP違反・外部通信・横はみ出しを確認。44pxの操作対象とヘルプを閉じた後のフォーカスを確認
- 合成WAVの確認はリポジトリー外で生成し、独立したFFTかゴーツェル法で周波数・時間・振幅を検算
- ヘッドレスの音声試験は実機へ出力しない。3役・自動停止・非表示時停止・マイク解放・ゲイン上限を確認
- READMEの画像は1280×800、300KB以下。合成入力・操作例を実機や人の測定と混同しない
- 日英の説明・テストの期待値・コア・画面・READMEを同時に点検。期待値を通すために変えない

## 保存と安全の境界

録音・音声保存・測定結果の永続保存・送信は行いません。localStorageは言語と明暗の2キーだけです。CSPはdefault-srcとconnect-srcがnone、スクリプトとスタイルはselfです。通常スクリプトのUMDを維持し、ES module、外部依存、CDN、fetch、Workerを加えないでください。

連続再生を加えず、停止・非表示・音声中断・切断・pagehideで資源を解放します。耳の年齢を推定せず、結果はこの端末とこの音量での回答として説明します。日本語の本文はですます調、箇条書きと表はである調にそろえます。
