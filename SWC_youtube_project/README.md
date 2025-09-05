このディレクトリに入れた画像が、自動的にヘッダーおよびグリッドのキャラクターとして表示されます。

自動生成:
- `npm run build:manifest` を実行すると `manifest.json` が生成/更新されます。
- 新しい画像を追加すると次回の実行で自動的にキャラクター追加されます。

動画のひも付け（任意）:
- 各画像ファイルと同じファイル名の JSON を用意して、動画IDを登録します。
- 例: 画像 `sloth-001.png` に対して `sloth-001.videos.json`

sloth-001.videos.json の例:
{
  "alt": "Sloth #001",
  "videos": [
    { "id": "dQw4w9WgXcQ", "title": "サンプル動画A" },
    { "id": "VIDEO_ID_2", "title": "サンプル動画B" }
  ]
}

注意:
- 拡張子: 画像は .png .jpg .jpeg .webp .gif .svg をサポート
- タイトルは任意。未指定でも再生可能です。

スプレッドシート連携（任意）:
セキュア方式（推奨: サービスアカウント利用 = 公開不要）:
1) Google Cloud で「サービスアカウント」を作成し、JSON鍵をダウンロード
2) 「Google Sheets API」を有効化
3) スプレッドシートをサービスアカウントのメールアドレス（例: `xxxxx@xxxxx.iam.gserviceaccount.com`）に「閲覧者」として共有
4) このフォルダに `sheets.sa.json` を作成（例）:
   {
     "spreadsheetId": "<スプレッドシートID>",
     "sheetName": "けんスピ提出動画",
     "credentialsPath": "SWC_youtube_project/service-account.json",
     "range": "けんスピ提出動画!F:G",  // 任意。未指定時は sheetName!F:G
     "headerRow": true                 // 1行目がヘッダーの場合は true
   }
5) 上記の `credentialsPath` にサービスアカウントの JSON キーを保存
6) `npm run build:manifest` 実行（または `npm run dev:manifest`）
   - 列F: 画像ファイル名（例: `sloth-001.png`）
   - 列G: 動画リンク（通常/shorts/共有URL いずれもOK）

公開CSV方式（簡易・公開されます）:
1) スプレッドシートを「ウェブに公開（CSV）」してURLを取得
2) `sheets.config.json` を作成:
   { "csvUrl": "https://docs.google.com/spreadsheets/d/.../gviz/tq?tqx=out:csv&sheet=..." }
3) 列ヘッダーを `image, base, alt, video_id, title` としてCSVを書き出す
4) `npm run build:manifest` / `npm run dev:manifest`

ローカルCSV運用（オフライン可）:
- `SWC_youtube_project/videos.csv` を置けば読み込みます。
- 列ヘッダ例（いずれも小文字推奨）:
  - 必須: `image`（例:`sloth-001.png`）
  - いずれか: `video_id` もしくは `link`/`url`（YouTubeのURLからIDを自動抽出）
  - 任意: `alt`, `title`
- 例:
  image,link,alt,title
  sloth-001.png,https://youtube.com/shorts/AbCdEfGhIjk,Sloth #001,はじめての動画
  sloth-001.png,https://youtu.be/dQw4w9WgXcQ,,
- 優先順: 「サービスアカウント（sheets.sa.json）→ 公開CSV（sheets.config.json）→ ローカルCSV（videos.csv）→ サイドカーJSON」

デプロイ手順（静的公開に最適）:

シートからの一括取り込み（今回のレイアウト向け／手動）:
- 対象: 「けんスピ提出動画」シート F列=画像ファイル名、G列=動画URL
- 手順:
  1) 対象シートを CSV でエクスポート（FとGだけのCSVにするのが簡単です）
  2) 保存したCSVを `SWC_youtube_project/sheet.csv` という名前で配置
  3) ルートで `npm run csv:normalize`
     - `sheet.csv` を読み取り、空行やF空欄をスキップしながら、直前のF（画像名）にG（URL）を紐づけて `videos.csv` を生成
     - 続けて `manifest.json` も自動生成
  4) ブラウザをリロードして反映を確認

 複数キャラを1行で指定するには:
 - F列にカンマ区切り（日本語読点「、」も可）で画像ファイル名を並べます
   例: `koyama.png, zaipen_2.png`
 - その行のG列の動画URLが、指定した全キャラに紐づきます
 - 次の行でFを空欄にすると「直前のFのキャラ群」を引き継ぎます
- 更新するたびに以下を実施
  1) `SWC_youtube_project/videos.csv` を更新（テンプレート: `videos.sample.csv` を参考に）
  2) ルートで `npm run build:manifest` を実行（`SWC_youtube_project/manifest.json` を生成）
  3) 以下のみをサーバにアップロード
     - `index.html`, `style.css`, `app.js`
     - `SWC_youtube_project/manifest.json`
     - `SWC_youtube_project/` 内の画像（.png/.jpg など）
- アップロードしない（非公開データ）
  - `SWC_youtube_project/videos.csv`
  - 使っていれば `service-account.json`, `sheets.sa.json`
