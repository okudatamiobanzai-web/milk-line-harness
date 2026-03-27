'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import Header from '@/components/layout/header'
import FlexMessagePreview from '@/components/scenarios/flex-preview'

// ─── Types ────────────────────────────────────────────────────────────────────

interface AutoReply {
  id: string
  keyword: string
  match_type: string
  response_type: string
  response_content: string
  is_active: number
  created_at: string
}

interface FlexTemplate {
  id: string
  name: string
  description: string
  category: 'lp' | 'card' | 'survey' | 'info' | 'carousel'
  icon: string
  color: string
  json: object
}

// ─── Flex Templates Gallery ───────────────────────────────────────────────────

const FLEX_TEMPLATES: FlexTemplate[] = [
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

// ─── Page Component ───────────────────────────────────────────────────────────

export default function AutoRepliesPage() {
  const [rules, setRules] = useState<AutoReply[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Editor state
  const [editingRule, setEditingRule] = useState<AutoReply | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [editorKeyword, setEditorKeyword] = useState('')
  const [editorMatchType, setEditorMatchType] = useState('exact')
  const [editorResponseType, setEditorResponseType] = useState('flex')
  const [editorContent, setEditorContent] = useState('')
  const [editorJsonError, setEditorJsonError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Template gallery
  const [showTemplates, setShowTemplates] = useState(false)

  // Flex preview
  const [previewRule, setPreviewRule] = useState<string | null>(null)

  // Test send
  const [sendingTest, setSendingTest] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null)

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.autoReplies.list()
      if (res.success) setRules(res.data)
      else setError(res.error || '取得失敗')
    } catch { setError('通信エラー') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  // ─── Editor helpers ───

  const openCreate = (template?: FlexTemplate) => {
    setEditingRule(null)
    setIsCreating(true)
    setEditorKeyword('')
    setEditorMatchType('exact')
    setEditorResponseType(template ? 'flex' : 'flex')
    setEditorContent(template ? JSON.stringify(template.json, null, 2) : '')
    setEditorJsonError('')
    setSaveError('')
    setShowTemplates(false)
  }

  const openEdit = (rule: AutoReply) => {
    setEditingRule(rule)
    setIsCreating(false)
    setEditorKeyword(rule.keyword)
    setEditorMatchType(rule.match_type)
    setEditorResponseType(rule.response_type)
    // Pretty-print JSON for flex
    if (rule.response_type === 'flex') {
      try {
        setEditorContent(JSON.stringify(JSON.parse(rule.response_content), null, 2))
        setEditorJsonError('')
      } catch {
        setEditorContent(rule.response_content)
        setEditorJsonError('JSONパースエラー')
      }
    } else {
      setEditorContent(rule.response_content)
      setEditorJsonError('')
    }
    setSaveError('')
    setShowTemplates(false)
  }

  const closeEditor = () => {
    setEditingRule(null)
    setIsCreating(false)
  }

  const validateAndSave = async () => {
    if (!editorKeyword.trim()) { setSaveError('キーワードを入力してください'); return }
    if (!editorContent.trim()) { setSaveError('応答内容を入力してください'); return }

    // Validate JSON for flex
    if (editorResponseType === 'flex') {
      try { JSON.parse(editorContent) } catch {
        setSaveError('Flex JSONの形式が不正です')
        return
      }
    }

    setSaving(true)
    setSaveError('')
    try {
      if (isCreating) {
        const res = await api.autoReplies.create({
          keyword: editorKeyword,
          matchType: editorMatchType,
          responseType: editorResponseType,
          responseContent: editorResponseType === 'flex' ? JSON.stringify(JSON.parse(editorContent)) : editorContent,
        })
        if (!res.success) { setSaveError(res.error || '作成失敗'); return }
      } else if (editingRule) {
        const res = await api.autoReplies.update(editingRule.id, {
          keyword: editorKeyword,
          matchType: editorMatchType,
          responseType: editorResponseType,
          responseContent: editorResponseType === 'flex' ? JSON.stringify(JSON.parse(editorContent)) : editorContent,
        })
        if (!res.success) { setSaveError(res.error || '更新失敗'); return }
      }
      closeEditor()
      fetchRules()
    } catch { setSaveError('保存に失敗しました') }
    finally { setSaving(false) }
  }

  const deleteRule = async (id: string, keyword: string) => {
    if (!confirm(`「${keyword}」の自動応答を削除しますか？`)) return
    try {
      await api.autoReplies.delete(id)
      fetchRules()
    } catch { setError('削除に失敗しました') }
  }

  const toggleActive = async (rule: AutoReply) => {
    try {
      await api.autoReplies.update(rule.id, { isActive: !rule.is_active })
      fetchRules()
    } catch { setError('状態変更に失敗しました') }
  }

  const sendTest = async (rule: AutoReply) => {
    setSendingTest(rule.id)
    setTestResult(null)
    try {
      const friendId = '85f12d27-5264-45f9-b704-4f3cb1399d19' // ryutaro
      const res = await api.friends.sendMessage(friendId, {
        messageType: rule.response_type,
        content: rule.response_content,
      })
      setTestResult({ id: rule.id, ok: res.success, msg: res.success ? '送信しました！LINEを確認' : (res.error || '送信失敗') })
    } catch {
      setTestResult({ id: rule.id, ok: false, msg: '送信失敗' })
    } finally {
      setSendingTest(null)
      setTimeout(() => setTestResult(null), 3000)
    }
  }

  // ─── JSON content change with validation ───
  const handleContentChange = (val: string) => {
    setEditorContent(val)
    if (editorResponseType === 'flex') {
      try { JSON.parse(val); setEditorJsonError('') }
      catch (e) { setEditorJsonError(String(e).split('\n')[0]) }
    }
  }

  // ─── Render ───

  const isEditorOpen = isCreating || editingRule !== null

  return (
    <div>
      <Header
        title="自動応答"
        description="キーワードマッチで自動返信するFlex Messageを管理"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowTemplates(true)}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#9C27B0' }}
            >
              + テンプレートから作成
            </button>
            <button
              onClick={() => openCreate()}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#06C755' }}
            >
              + 新規作成
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* ─── Template Gallery Modal ─── */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowTemplates(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-900">テンプレートギャラリー</h2>
                <p className="text-sm text-gray-500">テンプレートを選んで、内容をカスタマイズしてください</p>
              </div>
              <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-gray-600 text-xl p-2">✕</button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {FLEX_TEMPLATES.map((t) => (
                  <div
                    key={t.id}
                    className="border border-gray-200 rounded-xl overflow-hidden hover:border-gray-400 hover:shadow-md transition-all cursor-pointer group"
                    onClick={() => openCreate(t)}
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
                        <FlexMessagePreview content={JSON.stringify(t.json)} onClose={() => {}} />
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
      )}

      {/* ─── Editor Modal ─── */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeEditor}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <h2 className="text-lg font-bold text-gray-900">{isCreating ? '新しい自動応答を作成' : `「${editingRule?.keyword}」を編集`}</h2>
              <button onClick={closeEditor} className="text-gray-400 hover:text-gray-600 text-xl p-2">✕</button>
            </div>

            {/* Body: 2 column layout */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left: Editor */}
              <div className="flex-1 p-6 overflow-y-auto border-r">
                <div className="space-y-4 max-w-lg">
                  {/* Keyword */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">キーワード <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="例: 営業時間を教えて"
                      value={editorKeyword}
                      onChange={(e) => setEditorKeyword(e.target.value)}
                    />
                  </div>

                  {/* Match type + Response type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">マッチ方法</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        value={editorMatchType}
                        onChange={(e) => setEditorMatchType(e.target.value as 'exact' | 'contains')}
                      >
                        <option value="exact">完全一致</option>
                        <option value="contains">部分一致</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">応答タイプ</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        value={editorResponseType}
                        onChange={(e) => setEditorResponseType(e.target.value as 'text' | 'flex')}
                      >
                        <option value="flex">Flex Message</option>
                        <option value="text">テキスト</option>
                      </select>
                    </div>
                  </div>

                  {/* Content editor */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-gray-600">
                        {editorResponseType === 'flex' ? 'Flex JSON' : 'テキスト'} <span className="text-red-500">*</span>
                      </label>
                      {editorJsonError && <span className="text-xs text-red-500">{editorJsonError}</span>}
                      {editorResponseType === 'flex' && !editorJsonError && editorContent && (
                        <span className="text-xs text-green-600">✓ 有効なJSON</span>
                      )}
                    </div>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                      rows={20}
                      placeholder={editorResponseType === 'flex' ? '{\n  "type": "bubble",\n  ...\n}' : 'メッセージ内容を入力'}
                      value={editorContent}
                      onChange={(e) => handleContentChange(e.target.value)}
                      style={{ lineHeight: '1.5' }}
                    />
                    <p className="text-xs text-gray-400 mt-1">{editorContent.length.toLocaleString()} 文字</p>
                  </div>

                  {/* Postback helper */}
                  {editorResponseType === 'flex' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-medium text-blue-700 mb-1">💡 postbackボタンの書き方</p>
                      <code className="text-[10px] text-blue-600 block whitespace-pre-wrap">{`"action": {
  "type": "postback",
  "label": "ボタン名",
  "data": "action=tag&tag=タグ名&reply=応答テキスト&notify=true",
  "displayText": "ユーザーに表示されるテキスト"
}`}</code>
                    </div>
                  )}

                  {saveError && <p className="text-sm text-red-600">{saveError}</p>}
                </div>
              </div>

              {/* Right: Preview */}
              <div className="w-[380px] shrink-0 bg-gray-50 p-6 overflow-y-auto">
                <p className="text-xs font-medium text-gray-500 mb-3">LINEプレビュー</p>
                {editorResponseType === 'flex' && editorContent && !editorJsonError ? (
                  <div className="bg-[#7494C0] rounded-2xl p-4 min-h-[300px]">
                    <FlexMessagePreview content={editorContent} onClose={() => {}} />
                  </div>
                ) : editorResponseType === 'text' && editorContent ? (
                  <div className="bg-[#7494C0] rounded-2xl p-4 min-h-[200px]">
                    <div className="bg-white rounded-xl px-4 py-3 max-w-[260px] shadow-sm">
                      <p className="text-sm whitespace-pre-wrap">{editorContent}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[200px] text-gray-400 text-sm">
                    内容を入力するとプレビューが表示されます
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50 shrink-0">
              <button onClick={closeEditor} className="px-4 py-2 min-h-[44px] text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition-colors">
                キャンセル
              </button>
              <button
                onClick={validateAndSave}
                disabled={saving}
                className="px-6 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#06C755' }}
              >
                {saving ? '保存中...' : isCreating ? '作成' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Rules List ─── */}
      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-100 rounded w-2/3" />
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500 mb-4">自動応答ルールがありません</p>
          <button
            onClick={() => setShowTemplates(true)}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: '#06C755' }}
          >
            テンプレートから作成
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  {/* Left: Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${rule.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {rule.is_active ? '有効' : '無効'}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-600">
                        {rule.match_type === 'exact' ? '完全一致' : '部分一致'}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-600">
                        {rule.response_type === 'flex' ? 'Flex' : 'テキスト'}
                      </span>
                      <span className="text-xs text-gray-400">{rule.response_content.length.toLocaleString()} chars</span>
                    </div>
                    <p className="text-base font-semibold text-gray-900 mb-1">「{rule.keyword}」</p>

                    {/* Mini preview */}
                    {rule.response_type === 'flex' && (
                      <button
                        onClick={() => setPreviewRule(previewRule === rule.id ? null : rule.id)}
                        className="text-xs text-purple-600 hover:text-purple-700 mt-1"
                      >
                        {previewRule === rule.id ? '▲ プレビューを閉じる' : '▼ プレビューを表示'}
                      </button>
                    )}
                    {rule.response_type === 'text' && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{rule.response_content}</p>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => sendTest(rule)}
                      disabled={sendingTest === rule.id}
                      className="text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 transition-colors min-h-[36px] flex items-center disabled:opacity-50"
                    >
                      {sendingTest === rule.id ? '送信中...' : '📤 テスト'}
                    </button>
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`text-xs px-2 py-1 rounded transition-colors min-h-[36px] flex items-center ${rule.is_active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                    >
                      {rule.is_active ? '⏸ 無効化' : '▶ 有効化'}
                    </button>
                    <button
                      onClick={() => openEdit(rule)}
                      className="text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50 transition-colors min-h-[36px] flex items-center"
                    >
                      ✏️ 編集
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id, rule.keyword)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors min-h-[36px] flex items-center"
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Test result */}
                {testResult && testResult.id === rule.id && (
                  <div className={`mt-2 text-xs px-3 py-1.5 rounded-md ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {testResult.msg}
                  </div>
                )}
              </div>

              {/* Expanded preview */}
              {previewRule === rule.id && rule.response_type === 'flex' && (
                <div className="border-t bg-gray-50 p-4">
                  <div className="bg-[#7494C0] rounded-2xl p-4 max-w-[340px] mx-auto">
                    <FlexMessagePreview content={rule.response_content} onClose={() => setPreviewRule(null)} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
