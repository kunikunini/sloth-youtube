# Repository Guidelines

## プロジェクト構成とモジュール整理
- ルート: `index.html`, `app.js`, `style.css`（バニラJS）。レガシー `data.js` があれば自動フォールバック。
- アセット: `SWC_youtube_project/` にキャラクター画像とデータ。ビルド成果物の `SWC_youtube_project/manifest.json` がUIのソース。
- データ入力（任意）: `SWC_youtube_project/sheet.csv`（シート出力）, `SWC_youtube_project/videos.csv`（正規化後）, もしくは `SWC_youtube_project/<base>.videos.json` のサイドカー（`{ alt, videos[] }`）。
- スクリプト: `scripts/*.mjs`（Node 18 ESM）でマニフェストのビルド/ウォッチとCSV正規化を実行。
- CI: `.github/workflows/pages.yml` が `main` へのpushで GitHub Pages にデプロイ。

## ビルド・実行・開発コマンド
- `npm run build:manifest`: `SWC_youtube_project/` を走査し `manifest.json` を生成（`app.js` が参照）。
- `npm run dev:manifest`: `SWC_youtube_project/` を監視し変更時に再生成。
- `npm run csv:normalize`: `sheet.csv`（F=画像, G=リンク）から `videos.csv` を生成し再ビルド。
- ローカル表示: `index.html` を直接開くか、`python3 -m http.server 8000` 等で簡易サーバを起動。

## コーディング規約と命名
- JavaScript: ES Modules、インデントは2スペース。セミコロンは任意で一貫性重視。変数/関数は `camelCase`。
- ファイル: ルートは小文字（例: `app.js`, `style.css`）。`SWC_youtube_project/` 内の画像のベース名が既定の `alt` 兼キー（例: `kuni_1.png` → `kuni_1`）。
- サイドカーJSON: `<base>.videos.json` または `<base>.json`。形: `{ "alt": "...", "videos": [{ "id": "<YouTubeID>", "title": "..." }] }`。

## テスト方針
- 公式テストフレームワークは未採用。以下でスモークテスト:
  1) `npm run build:manifest`（または `dev:manifest`）を実行。
  2) `index.html` を開き、ギャラリー件数・ヒーロー表示・モーダル再生を確認。
  3) `manifest.json` に期待どおりのキャラクターと動画IDが含まれるか確認。

## コミット/PR ガイドライン
- コミット: 可能な限り Conventional Commits（例: `fix(ci): ...`, `chore: ...`）。
- PR: 変更概要、関連Issue、UI変更はBefore/After画像、ローカル再現/確認手順を記載。スコープは小さく保つ。

## セキュリティと設定のヒント
- 認証情報は原則コミットしない: `SWC_youtube_project/service-account.json`, `sheets.sa.json` は `.gitignore` 済み。
- リモートCSV利用時は `SWC_youtube_project/sheets.config.json` に `{ "csvUrl": "..." }` を設定。サービスアカウント方式（`sheets.sa.json`）も対応するが、簡易なCSV方式を推奨。
