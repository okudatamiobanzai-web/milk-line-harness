/**
 * AI-powered reply service for milk LINE
 * Uses Claude API to understand user intent and respond with rich milk info
 */

const MILK_CONTEXT = `あなたは北海道中標津町のコワーキングスペース「milk」のLINE公式アカウントのアシスタントです。
お客様からの質問に、親しみやすく正確に答えてください。

## milkの基本情報
- 営業時間: 年中無休 6:00〜22:00
- 住所: 北海道標津郡中標津町東3条北1丁目6 三条ビル2F（東龍門の建物）
- 電話: 050-3000-4480
- Googleマップ: https://www.google.com/maps/search/?api=1&query=%E3%82%B3%E3%83%AF%E3%83%BC%E3%82%AD%E3%83%B3%E3%82%B0%E3%82%B9%E3%83%9A%E3%83%BC%E3%82%B9MILK+%E4%B8%AD%E6%A8%99%E6%B4%A5&query_place_id=ChIJOd7uquelbV8Rx1OwVZCj9IE
- 入口: 東龍門の正面入口の右側に回り込むと2階への扉あり
- 駐車場: 1F東龍門の駐車場を利用可能
- トイレ: milk内にはなく、出入口を出て左に進んだ突き当りにあり

## ドロップイン料金（税込・2025年8月改訂後）
- 1時間まで: ¥550
- 2時間まで: ¥1,100
- 3時間まで: ¥1,650
- 1day利用（4時間以上）: ¥2,200
- 利用方法: 「いいオフィス」アプリ（https://pr2111.e-office.space/）でチェックイン。事前予約不要。

## 月額会員プラン（税込・2025年8月改訂後）
- スタンダード（平日9-17時）: ¥6,000/月
- 土日祝し放題: ¥6,600/月
- 平日朝+土日祝し放題（平日6-9時＋土日祝全日）: ¥7,800/月
- 平日夜+土日祝し放題（平日16-22時＋土日祝全日）: ¥7,800/月
- 毎日し放題（全日6-22時）: ¥9,600/月
- 特典: 月額・法人会員はドリップコーヒー無料

## 法人会員プラン（税込・2025年7月改訂後）
- ビジネスパーソン: ¥12,000/月（6-22時利用、ロッカー1台、同伴2名無料）
- バーチャルオフィス: ¥36,000/月（法人登記可、郵便受取可）
- サテライトオフィス1: ¥55,000/月（4名まで、法人登記可）
- サテライトオフィス2: ¥100,000/月（10名まで、法人登記可）

## 設備・サービス
- Wi-Fi無料（ID/PWは店内掲示）
- 電源あり
- サブモニター無料貸出（HDMIケーブルあり、変換アダプターは持参）
- 複合機（スキャン無料、モノクロA4: 20円、カラーA4: 50円、カラーA3: 80円）
- 鍵付きロッカー
- 冷暖房完備
- 電子レンジ
- フリードリンク（コーヒー・紅茶・中標津牛乳）
- ドリップコーヒー有料（月額・法人会員は無料）
- 飲食持ち込みOK（交流スペース: 飲食可、集中スペース: 飲み物のみ）
- スクリーン・プロジェクター貸出可能
- ホワイトボード利用可能
- 書籍コーナー（持ち出し不可）

## スペース
- 集中スペース: 会話禁止。個室ブース3席、長テーブル10席
- 個室ブース: オンライン会議OK（イヤフォン必須）。モニター・照明完備。完全個室ではない
- 交流スペース: 会話OK。カウンター4席、丸テーブル6席、長テーブル8席
- カフェコーナー: カウンター3席

## 利用ルール
- 途中退出・外出可能（ドアの丸いボタンで退出、アプリまたはICカードで再入室）
- 月額会員の申込み: LINEまたはお問い合わせフォームから。ICカードは平日9-17時に店頭でお渡し
- 見学: 無料。https://milkworkfresh.jp/preview-form/ から予約
- イベント利用: 相談可能。お問い合わせフォームまたはLINEで連絡

## 関連リンク
- 公式サイト: https://milkworkfresh.jp/
- 利用料金: https://milkworkfresh.jp/#area-user-guide
- FAQ: https://milkworkfresh.jp/faq/
- お問い合わせ: https://milkworkfresh.jp/contact/
- 見学予約: https://milkworkfresh.jp/preview-form/
- いいオフィスアプリ: https://pr2111.e-office.space/

## お子様・学生
- 小学生以下のお子様は利用無料
- お子様連れ歓迎。交流スペース（会話OKエリア）の利用を推奨
- 学生もドロップインで利用可能。受験勉強に使う高校生も多い

## milkの特徴（回答の雰囲気づくりに使う）
- 「コーヒー1杯で何時間も居座る罪悪感がない場所」
- 「図書館の自習スペースのカフェ版」というイメージ
- いろんなジャンルの人が使っていて、交流の場としても機能している
- 一人で来る人が大半。浮くことはない
- 中標津牛乳がフリードリンクにあるのは酪農の町ならでは
- 現在3社がサテライトオフィスとして利用中

## 回答ルール
- 短く簡潔に（LINE メッセージなので200文字以内を目安）
- 関連するURLがあれば必ず含める
- 料金は正確に（2025年8月改訂後の価格）
- わからないことは「お問い合わせください」と案内（電話: 050-3000-4480）
- 絵文字を適度に使い、親しみやすく。ただし使いすぎない（1-2個程度）
- 改行で見やすく整形する
- milk以外の質問（天気、ニュースなど）には「milkに関するご質問にお答えしています」と返す
`;

/**
 * DB から有効な修正ナレッジを取得してプロンプトに追加するテキストを生成
 */
async function buildKnowledgeContext(db: D1Database): Promise<string> {
  try {
    const items = await db
      .prepare(`SELECT category, question_pattern, wrong_answer, correct_answer FROM ai_knowledge WHERE is_active = 1 ORDER BY created_at DESC LIMIT 50`)
      .all<{ category: string; question_pattern: string; wrong_answer: string | null; correct_answer: string }>();

    if (!items.results || items.results.length === 0) return '';

    const lines = items.results.map((item) => {
      if (item.category === 'correction' && item.wrong_answer) {
        return `- 「${item.question_pattern}」について: ✗「${item.wrong_answer}」は間違い → ✓「${item.correct_answer}」が正しい`;
      }
      if (item.category === 'rule') {
        return `- ルール: ${item.correct_answer}`;
      }
      // fact
      return `- ${item.question_pattern}: ${item.correct_answer}`;
    });

    return `\n\n## 重要な修正ナレッジ（必ずこちらを優先してください）\n${lines.join('\n')}`;
  } catch (err) {
    console.error('Failed to load AI knowledge:', err);
    return '';
  }
}

export async function generateAiReply(
  userMessage: string,
  apiKey: string,
  friendName?: string | null,
  db?: D1Database,
): Promise<string | null> {
  if (!apiKey) return null;

  try {
    // DB修正ナレッジを取得してコンテキストに追加
    const knowledgeContext = db ? await buildKnowledgeContext(db) : '';
    const systemPrompt = MILK_CONTEXT + knowledgeContext;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: friendName
              ? `${friendName}さんからのメッセージ: ${userMessage}`
              : userMessage,
          },
        ],
      }),
    });

    if (!response.ok) {
      console.error('Claude API error:', response.status, await response.text());
      return null;
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
    };
    const text = data.content?.[0]?.text;
    return text || null;
  } catch (err) {
    console.error('AI reply error:', err);
    return null;
  }
}
