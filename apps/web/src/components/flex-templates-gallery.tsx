'use client'

/**
 * Shared Flex template gallery data + gallery modal component.
 * Used by both templates/page.tsx and auto-replies/page.tsx.
 */

import { InlineFlexPreview } from '@/components/scenarios/flex-preview'

export interface FlexTemplate {
  id: string
  name: string
  description: string
  category: 'lp' | 'card' | 'survey' | 'info' | 'carousel'
  icon: string
  color: string
  json: object
}

export const FLEX_TEMPLATES: FlexTemplate[] = [
  {
    id: 'lp-hero',
    name: 'LP風ヒーロー',
    description: '色付きヘッダー + ステップ説明 + CTAボタン',
    category: 'lp',
    icon: '📄',
    color: '#2196F3',
    json: {
      type: "bubble", size: "giga",
      header: { type: "box", layout: "vertical", paddingAll: "20px", backgroundColor: "#2196F3", contents: [
        { type: "text", text: "タイトルを入力", color: "#ffffff", size: "xl", weight: "bold" },
        { type: "text", text: "サブタイトルを入力", color: "#ffffffaa", size: "xs", margin: "sm" }
      ]},
      body: { type: "box", layout: "vertical", spacing: "lg", paddingAll: "20px", contents: [
        { type: "text", text: "ここに説明文を入力。サービスの特徴や魅力を伝えましょう。", size: "sm", wrap: true, color: "#555555" },
        { type: "separator" },
        { type: "box", layout: "vertical", spacing: "md", contents: [
          { type: "box", layout: "horizontal", spacing: "md", contents: [
            { type: "box", layout: "vertical", width: "28px", height: "28px", cornerRadius: "14px", backgroundColor: "#2196F3", justifyContent: "center", alignItems: "center", contents: [
              { type: "text", text: "1", color: "#ffffff", size: "sm", weight: "bold", align: "center" }
            ]},
            { type: "text", text: "ステップ1の説明", size: "sm", wrap: true, flex: 1 }
          ]},
          { type: "box", layout: "horizontal", spacing: "md", contents: [
            { type: "box", layout: "vertical", width: "28px", height: "28px", cornerRadius: "14px", backgroundColor: "#2196F3", justifyContent: "center", alignItems: "center", contents: [
              { type: "text", text: "2", color: "#ffffff", size: "sm", weight: "bold", align: "center" }
            ]},
            { type: "text", text: "ステップ2の説明", size: "sm", wrap: true, flex: 1 }
          ]},
          { type: "box", layout: "horizontal", spacing: "md", contents: [
            { type: "box", layout: "vertical", width: "28px", height: "28px", cornerRadius: "14px", backgroundColor: "#2196F3", justifyContent: "center", alignItems: "center", contents: [
              { type: "text", text: "3", color: "#ffffff", size: "sm", weight: "bold", align: "center" }
            ]},
            { type: "text", text: "ステップ3の説明", size: "sm", wrap: true, flex: 1 }
          ]}
        ]}
      ]},
      footer: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", contents: [
        { type: "button", action: { type: "postback", label: "ボタン1", data: "action=tag&tag=example:tag1&reply=応答テキスト", displayText: "ボタン1をタップ" }, style: "primary", color: "#2196F3", height: "sm" },
        { type: "button", action: { type: "message", label: "ボタン2", text: "キーワード" }, style: "link", height: "sm" }
      ]}
    }
  },
  {
    id: 'info-card',
    name: '情報カード',
    description: 'ヘッダー + 情報一覧 + フッターボタン',
    category: 'card',
    icon: '💳',
    color: '#06C755',
    json: {
      type: "bubble",
      header: { type: "box", layout: "vertical", paddingAll: "20px", backgroundColor: "#06C755", contents: [
        { type: "text", text: "カードタイトル", color: "#ffffff", size: "lg", weight: "bold" },
        { type: "text", text: "補足テキスト", color: "#ffffffaa", size: "xs", margin: "sm" }
      ]},
      body: { type: "box", layout: "vertical", spacing: "md", paddingAll: "20px", contents: [
        { type: "box", layout: "horizontal", contents: [
          { type: "text", text: "項目A", size: "sm", flex: 1, color: "#666666" },
          { type: "text", text: "内容A", size: "sm", weight: "bold", align: "end", flex: 1 }
        ]},
        { type: "separator" },
        { type: "box", layout: "horizontal", contents: [
          { type: "text", text: "項目B", size: "sm", flex: 1, color: "#666666" },
          { type: "text", text: "内容B", size: "sm", weight: "bold", align: "end", flex: 1 }
        ]},
        { type: "separator" },
        { type: "box", layout: "horizontal", contents: [
          { type: "text", text: "項目C", size: "sm", flex: 1, color: "#666666" },
          { type: "text", text: "内容C", size: "sm", weight: "bold", align: "end", flex: 1 }
        ]},
        { type: "separator" },
        { type: "text", text: "補足情報を入力", size: "xs", color: "#999999", wrap: true, margin: "md" }
      ]},
      footer: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", contents: [
        { type: "button", action: { type: "uri", label: "詳しくはこちら", uri: "https://example.com" }, style: "primary", color: "#06C755", height: "sm" }
      ]}
    }
  },
  {
    id: 'survey-buttons',
    name: 'アンケート風',
    description: '質問 + 選択肢ボタン（postbackでタグ付与）',
    category: 'survey',
    icon: '📊',
    color: '#9C27B0',
    json: {
      type: "bubble",
      header: { type: "box", layout: "vertical", paddingAll: "20px", backgroundColor: "#9C27B0", contents: [
        { type: "text", text: "質問タイトル", color: "#ffffff", size: "lg", weight: "bold" }
      ]},
      body: { type: "box", layout: "vertical", spacing: "md", paddingAll: "20px", contents: [
        { type: "text", text: "タップで教えてください！回答はボタンを押すだけ😊", size: "sm", wrap: true, color: "#555555" },
        { type: "separator" },
        { type: "text", text: "あなたに合ったものをタップ👇", size: "xs", color: "#999999" }
      ]},
      footer: { type: "box", layout: "vertical", spacing: "sm", paddingAll: "16px", contents: [
        { type: "box", layout: "horizontal", spacing: "sm", contents: [
          { type: "button", action: { type: "postback", label: "選択肢A", data: "action=tag&tag=category:a&reply=Aを選んだんですね！", displayText: "Aを選択" }, style: "primary", color: "#9C27B0", height: "sm" },
          { type: "button", action: { type: "postback", label: "選択肢B", data: "action=tag&tag=category:b&reply=Bを選んだんですね！", displayText: "Bを選択" }, style: "primary", color: "#FF9800", height: "sm" }
        ]},
        { type: "box", layout: "horizontal", spacing: "sm", contents: [
          { type: "button", action: { type: "postback", label: "選択肢C", data: "action=tag&tag=category:c&reply=Cを選んだんですね！", displayText: "Cを選択" }, style: "primary", color: "#4CAF50", height: "sm" },
          { type: "button", action: { type: "postback", label: "選択肢D", data: "action=tag&tag=category:d&reply=Dを選んだんですね！", displayText: "Dを選択" }, style: "primary", color: "#2196F3", height: "sm" }
        ]}
      ]}
    }
  },
  {
    id: 'simple-notify',
    name: 'シンプル案内',
    description: 'ヘッダー + 短い説明 + ボタン',
    category: 'info',
    icon: '💬',
    color: '#455A64',
    json: {
      type: "bubble",
      header: { type: "box", layout: "vertical", paddingAll: "20px", backgroundColor: "#455A64", contents: [
        { type: "text", text: "お知らせタイトル", color: "#ffffff", size: "lg", weight: "bold" }
      ]},
      body: { type: "box", layout: "vertical", spacing: "md", paddingAll: "20px", contents: [
        { type: "text", text: "ここにお知らせの内容を書いてください。簡潔にまとめましょう。", size: "sm", wrap: true, color: "#555555" }
      ]},
      footer: { type: "box", layout: "vertical", paddingAll: "16px", contents: [
        { type: "button", action: { type: "message", label: "了解！", text: "了解" }, style: "primary", color: "#455A64", height: "sm" }
      ]}
    }
  },
  {
    id: 'carousel-faq',
    name: 'カルーセルQ&A',
    description: 'スワイプできるQ&Aカード2枚',
    category: 'carousel',
    icon: '📚',
    color: '#607D8B',
    json: {
      type: "carousel",
      contents: [
        {
          type: "bubble",
          header: { type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: "#607D8B", contents: [
            { type: "text", text: "Q&A 1/2", color: "#ffffff", size: "md", weight: "bold" }
          ]},
          body: { type: "box", layout: "vertical", spacing: "lg", paddingAll: "16px", contents: [
            { type: "box", layout: "vertical", spacing: "sm", contents: [
              { type: "text", text: "Q. 質問1", weight: "bold", size: "sm" },
              { type: "text", text: "A. 回答1", size: "xs", color: "#666666", wrap: true }
            ]},
            { type: "separator" },
            { type: "box", layout: "vertical", spacing: "sm", contents: [
              { type: "text", text: "Q. 質問2", weight: "bold", size: "sm" },
              { type: "text", text: "A. 回答2", size: "xs", color: "#666666", wrap: true }
            ]}
          ]}
        },
        {
          type: "bubble",
          header: { type: "box", layout: "vertical", paddingAll: "16px", backgroundColor: "#607D8B", contents: [
            { type: "text", text: "Q&A 2/2", color: "#ffffff", size: "md", weight: "bold" }
          ]},
          body: { type: "box", layout: "vertical", spacing: "lg", paddingAll: "16px", contents: [
            { type: "box", layout: "vertical", spacing: "sm", contents: [
              { type: "text", text: "Q. 質問3", weight: "bold", size: "sm" },
              { type: "text", text: "A. 回答3", size: "xs", color: "#666666", wrap: true }
            ]},
            { type: "separator" },
            { type: "box", layout: "vertical", spacing: "sm", contents: [
              { type: "text", text: "Q. 質問4", weight: "bold", size: "sm" },
              { type: "text", text: "A. 回答4", size: "xs", color: "#666666", wrap: true }
            ]}
          ]},
          footer: { type: "box", layout: "vertical", paddingAll: "12px", contents: [
            { type: "button", action: { type: "message", label: "他にも質問する", text: "質問があります" }, style: "primary", color: "#607D8B", height: "sm" }
          ]}
        }
      ]
    }
  },
]

const categoryLabels: Record<string, string> = {
  lp: 'LP風',
  card: 'カード',
  survey: 'アンケート',
  info: 'シンプル',
  carousel: 'カルーセル',
}

export function FlexTemplateGallery({ onSelect, onClose }: { onSelect: (t: FlexTemplate) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-bold text-gray-900">テンプレートギャラリー</h2>
            <p className="text-sm text-gray-500">テンプレートを選んで、内容をカスタマイズしてください</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl p-2">✕</button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FLEX_TEMPLATES.map((t) => (
              <div
                key={t.id}
                className="border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => onSelect(t)}
              >
                <div className="p-4" style={{ backgroundColor: t.color + '10' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{t.icon}</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{t.name}</p>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: t.color + '20', color: t.color }}>{categoryLabels[t.category]}</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                </div>
                <div className="p-3 bg-gray-50 border-t" style={{ maxHeight: '200px', overflow: 'hidden' }}>
                  <div className="transform scale-[0.6] origin-top-left" style={{ width: '166%' }}>
                    <InlineFlexPreview content={JSON.stringify(t.json)} />
                  </div>
                </div>
                <div className="px-4 py-3 bg-white border-t text-center">
                  <span className="text-xs font-medium text-green-600 group-hover:text-green-700">このテンプレートで作成 →</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
