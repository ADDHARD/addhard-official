# ADDHARD サイト管理

NEWS・Q&Aを追加、編集、削除、上下ボタンで並べ替えできます。下書きを保存しても公開サイトは変わりません。「更新して公開」でGitHubへ送信し、Cloudflare Pagesがビルドして反映します。送信成功は公開完了とは区別して表示します。

## ローカルで確認

Node.js 22以上。追加パッケージは不要です。

```powershell
node scripts/build.mjs
node scripts/dev.mjs
```

http://localhost:8788/admin/ を開き、`addhard-local` でログインします。この初期パスワードはローカル専用です。サーバーはこのPCからのみ接続できます。下書きはGit管理対象外の `.local/draft.json` に保存します。終了は実行画面で Ctrl+C。

検証：`node --test`。`node scripts/import.mjs` は初回移行専用です。編集開始後に実行すると公開データを元のHTMLから上書きするため、通常は実行しません。

## Cloudflare Pagesへ導入

1. このコードを `ADDHARD/addhard-official` の公開ブランチへ反映します。
2. Pagesのプロジェクト設定を、リポジトリルートを作業ディレクトリ、ビルドコマンド `node scripts/build.mjs`、出力ディレクトリ `dist` にします。既存の `ADDHARD` サブディレクトリ設定がある場合は変更が必要です。Functionsはルートの `functions/` から読み込まれます。
3. Cloudflare D1データベースを作成し、`schema.sql` を実行してテーブルを用意します。PagesのBindingsに `DB` という名前で接続します。本番とプレビューは別DBにしてください。
4. Pages Functionsの暗号化されたシークレットに以下を登録し、再デプロイします。GitHubトークンはチャット・HTML・リポジトリに書かないでください。

|設定|内容|
|---|---|
|`ADMIN_PASSWORD`|十分に長い管理者パスワード（ローカル初期値を使用しない）|
|`SESSION_SECRET`|32文字以上のランダム値。変更すると全ログインが失効|
|`GITHUB_TOKEN`|対象リポジトリ限定のfine-grained token、Contents read/write権限|
|`GITHUB_BRANCH`|公開ブランチ。通常は `main`|

5. Git連携で `main` への変更が本番ビルドを開始することを確認します。プレビュー環境には本番GitHubトークンを登録しないでください。プレビューには別DB・管理者設定を使用します。
6. `https://addhard-official.pages.dev/admin/` でログインし、下書き保存→プレビュー→更新の順で確認します。GitHubへの送信後、Cloudflareのデプロイ成功と公式サイトの表示を確認してください。

保存処理と秘密情報の実装は [CloudflareのBindings](https://developers.cloudflare.com/pages/functions/bindings/)、公開処理は [GitHub Contents API](https://docs.github.com/en/rest/repos/contents) に基づいています。

## データと公開の仕組み

- 公開の唯一の編集データは `data/content.json`。並び順は配列の順番です。トップはNEWS先頭4件、一覧は全件。Q&Aは全件です。
- ビルド時に従来のHTML/CSS/画像を引き継ぎ、ルートトップ、HTMLトップ、複数のNEWS一覧へ同じデータを反映します。旧JavaScriptによる一覧の上書きは生成物で停止します。
- プレビューは管理画面内の専用フレームへ表示します。公式サイトで使うフォント・画像・動画の配信元を許可し、スクリプトは実行しません。商品カルーセルなどJavaScriptによる操作の確認は公開サイトで行ってください。
- 本番下書きはD1。ログインは8時間の署名付きHttpOnly Cookie。変更系APIは同一Originのみ受け付けます。ログインはIPごとに15分10回までです。
- 下書きの世代番号で同時編集を検知。公開はGitHubのファイルSHAで競合を検知します。外部から公開JSONが変更された場合は自動上書きせず停止します。その場合はDBの下書きとGitHubを管理者が比較・統合して、base_shaも最新SHAへ更新してください。
- GitHubへの書き込みは公開JSONの1ファイルだけです。下書きやログイン情報はコミットしません。公開直前に保存され、確認画面を経て送信されます。
- 本文はプレーンテキストです。改行は反映し、HTMLを無害化します。移行元Q&Aの強調や本文リンクはテキスト化しています（FT参照URLは保持）。HTML/CSSによる外枠やレイアウトは維持します。
- 現段階では公開完了の自動監視、変更履歴画面、パスワード再発行、商品・メンバー・画像編集、予約公開は未実装です。GitHubコミット履歴から公開JSONを戻して再ビルドできます。

## 今後の拡張

商品・メンバーをJSONのコレクションとして追加し、画像は専用ストレージへ保存する構成に拡張できます。予約公開は別WorkerのCronと公開ジョブテーブルを追加し、入力日時をAsia/Tokyoで解釈してUTCで保存する予定です。実行中ロックと公開SHAによる重複防止を共通の公開処理へ組み込んでください。
