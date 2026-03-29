'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import Header from '@/components/layout/header'
import { InlineFlexPreview } from '@/components/scenarios/flex-preview'
import FlexEditor from '@/components/flex-editor'
import { FlexTemplateGallery, type FlexTemplate } from '@/components/flex-templates-gallery'

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

  // Visual editor
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual')
  const [flexJson, setFlexJson] = useState<Record<string, unknown> | null>(null)

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
    setEditorResponseType('flex')
    const content = template ? JSON.stringify(template.json, null, 2) : ''
    setEditorContent(content)
    setEditorJsonError('')
    setSaveError('')
    setShowTemplates(false)
    setEditorMode('visual')
    if (template) {
      setFlexJson(template.json as Record<string, unknown>)
    } else {
      setFlexJson(null)
    }
  }

  const openEdit = (rule: AutoReply) => {
    setEditingRule(rule)
    setIsCreating(false)
    setEditorKeyword(rule.keyword)
    setEditorMatchType(rule.match_type)
    setEditorResponseType(rule.response_type)
    if (rule.response_type === 'flex') {
      try {
        const parsed = JSON.parse(rule.response_content)
        setEditorContent(JSON.stringify(parsed, null, 2))
        setFlexJson(parsed)
        setEditorJsonError('')
        setEditorMode('visual')
      } catch {
        setEditorContent(rule.response_content)
        setFlexJson(null)
        setEditorJsonError('JSONパースエラー')
        setEditorMode('json')
      }
    } else {
      setEditorContent(rule.response_content)
      setFlexJson(null)
      setEditorJsonError('')
      setEditorMode('json')
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

  // ─── Content change handlers ───

  const handleContentChange = (val: string) => {
    setEditorContent(val)
    if (editorResponseType === 'flex') {
      try {
        const parsed = JSON.parse(val)
        setEditorJsonError('')
        setFlexJson(parsed)
      } catch (e) {
        setEditorJsonError(String(e).split('\n')[0])
      }
    }
  }

  const handleFlexEditorChange = (newJson: Record<string, unknown>) => {
    setFlexJson(newJson)
    setEditorContent(JSON.stringify(newJson, null, 2))
    setEditorJsonError('')
  }

  const handleResponseTypeChange = (type: string) => {
    setEditorResponseType(type)
    if (type === 'flex') {
      setEditorMode('visual')
      if (!flexJson && editorContent) {
        try { setFlexJson(JSON.parse(editorContent)) } catch { /* noop */ }
      }
    } else {
      setEditorMode('json')
      setFlexJson(null)
      setEditorJsonError('')
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
        <FlexTemplateGallery onSelect={openCreate} onClose={() => setShowTemplates(false)} />
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
              <div className="flex-1 overflow-y-auto border-r">
                <div className="p-6 space-y-4 max-w-lg">
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
                        onChange={(e) => setEditorMatchType(e.target.value)}
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
                        onChange={(e) => handleResponseTypeChange(e.target.value)}
                      >
                        <option value="flex">Flex Message</option>
                        <option value="text">テキスト</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Flex: mode toggle + editor */}
                {editorResponseType === 'flex' && (
                  <div className="border-t">
                    <div className="flex items-center gap-2 px-6 py-2 bg-gray-50 border-b">
                      <button
                        onClick={() => setEditorMode('visual')}
                        className={`px-3 py-1 text-xs rounded-full ${
                          editorMode === 'visual' ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        ビジュアル
                      </button>
                      <button
                        onClick={() => setEditorMode('json')}
                        className={`px-3 py-1 text-xs rounded-full ${
                          editorMode === 'json' ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
                        }`}
                      >
                        JSON
                      </button>
                      {editorJsonError && <span className="text-xs text-red-500 ml-2">{editorJsonError}</span>}
                      {!editorJsonError && editorContent && <span className="text-xs text-green-600 ml-2">✓ 有効</span>}
                    </div>

                    {editorMode === 'visual' && flexJson ? (
                      <div className="h-[400px] overflow-hidden">
                        <FlexEditor json={flexJson} onChange={handleFlexEditorChange} />
                      </div>
                    ) : (
                      <div className="p-6">
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
                    )}
                  </div>
                )}

                {/* Text content */}
                {editorResponseType === 'text' && (
                  <div className="px-6 pb-6">
                    <label className="block text-xs font-medium text-gray-600 mb-1">テキスト <span className="text-red-500">*</span></label>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                      rows={8}
                      placeholder="メッセージ内容を入力"
                      value={editorContent}
                      onChange={(e) => handleContentChange(e.target.value)}
                    />
                  </div>
                )}

                {/* Postback helper */}
                {editorResponseType === 'flex' && editorMode === 'json' && (
                  <div className="mx-6 mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-700 mb-1">postbackボタンの書き方</p>
                    <code className="text-[10px] text-blue-600 block whitespace-pre-wrap">{`"action": {
  "type": "postback",
  "label": "ボタン名",
  "data": "action=tag&tag=タグ名&reply=応答テキスト&notify=true",
  "displayText": "ユーザーに表示されるテキスト"
}`}</code>
                  </div>
                )}

                {saveError && <p className="px-6 pb-4 text-sm text-red-600">{saveError}</p>}
              </div>

              {/* Right: Preview */}
              <div className="w-[380px] shrink-0 bg-gray-50 p-6 overflow-y-auto">
                <p className="text-xs font-medium text-gray-500 mb-3">LINEプレビュー</p>
                {editorResponseType === 'flex' && editorContent && !editorJsonError ? (
                  <div className="bg-[#7494C0] rounded-2xl p-4 min-h-[300px]">
                    <InlineFlexPreview content={editorContent} />
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
                      {sendingTest === rule.id ? '送信中...' : 'テスト'}
                    </button>
                    <button
                      onClick={() => toggleActive(rule)}
                      className={`text-xs px-2 py-1 rounded transition-colors min-h-[36px] flex items-center ${rule.is_active ? 'text-yellow-600 hover:bg-yellow-50' : 'text-green-600 hover:bg-green-50'}`}
                    >
                      {rule.is_active ? '無効化' : '有効化'}
                    </button>
                    <button
                      onClick={() => openEdit(rule)}
                      className="text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50 transition-colors min-h-[36px] flex items-center"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id, rule.keyword)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors min-h-[36px] flex items-center"
                    >
                      削除
                    </button>
                  </div>
                </div>

                {testResult && testResult.id === rule.id && (
                  <div className={`mt-2 text-xs px-3 py-1.5 rounded-md ${testResult.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                    {testResult.msg}
                  </div>
                )}
              </div>

              {previewRule === rule.id && rule.response_type === 'flex' && (
                <div className="border-t bg-gray-50 p-4">
                  <div className="bg-[#7494C0] rounded-2xl p-4 max-w-[340px] mx-auto">
                    <InlineFlexPreview content={rule.response_content} />
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
