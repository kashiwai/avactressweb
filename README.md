# AV女優 風俗出勤ナビ

風俗店に在籍するAV女優・セクシー女優の出勤日・休みを、女優・店舗・地域（地域×業種）ごとに毎日更新して見られるサイトです。DMM（FANZA）アフィリエイトと連動します。

## 構成

- Next.js 16（App Router）/ TypeScript / Tailwind CSS v4 / bun
- PostgreSQL + Drizzle ORM
- 自前ログイン（運営者・お店の2つの役割）
- 毎日の自動取り込み（`/api/cron/ingest`、Vercel Cron で毎日 5:00 JST）

## はじめかた（ローカル）

```bash
bun install
cp .env.example .env.local   # 値を入れる
bun run db:migrate           # テーブル作成（DATABASE_URL を読み込んだ状態で）
bun run seed                 # 最初の運営者アカウントを作成
bun run seed:demo            # （任意）動作確認用の架空データ。本番では使わない
bun run dev
```

seed で自動生成したパスワードは `.dev-credentials.txt`（Git管理外）に保存されます。

## 画面

| 画面 | URL |
|---|---|
| 本日出勤（トップ） | `/` |
| 女優一覧・詳細（出勤カレンダー・よく出勤する曜日・DMM作品） | `/actresses`, `/actresses/[id]` |
| 店舗一覧・詳細（週間出勤表） | `/shops`, `/shops/[id]` |
| 地域・地域×業種 | `/areas`, `/areas/[pref]`, `/areas/[pref]/[genre]`（例 `/areas/tokyo/deliveryhealth`） |
| 検索結果 | `/search?q=` （全画面上部の検索窓から。入力中に候補表示） |
| 削除依頼 | `/removal` |
| 運営者管理画面 | `/admin`（女優・店舗・在籍/出勤・取り込み元・削除依頼・アカウント・操作記録） |
| お店用画面 | `/shop`（自店の出勤入力のみ） |

## 出勤データの取り込み元

管理画面「取り込み元」から登録します。**「規約確認済み」にチェックしたものだけが実行されます。**

| 形式 | 用途 |
|---|---|
| JSONフィード | お店から提供される出勤データ（形式は管理画面に記載） |
| avzoku | 運営者の許可を得た avzoku.com の地域別出勤一覧（例 `https://avzoku.com/schedule/tokyo-deliveryhealth/`）。女優・店舗・在籍・出勤を自動で作成／更新 |
| avfuzoku | avfuzoku-soap-deli.com の女優ページ（`https://www.avfuzoku-soap-deli.com/sitemap.html`）。在籍・退店を自動で反映 |
| adultinfo | adultinfojpn.com の「AV女優の風俗在籍まとめ」（`https://adultinfojpn.com/avfuzoku/`）。女優ページの在籍店情報・過去の在籍を反映 |
| fuuav | FuuAV の在籍・退店まとめ（`https://fuuav.com/allposts/`）。全記事を巡回し、店名（地域・業種）と源氏名を反映 |
| koukyuderi | コウデリの「AV女優在籍風俗店情報」（`https://www.koukyuderi.jp/special/avjoyu.html`）。表の女優名・源氏名・店名・地域・電話番号を反映 |
| avfuuzoku | AV女優風俗在籍情報更新.com の詳細ページ（`https://avfuuzoku.com/genre_search.php`）。店名・業種・エリア・電話番号・退店を反映 |

- 取得前に毎回 robots.txt を確認し、1秒に1件の間隔で取得します。
- 取り込み元サイトの画像は複製しません。
- 運営者・お店が手で入れた出勤は、自動取り込みで上書きしません。
- 掲載停止にした女優は、取り込み直しても停止のままです。**本人・事務所からの削除依頼には「削除」ではなく「掲載停止」を使ってください**（削除すると次回の取り込みで復活します）。
- 取り込み元から得た許可は、メール等の文面で保管してください。

### 女優名・店名のマージ（名寄せ）

取り込み元ごとに表記が違うため、次の順で既存データに寄せます（新しく作る前に必ず照合します）。

- 女優：全角/半角・空白・カタカナ/ひらがなをそろえた名前 → 括弧内の別名 → よみがな、の順で探します。別名は `actresses.aliases` に残します。表記ゆれだけの重複は1人に統合し、在籍・出勤は残します。
- 店舗：電話番号 → 都道府県＋店名（表記ゆれをそろえたもの） → 全国で1つに定まる店名、の順で探します。同じ都道府県で表記ゆれだけの店舗は1店に統合します。
- 迷うもの（同じ名前が複数・都道府県が分からない店）は新しく作らず、未照合として実行履歴に残します。
- 「FC2-PPV-123456」のような品番だけの女優名は、女優として作りません。

既存データの整理は次のコマンドで確認できます（`--apply` で反映）。

```bash
bun --env-file=.env.local --conditions=react-server scripts/clean-merge.ts          # 確認のみ
bun --env-file=.env.local --conditions=react-server scripts/clean-merge.ts --apply  # 統合・非公開化を反映
```

### 女優の画像を全員分そろえる

DUGAの女優一覧（名前・よみがな・女優ID・顔写真）を全件読み、名前・別名・よみがなで照合して顔写真を入れます。
一覧に無い人はDUGA検索APIで照合し、それでも無い人は取り込み元ページの女優画像を表示用（`actresses.source_image_url`）に保存します。

```bash
# 確認のみ（書き込みなし）
bun run photos:backfill
# 反映（全員分。DUGA一覧の読み込み + API照合 + 取り込み元画像）
bun run photos:backfill --apply
# 対象を絞る / APIを省略する / 取り込み元画像を省略する
bun run photos:backfill --apply --limit=200
bun run photos:backfill --apply --skip-api
bun run photos:backfill --apply --skip-source
```

- 表示は `imageUrl`（DUGA/DMMの写真）→ `sourceImageUrl`（取り込み元の画像）→ 頭文字の順です。
- DUGAに作品表紙しか無い女優は、顔写真があれば自動で置き換えます（30日に1回確認）。
- 取り込み元の画像は複製せず、URLを保存して表示します。
- `DMM_API_ID` / `DMM_AFFILIATE_ID` を設定すると、DUGAに居ない女優もDMM女優検索で補完します（無料のアフィリエイトAPI）。

### 毎日の自動更新

店ページの週間シフト（源氏名で照合）を毎日反映するには、次のいずれかを使います。

**macOSのlaunchd（このMacで動かす場合）**

```bash
cp scripts/launchd/com.adlutweb.daily.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.adlutweb.daily.plist
```

- 毎日 03:00 に `scripts/daily-update.sh` が動きます（ingest → 店シフト → 画像不足分 → 重複整理）。
- ログ：`/tmp/adlutweb-daily.out.log` / `/tmp/adlutweb-daily.err.log`
- 止める：`launchctl bootout gui/$(id -u) ~/Library/LaunchAgents/com.adlutweb.daily.plist`

**GitHub Actions（PCを起動していなくても動かす場合）**

1. GitHubの `Settings → Secrets and variables → Actions` に `DATABASE_URL`（本番SupabaseのSession URL）を登録
2. `.github/workflows/daily-ingest.yml` と `daily-shifts.yml` を push
3. `daily-ingest` は毎日03:00 JST、`daily-shifts` は毎日09:00 JSTに実行

**手動で同じ処理をする場合**

```bash
bun run ingest:now                 # 全取り込み元（一覧取得＋待ち行列）
bun run sync:shifts --apply        # 店ページの週間シフト
bun run photos:backfill --apply --missing-only --skip-api  # 足りない画像
bun run clean:merge --apply        # 重複整理
```

大量のページがあるため、ingest は数時間かかることがあります。途中で終了しても、残りは次回のcronが続きから処理します。


## DMM（FANZA）アフィリエイト

1. DMM アフィリエイトに登録し、サイト審査を受ける
2. API ID を発行する（API で使うアフィリエイトIDは末尾が 990〜999 のもの）
3. `DMM_API_ID` と `DMM_AFFILIATE_ID` を環境変数に設定する

設定すると、女優ページに最新作品（PR表記付き）が表示され、管理画面の女優登録で DMM 検索が使えます。未設定の間は作品欄を表示しません。

myfans 等のリンクは、管理画面の女優詳細から手動で登録できます（PR表記・`rel="sponsored"` 付きで表示）。

## 本番公開（Vercel + Neon の例）

1. Neon などで PostgreSQL を用意し、`DATABASE_URL` を設定
2. Vercel にデプロイし、環境変数（`.env.example` の項目）を設定。`CRON_SECRET` は長い乱数にする
3. `bun run db:migrate` と `bun run seed` を本番DBに対して実行
4. `OPERATOR_NAME` / `OPERATOR_CONTACT`（運営者情報）を必ず設定してから公開する

## 意図的に入れていない機能

- 顔写真の照合による、名前を伏せて働いている方とAV女優の結び付け（本人の同意がある場合に限る形なら追加可能）
- 許可のない取り込み元からの自動取得

## 起動手順

1. 依存関係を用意します: `bun install`
2. `.env.local` を用意し、`bun run db:migrate` でテーブルを作成します
3. アプリを起動します: `bun run dev`
4. ブラウザで http://localhost:3000 を開きます（年齢確認のあとトップが表示されます）

## 運用

- 日次: 管理画面のダッシュボードで「直近の取り込み結果」が成功になっているか、「未対応の削除依頼」がないかを確認します。
- 週次: データベースのバックアップ（`pg_dump`）を取得します。「根拠の再確認が必要な在籍」を確認します。
- 月次: 使われていないお店アカウントを棚卸しし、取り込み元の許可が継続しているかを確認します。
- 設定値（環境変数）を変更したときは、アプリを再起動して反映を確認します。

## 障害時の一次対応

1. 画面が開かないときは、アプリを再起動します。
2. 出勤が更新されないときは、管理画面「取り込み元」の実行履歴でエラー内容を確認し、「今すぐ実行」で再実行します。取り込み元のページの作りが変わった場合は、読み取り部品の修正が必要です。
3. データベースに接続できないメッセージが出ている場合は、`DATABASE_URL` の接続先を確認します。
4. 復旧しない場合は、起動時のメッセージ（ログ）を保存し、開発担当へ連絡します。


<!-- 以下は保守性チェックにより追記された節です (既存の記載は変更していません) -->

## 起動手順

1. 依存関係を用意します: `npm install`
3. アプリを起動します: `npm run dev`
4. ブラウザで http://localhost:3000 を開きます


<!-- 以下は保守性チェックにより追記された節です (既存の記載は変更していません) -->

## 起動手順

1. 依存関係を用意します: `npm install`
3. アプリを起動します: `npm run dev`
4. ブラウザで http://localhost:3000 を開きます

## 🎓 はじめての方へ (オンボーディングガイド)

このシステムには初心者向けガイドが組み込まれています:

- **WelcomeBanner**: ダッシュボード上部に表示される3ステップガイド
- **QuickStartCard**: 「次にやること」を提示するカード
- **HelpTooltip**: 各項目の脇にある「？」マーク (クリックで説明)
- **ShowGuideButton**: どの画面からでもガイドを呼び戻すボタン

### ガイドを閉じたあと、もう一度見たいとき

ガイドの右上の「✕」を押すと非表示になりますが、**同じ場所に「💡 使い方ガイドを表示」ボタンが残ります**。
そのボタンを押すと、いつでもガイドが元どおり表示されます。特別な操作は不要です。

ダッシュボード以外の画面からも呼び戻せるようにしたい場合は、ヘッダーや設定画面に
`<ShowGuideButton />` を置いてください (押すとガイドのある画面へ移動して再表示します)。
