#!/bin/bash
# milk ops LINE統合セットアップスクリプト
# 1. DB migration (009_ops.sql)
# 2. Auto-reply registration (対応報告 → カテゴリFlex)
# 3. 発注フォーム登録
# 4. リッチメニュー Tab A' のアクション更新 (URI→message)

API_URL="https://line-crm-worker.milk-crm.workers.dev"
API_KEY="milk-harness-2026-secretkey-ryutaro"

echo "=== milk ops セットアップ ==="

# ── 1. Auto-reply: "対応報告" → カテゴリ選択Flex ──
echo ""
echo "--- 1/4: 自動返信「対応報告」を登録 ---"

CATEGORY_FLEX='{
  "type": "bubble",
  "size": "kilo",
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {"type": "text", "text": "☕ おつかれさまです！", "weight": "bold", "size": "lg", "color": "#1a1a1a"},
      {"type": "text", "text": "何を対応しましたか？", "color": "#888888", "size": "sm", "margin": "sm"}
    ],
    "paddingAll": "16px"
  },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "spacing": "sm",
    "contents": [
      {
        "type": "box", "layout": "horizontal", "spacing": "sm",
        "contents": [
          {"type": "button", "action": {"type": "postback", "label": "📦 整理・片付け", "data": "action=ops&cat=tidy", "displayText": "📦 整理・片付け"}, "style": "secondary", "height": "md", "flex": 1},
          {"type": "button", "action": {"type": "postback", "label": "🧹 掃除", "data": "action=ops&cat=clean", "displayText": "🧹 掃除"}, "style": "secondary", "height": "md", "flex": 1}
        ]
      },
      {
        "type": "box", "layout": "horizontal", "spacing": "sm",
        "contents": [
          {"type": "button", "action": {"type": "postback", "label": "🧴 補充", "data": "action=ops&cat=restock", "displayText": "🧴 補充"}, "style": "secondary", "height": "md", "flex": 1},
          {"type": "button", "action": {"type": "postback", "label": "📮 荷物対応", "data": "action=ops&cat=parcel", "displayText": "📮 荷物対応"}, "style": "secondary", "height": "md", "flex": 1}
        ]
      }
    ],
    "paddingAll": "12px"
  }
}'

# Escape for JSON payload
FLEX_ESCAPED=$(echo "$CATEGORY_FLEX" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read().strip()))')

curl -s -X POST "$API_URL/api/auto-replies" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"keyword\": \"対応報告\",
    \"matchType\": \"exact\",
    \"responseType\": \"flex\",
    \"responseContent\": $FLEX_ESCAPED
  }" | python3 -m json.tool

# ── 2. Auto-reply: "発注したい" → LIFF フォームへ誘導 ──
echo ""
echo "--- 2/4: 自動返信「発注したい」を登録 ---"

# We'll use the form ID from step 3 — register a text reply first, then update
curl -s -X POST "$API_URL/api/auto-replies" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "発注したい",
    "matchType": "exact",
    "responseType": "text",
    "responseContent": "📦 発注依頼フォームを準備中です。もう少しお待ちください！"
  }' | python3 -m json.tool

# ── 3. 発注フォーム登録 ──
echo ""
echo "--- 3/4: 発注依頼フォームを登録 ---"

FORM_RESULT=$(curl -s -X POST "$API_URL/api/forms" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "milk ops 発注依頼",
    "description": "備品・消耗品の発注依頼フォーム",
    "fields": [
      {"name": "item_name", "label": "品名", "type": "text", "required": true, "placeholder": "例: コピー用紙 A4"},
      {"name": "reason", "label": "理由・備考", "type": "textarea", "required": false, "placeholder": "例: 残り1束になったため"},
      {"name": "urgency", "label": "緊急度", "type": "radio", "required": true, "options": ["急ぎではない", "今週中", "至急"]}
    ],
    "saveToMetadata": false
  }')

echo "$FORM_RESULT" | python3 -m json.tool

FORM_ID=$(echo "$FORM_RESULT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("data",{}).get("id","UNKNOWN"))')
echo ""
echo "→ フォームID: $FORM_ID"
echo "→ LIFF URL: https://liff.line.me/2009554425-4IMBmLQ9?page=form&id=$FORM_ID"

# ── 4. 現在のリッチメニュー情報表示 ──
echo ""
echo "--- 4/4: リッチメニュー情報 ---"
echo "Tab A' (会員メニュー) ID: richmenu-3a176683fa04e713a0ee7a564e82b072"
echo ""
echo "milk ops ボタンを message アクションに変更するには、"
echo "LINE Developers Console でリッチメニューを再作成するか、"
echo "管理画面のリッチメニューエディタから更新してください。"
echo ""
echo "変更内容:"
echo "  milk ops:  URI → message アクション「対応報告」"
echo "  発注依頼:   URI → message アクション「発注したい」"
echo ""
echo "=== セットアップ完了 ==="
echo ""
echo "次のステップ:"
echo "  1. wrangler d1 execute milk-crm-db --file=packages/db/migrations/009_ops.sql"
echo "  2. 管理画面でリッチメニューのアクションを更新"
echo "  3. 「発注したい」の自動返信をLIFFフォームURLに更新"
echo "     → LIFF URL: https://liff.line.me/2009554425-4IMBmLQ9?page=form&id=$FORM_ID"
