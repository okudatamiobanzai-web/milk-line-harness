# Changelog

## v0.3.0 — milk カスタマイズ (2026-03-25〜03-27)

milk coworking 専用のカスタマイズ。56コミット、5日間で構築。

### Upgrade
```bash
wrangler d1 execute line-crm --file=packages/db/migrations/009_ops.sql --remote
```

### New Features

#### リッチメニュー管理画面
- リッチメニュー一覧表示（AuthImage: 認証付き画像表示）
- ビジュアルエリアエディタ（ドラッグで矩形描画→エリア追加）
- 画像アップロード（ドラッグ&ドロップ対応）
- milkプリセット（Tab A/B 3×2グリッド自動入力）
- エイリアスCRUD（タブ切替用）
- デフォルト設定・友だち個別割当
- Worker: Alias API 5エンドポイント + 画像ダウンロードプロキシ
- line-sdk: PUT対応 + Alias/Image Downloadメソッド

#### 3タブリッチメニュー
- Tab A「milkを使う」（非会員デフォルト）— 営業時間/はじめての方へ/質問/見学予約/FAQ/地域切替
- Tab A'「milkメンバー」（月額会員）— milk ops/発注依頼/会員グループ/地域切替
- Tab B「地域とつながる」（全ユーザー共通）— ゆびとま/ミセル/しるべ旅

#### 自動応答 + プロファイリング
- キーワードマッチ自動応答8件（Flex Message + postbackタグ付与）
- 自動応答管理ページ（Flexプレビュー付き、Worker PUT対応）
- テンプレートギャラリー（9テンプレート）
- AI返信プロンプト（子連れ無料・学生・雰囲気対応）
- プロファイリング用タグ11種（interest:dropin, purpose:work 等）

#### ステップ配信
- 30日ステップ配信シナリオ（LP風Flex 8通、friend_addトリガー）
- postbackボタンからタグ自動付与
- テスト送信ボタン（友だちセレクター付き）
- Flexビジュアルプレビューモーダル

#### milk ops（備品管理LINE統合）
- ops.tsルート + services/ops.ts（タスク報告・発注承認フロー）
- DBテーブル: ops_reports, ops_orders
- LIFFチェックボックスUI（apps/liff/src/ops.ts）
- postbackワンタップ報告（LIFF未デプロイのためフォールバック）
- 5カテゴリ: 整理/掃除/補充/荷物/発注

#### 管理画面 UI
- LINE配信枠ウィジェット（月200通無料枠 残り表示）
- InlineFlexPreview（モーダル不要のインラインプレビュー）
- ビジュアルエリアプレビュー（リッチメニュー画像上に色分けオーバーレイ）

### CI/CD
- deploy-web.yml: Cloudflare Pages自動デプロイ
- deploy-liff.yml: LIFF自動デプロイ
- NEXT_PUBLIC_API_URL ビルド時注入
- D1マイグレーション自動実行（continue-on-error）

### Bug Fixes
- README内リポジトリURL修正（Shudesu/line-harness-oss → okudatamiobanzai-web/milk-line-harness）
- CcPromptButton props形式統一
- wrangler-action → npx wrangler@3（monorepo対応）
- AuthImage: fetchImageBlob使用（認証付き画像取得）

---

## v0.2.0 (2026-03-25)

### Breaking Changes
- **DB Schema**: `line_account_id` column added to `friends`, `scenarios`, `broadcasts`, `reminders`, `automations`, `chats`
- **DB Schema**: `login_channel_id`, `login_channel_secret`, `liff_id` columns added to `line_accounts`
- **Timestamps**: All timestamps standardized to JST (+09:00). Existing UTC data is compatible via epoch comparison.

### Upgrade
```bash
wrangler d1 execute line-crm --file=packages/db/migrations/008_multi_account.sql --remote
```

### New Features
- **Multi-account support** — Webhook routing, cron delivery, and admin UI per LINE account
- **Account switcher UI** — Global dropdown in sidebar, all pages filter by selected account
- **Cross-provider UUID linking** — `?uid=` param in `/auth/line` for automatic identity linking across providers
- **Template variable expansion** — `{{name}}`, `{{uid}}`, `{{auth_url:CHANNEL_ID}}` in scenario messages
- **Delivery window** — 9:00-23:00 JST enforcement, per-user preferred hour via "配信時間はN時"
- **replyMessage for welcome** — First step (delay=0) uses free replyMessage instead of pushMessage
- **Bot profile in admin** — Account cards show LINE profile picture, display name, basic ID
- **Account stats** — Per-account friend count, active scenarios, monthly message count
- **GitHub Actions CI/CD** — Auto-deploy Worker on push to main
- **OAuth direct redirect** — `/auth/line` redirects to LINE Login OAuth directly (no LIFF needed)
- **Friend-add redirect** — After OAuth callback, auto-redirect to `line.me/R/ti/p/{basicId}`

### Bug Fixes
- JST timestamp standardization (was UTC, causing wrong delivery times)
- Auth unification (affiliates page + login fallback URL)
