# Life Made Funny：調査と改修記録

調査日：2026-10-09（日本時間）。基準ブランチ：main、調査開始時コミット：`6ce0a466e58228d2a9330861331c005357ac7c5c`。

## 結論

今回提示されたAdSenseの理由は「サイトの停止または利用不可」です。これは内容の薄さを指摘するメッセージとは別です。公開URLの現在の応答、リポジトリ、GitHub Actionsの履歴を調査しましたが、審査時刻のログと申請URLの詳細がないため、過去の停止原因そのものは断定できません。

一方、SEOの技術面には再現できる不具合がありました。言語指定の誤りを直し、同じ短文を複製する大量のタグ一覧を補助ページに整理して、テーマ別のまとまった読みものを検索の入口にする構成へ変更しました。

## 確認できた事実

| 項目 | 旧サイトの観測結果 | 対応 |
| --- | --- | --- |
| 現在の到達性 | 本体のトップ・6言語ホーム・代表記事・robots.txt・ads.txt・sitemap.xmlは200。存在しないURLは404 | 静的配信を明確化し、公開後のチェックを追加 |
| 審査用クローラー | Mediapartners-Google、Google-Display-Ads-Bot、GooglebotのUser-Agentで主要URLは200 | User-AgentだけではGoogleの実IPからの到達を証明できないことを明記 |
| www付きURL | この実行環境経由ではHTTPSが502。DNS照会は環境の制限でECONNREFUSED | 本番のDNS・SSL・Firebaseカスタムドメインで要確認。DNS不備とは断定しない |
| 自動公開 | 2026-10-08 UTCのActions実行が `Input required and not supplied: firebaseServiceAccount` で失敗 | 未設定を説明するチェックと公開手順を追加。秘密情報の登録は別途必要 |
| hreflang | HTML 2,450ページで、日本語URLを含む複数の言語URLに `hreflang="pt"` が付いていた | 6言語＋x-defaultの正しい相互参照を共通生成 |
| ルート言語 | `/` は英語本文なのに `html lang="ja"`。canonicalは`/en/` | ルートを独立した言語選択ページにし、各言語ホームと区別 |
| サイト規模 | HTML 2,453ページ。タグ関連1,892ページ（約77%） | 980ページに整理。検索用サイトマップは主要313URL |
| サイトマップ | 2,449URLに、タグの細かなページ分割も含む | 主要ページのみ。noindexや旧URLを含めない |
| テーマ記事 | 各テーマ10件ずつの短文に分割。多くのページで繰り返しの見出しやタグ、関連カードが本文より目立つ | 43テーマ×6言語の本文集約、目次、関連テーマへの導線 |
| 見出し | 13ページにh1が複数 | 各ページ1つの主見出しに整理。これ単独が不合格・低順位の原因だとは扱わない |
| 運営説明 | 「毎日更新」「実体験」「世界中から集めた」等、根拠を確認できない説明 | 創作・誇張を含むユーモアであること、制作支援、連絡先を明示 |

自動公開の失敗履歴：
https://github.com/wolf20-com/lifemadefunny/actions/runs/37820638321

### Cloud Functionsについての注意

旧 `firebase.json` には `/` を `redirectByLocale` にrewriteする設定があり、その関数は302応答にnoindexヘッダーを付けていました。ただし旧リポジトリには実ファイル `public/index.html` があり、Firebase Hostingでは静的ファイルがrewriteより優先されます。今回の本番でも `/` は直接200でした。したがって、この関数やコールドスタートを今回の停止原因と決めつけることはできません。

新版では不要なrewriteを外し、ルートも常に静的HTMLとして配信します。既存Functions自体は削除しません。

## 月70ユーザー程度にとどまる理由をどう考えるか

ユーザー数だけでは、検索結果に出ていないのか、表示されてもクリックされないのか、解析で捕捉されていないのかを区別できません。今回はSearch Console・GA4のアカウントデータを取得していません。

次の点は、改善すべき根拠がソース上にあります。

- 言語の対応関係が壊れていて、多言語ページの関係を正しく伝えられていない。
- 類似した短文と共通部品を繰り返すタグ一覧が大部分を占め、主要なテーマ記事にまとまっていない。
- テーマを選んで読める入口・導入・関連テーマの案内が弱い。
- 英語の汎用表記が日本語ページに混ざり、案内文と実際の内容が一致していない箇所がある。

ただし「Googleからペナルティを受けている」「この修正で必ず検索流入が増える」という証拠はありません。hreflangや見出しを直すだけで順位が上がるとは限りません。検索需要、内容の独自性、競合、被リンク等も影響するため、公開後のSearch Consoleで確認します。

## 新しいサイト構成

| URL | 役割 | 検索への扱い |
| --- | --- | --- |
| `/` | 6言語を選ぶ入口 | index・自己canonical・x-default |
| `/{lang}/` | 各言語のホーム | index |
| `/{lang}/categories/` | 全テーマ一覧・絞り込み | index |
| `/{lang}/categories/jobs/` | 仕事テーマの入口 | index |
| `/{lang}/categories/sports/` | スポーツテーマの入口 | index |
| `/{lang}/categories/{group}/{topic}/` | ネタを1ページで読める主記事 | index・目次・パンくず・関連テーマ |
| `/{lang}/tags/…/` | 関連するネタへの補助導線 | noindex,follow・サイトマップ対象外 |
| `/{lang}/saved/` | そのブラウザーに保存したネタ | noindex,follow |
| `/{lang}/static/…/` | 運営説明・編集方針・問い合わせ・プライバシー・既存利用規約 | index |

`lang` は `ja/en/fr/pt/es/de`。既存の主記事URLを維持しました。旧ページ分割1,505URLは、該当する記事やタグへの301にまとめています。旧記事2ページ目は集約した記事の該当ネタのアンカーへ移動します。

タグのnoindexは検索対象の整理であり、AdSenseの審査から隠す手段ではありません。robots.txtではクロールを許可したままにしています。タグに検索流入があったかはSearch Console未取得のため不明です。適用後はタグ経由のクリックと主記事経由のクリックの両方を確認してください。

## 内容と表示の改修

- 5,150件の既存ネタを保持。日本語850件、その他の各言語860件。
- 会社員・エンジニア・接客・教師・サッカー・バスケの日本語6記事と、英語3記事に専用の導入・補足・タイトルを追加。
- 258本すべての既存本文を全面的に書き換えたわけではありません。その他のテーマも本文の集約・目次・共有・導線・正しいメタ情報を適用しています。
- 6言語のUIを整え、スマートフォンでもテーマを探し、ネタを読めるデザインに更新。
- 絞り込み、ネタの共有、ブラウザー内保存と保存一覧を実装。
- 全文はHTMLで配信。JavaScriptが使えなくても本文、言語切り替え、目次、関連リンクを利用可能。
- レンダリングに外部フォントやFirebase SDKを必須にせず、CSS/JavaScriptにはファイル内容に基づくキャッシュ用の名前を使用。
- 構造化データは実際に表示しているWebSite・CollectionPage/ItemList・BreadcrumbListのみ。実在しない評価・レビュー・著者経歴は追加していません。

## 広告と計測

AdSense所有確認metaとads.txtは元のIDを保持します。広告コードを使わなくても、Googleの公式手順にはmetaまたはads.txtによる確認方法があります。承認前に新しい広告枠を増やす必要はありません。

GA4の計測IDは維持し、解析は同意後に開始します。新版のユーザー数は同意しなかった閲覧を含まないため、旧版の「70」と単純比較しないでください。Search Consoleの自然検索クリックを主指標にし、GA4は補助的に確認します。

旧Firestoreのページ閲覧数カウンターは新版から呼び出しません。これを他の集計で利用していた場合、その集計は別途見直す必要があります。

## 再審査までに残る確認

### 実装の検証結果

- 全980ページの静的検証：リンク・画像等84,561件、言語の相互参照2,191件、サイトマップ313URLが整合。
- 既存2,451URL（404と旧バックアップを除く）は、新しい実ページまたは301の移行先に到達。既存ネタ5,150件を保持。
- Firebase Hostingエミュレーター：主要URLの200、旧ページの301、存在しないURLの404を確認。
- Chromium：6言語のホームと代表記事を320px・390px・1280pxで確認（36画面）。横方向のはみ出し・JavaScript例外なし。
- 絞り込み、保存→再読込→保存一覧→削除、共有、同じページの言語切り替え、解析への同意・撤回、JavaScript無効時の本文表示を確認。
- 本番へのデプロイ、実際のGoogle IPからのアクセス、Search Console・AdSense内部の結果は、まだ確認していません。

画面例：[PCホーム](previews/home-desktop.png) / [スマートフォンのホーム](previews/home-mobile.png) / [スマートフォンの記事](previews/article-mobile.png)

### 公開・再申請

1. 改修内容を確認し、本番へ公開する。自動公開を使う場合は、未登録のFirebase認証Secretを先に設定する。
2. AdSenseに提出したURLが`lifemadefunny.com`で正しいか確認する。wwwを使うならDNS・SSL・転送をFirebase側で整える。
3. Search Consoleの「URL検査 → 公開URLをテスト」でトップ・代表記事を確認する。通常のブラウザー表示だけでは、Googleのアクセス確認は完了しない。
4. AdSenseのクロールエラーに対象URL・日時が出る場合、そのURLを確認する。審査時の503/403/404、証明書、リダイレクト、ドメイン設定を切り分ける。
5. 広告管理画面でmeta/ads.txtによる所有確認を行い、問題解消を確認して再審査を申請する。

## 公開後のSEO確認

Search Consoleから、検索タイプ「ウェブ」で直近3か月の検索語句・ページ・国・デバイス、ページのインデックス登録状況を取得してください。

| 観測結果 | 次の対応 |
| --- | --- |
| 主記事が「検出・未登録」「クロール済み・未登録」 | 内部リンク、canonical、内容の独自性と充実度を該当URLごとに確認 |
| 表示回数が少なく順位も低い | 実際の検索語句とテーマの一致を見直し、読まれるテーマを具体的に改善 |
| 掲載順位に対してクリック率が低い | 検索意図とタイトル・説明のずれを修正 |
| Search ConsoleのクリックはあるがGA4が少ない | 同意・計測条件・日付や指標定義の違いを確認 |
| 旧タグが減り、主記事が伸びている | 集約の推移として確認。総クリックも合わせて判断 |

再クロールや評価には時間がかかります。毎日URL構成を変えず、公開日を記録し、28日程度の同じ長さの期間で推移を比較してください。固定期間での成果や承認を保証するものではありません。

## 公式資料

- AdSenseの未承認理由（到達性とコンテンツを区別）：https://support.google.com/adsense/answer/12176698
- AdSenseクローラーの問題：https://support.google.com/adsense/answer/2381908
- AdSense所有確認方法：https://support.google.com/adsense/answer/7584263
- 多言語ページの相互参照：https://developers.google.com/search/docs/specialty/international/localized-versions
- canonicalと統合：https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- noindexとクロール：https://developers.google.com/search/docs/crawling-indexing/block-indexing
- 生成AIと内容の品質：https://developers.google.com/search/docs/fundamentals/using-gen-ai-content
- Firebase Hostingのファイル優先順位・リダイレクト：https://firebase.google.com/docs/hosting/full-config
- FirebaseとGitHub連携：https://firebase.google.com/docs/hosting/github-integration
