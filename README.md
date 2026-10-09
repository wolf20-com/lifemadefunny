# Life Made Funny

6言語の「あるある」を、Firebase Hostingから静的HTMLで配信するサイトです。Node.js 22以上を使用します。

## 最初に読む

- [調査結果・改修内容・再審査までの確認](docs/seo-adsense-audit.md)
- 本番は `https://lifemadefunny.com/`、Firebaseプロジェクトは `lifemadefunny-1b2a3` です。
- 公開対象は **`dist/`** です。従来の `public/` は移行前のスナップショットと画像の保管場所として残しています。旧HTMLを編集しても新版には反映されません。
- HTML・本文・ナビゲーション・SEO情報はビルド時に生成します。ページ表示にFirestore・Cloud Functions・外部JavaScriptは必要ありません。

## 編集する場所

| 対象 | ファイル |
| --- | --- |
| 各言語のテーマ・ネタ・タグ | `src/content/ja.json` など6ファイル |
| 記事の導入・補足・タイトル | `src/editorial.mjs` |
| 共通表示文・案内ページ | `src/i18n.mjs` |
| デザイン | `src/assets/site.css` |
| 絞り込み・保存・共有・解析同意 | `src/assets/site.js` |
| ドメイン・連絡先・広告ID・GA4 ID | `src/site.config.mjs` |
| HTML・サイトマップ・移行先の生成 | `scripts/build.mjs` |
| 旧URLの移行記録 | `src/content/migration.json` |

日常の更新では `scripts/import-legacy.py` を再実行しないでください。これは旧サイトからの初回移行用で、実行すると新しい編集データが旧版の内容に戻ります。

## ローカルで確認する

リポジトリのルートで実行してください。

```sh
npm ci
npm run verify
npm run preview
```

ブラウザーで `http://localhost:4173/ja/` を開きます。`npm run verify` は、ビルドの後に全ページのリンク、画像、canonical、言語の相互参照、サイトマップ、旧URLと既存本文の保持を検証します。

Firebase自体の配信設定を確認する場合：

```sh
npx firebase-tools emulators:start --only hosting --project lifemadefunny-1b2a3
```

表示先は `http://127.0.0.1:5000/ja/` です。生成HTMLだけを直接ダブルクリックするとルート相対リンクが動きません。

## 公開する

### PCから公開する方法

公開したいブランチを選び、変更を確認してから実行します。公開されるのは現在のチェックアウトから生成したサイトです。

```sh
npm ci
npm run verify
npx firebase-tools login
npx firebase-tools deploy --only hosting --project lifemadefunny-1b2a3
npm run check:live
```

`--only hosting` を付けます。既存のCloud Functionsの削除・変更は不要です。`firebase deploy` だけで全サービスを更新しないでください。

まず限定URLで見たい場合は、ログイン後に次を使えます。

```sh
npx firebase-tools hosting:channel:deploy site-review --expires 7d --project lifemadefunny-1b2a3
```

これはFirebaseのプレビューチャンネルです。本番用のcanonicalは維持されます。プレビューを検索エンジンへ申請しないでください。

### GitHubのmainから自動公開する方法

既存の `.github/workflows/firebase-hosting.yml` を使用します。ただし、2026-10-09の確認では、過去の公開処理が **`FIREBASE_SERVICE_ACCOUNT` 未登録**で失敗していました。

Firebase公式のGitHub連携セットアップを利用する場合：

```sh
npx firebase-tools login
npx firebase-tools init hosting:github
```

対象は既存の `wolf20-com/lifemadefunny` と `lifemadefunny-1b2a3` です。生成されるワークフローは本リポジトリのものと比較し、`public: dist`、ビルド・検証、プロジェクトID、mainのみの公開を維持してください。セットアップが別名のSecretを作成した場合は、ワークフローの `firebaseServiceAccount` と認証チェックの参照を、その名前に合わせます。

GitHubの **Settings → Secrets and variables → Actions** で、参照するSecretが登録されていることを確認します。秘密鍵JSONをリポジトリにコミットしたり、チャットに貼ったりしないでください。認証設定後はmainへの反映で本番が切り替わります。

公式手順：https://firebase.google.com/docs/hosting/github-integration

## 公開後・AdSense再申請前

1. `npm run check:live` を実行します。結果の詳細は `.build/live-check.json` に保存されます。
2. Firebase Hostingのカスタムドメイン画面で、本体ドメイン・SSLを確認します。`www.lifemadefunny.com` を使う場合は、本体への転送を設定します。この設定はHTMLや`firebase.json`だけでは直せません。
3. Search Consoleで `/`、`/ja/`、日本語の代表記事、他言語の記事をライブテストします。サイトマップに `https://lifemadefunny.com/sitemap.xml` を送信します。
4. AdSenseの申請URL、クロールエラーの対象URL・発生日を確認し、解消後に再審査を依頼します。

AdSenseの所有確認用metaタグとads.txtには従来と同じ広告IDを使用しています。承認前の新版では広告配信スクリプトを読み込みません。Google公式で認められた **メタタグまたはads.txtによる所有確認**を使用してください。

広告配信開始時はAdSenseの承認と、配信地域に必要なGoogle認定CMP等を設定し、プライバシー記載を更新してから `src/site.config.mjs` の `autoAds` を有効にします。このサイトのアクセス解析同意ボタンは、広告用のGoogle認定CMPの代わりにはなりません。

## 計測と日々の改善

- GA4 IDは既存の `G-XW0SRKPV6N` を維持します。新しい解析スクリプトは同意後にだけ読み込まれます。そのため、改修前後のGA4ユーザー数をそのまま比較すると誤解が生じます。検索流入の評価にはSearch Consoleのクリック数も併用してください。
- ネタの保存先は読者のブラウザーです。アカウント登録や端末間同期はありません。保存一覧は各言語のフッターから開けます。
- 旧Firestoreの `countPageView` 呼び出しは新版から行いません。旧ページ閲覧数フィールドを使っていた別ツールがある場合、その数値は新版の閲覧数を表しません。
- 日付は編集内容に合わせて `src/editorial.mjs` で管理します。ビルドするたびに全ページの更新日を新しくすることはありません。
- 新しいテーマを追加するときは、必要な6言語の本文と対応URLを用意してください。テーマやネタの追加はビルドに自動で反映されます。既存のネタを削除する場合は、移行方針と保持チェックの変更理由も明記してください。
- 検索順位やAdSense承認を保証する変更ではありません。検索語句ごとに、表示回数・掲載順位・クリック率を確認しながら、実際に読まれるテーマの内容を改善します。

## 戻す場合

Firebase Hostingのリリース履歴から、直前に正常だったリリースへロールバックできます。コードを戻す場合はこの変更のコミットをrevertし、旧 `public/` 配信設定を含めて以前の状態を再デプロイします。単に`dist/`を削除してから公開しないでください。
