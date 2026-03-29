'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import Header from '@/components/layout/header'
import CcPromptButton from '@/components/cc-prompt-button'
import { InlineFlexPreview } from '@/components/scenarios/flex-preview'
import FlexEditor from '@/components/flex-editor'
import { FlexTemplateGallery, type FlexTemplate } from '@/components/flex-templates-gallery'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Template {
  id: string
  name: string
  category: string
  messageType: string
  messageContent: string
  createdAt: string
  updatedAt: string
}

const messageTypeLabels: Record<string, string> = {
  text: 'テキスト',
  image: '画像',
  flex: 'Flex',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

const ccPrompts = [
  {
    title: 'テンプレート作成',
    prompt: `新しいメッセージテンプレートの作成をサポートしてください。
1. 用途別（挨拶、キャンペーン、通知、フォローアップ）のテンプレート文例を提案
2. テキスト・画像・Flexメッセージそれぞれの効果的な使い方
3. カテゴリ分類と命名規則のベストプラクティス
手順を示してください。`,
  },
  {
    title: 'テンプレート整理',
    prompt: `既存のテンプレートを整理・最適化してください。
1. カテゴリ別のテンプレート数と使用頻度を分析
2. 重複・類似テンプレートの統合提案
3. 不足しているカテゴリやテンプレートの追加推奨
結果をレポートしてください。`,
  },
]

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Editor modal state
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)  // null = creating
  const [formName, setFormName] = useState('')
  const [formCategory, setFormCategory] = useState('')
  const [formType, setFormType] = useState<'text' | 'image' | 'flex'>('text')
  const [formContent, setFormContent] = useState('')
  const [formJsonError, setFormJsonError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Editor mode: 'visual' or 'json'
  const [editorMode, setEditorMode] = useState<'visual' | 'json'>('visual')
  // Flex JSON object for visual editor
  const [flexJson, setFlexJson] = useState<Record<string, unknown> | null>(null)

  // Gallery
  const [showGallery, setShowGallery] = useState(false)

  // Expanded preview
  const [previewId, setPreviewId] = useState<string | null>(null)

  // ─── Data loading ───

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.templates.list(selectedCategory !== 'all' ? selectedCategory : undefined)
      if (res.success) setTemplates(res.data)
      else setError(res.error)
    } catch {
      setError('テンプレートの読み込みに失敗しました。')
    } finally {
      setLoading(false)
    }
  }, [selectedCategory])

  useEffect(() => { load() }, [load])

  const categories = Array.from(new Set(templates.map((t) => t.category).filter(Boolean)))

  // ─── Editor open/close ───

  const openCreate = (presetType?: 'text' | 'image' | 'flex', presetContent?: string) => {
    setEditingTemplate(null)
    setFormName('')
    setFormCategory('')
    setFormType(presetType || 'text')
    setFormContent(presetContent || '')
    setFormJsonError('')
    setFormError('')
    setEditorMode(presetType === 'flex' ? 'visual' : 'json')
    if (presetType === 'flex' && presetContent) {
      try { setFlexJson(JSON.parse(presetContent)) } catch { setFlexJson(null) }
    } else {
      setFlexJson(null)
    }
    setEditorOpen(true)
  }

  const openEdit = (t: Template) => {
    setEditingTemplate(t)
    setFormName(t.name)
    setFormCategory(t.category)
    setFormType(t.messageType as 'text' | 'image' | 'flex')
    setFormError('')
    if (t.messageType === 'flex') {
      try {
        const parsed = JSON.parse(t.messageContent)
        setFormContent(JSON.stringify(parsed, null, 2))
        setFlexJson(parsed)
        setFormJsonError('')
        setEditorMode('visual')
      } catch {
        setFormContent(t.messageContent)
        setFlexJson(null)
        setFormJsonError('JSONパースエラー')
        setEditorMode('json')
      }
    } else {
      setFormContent(t.messageContent)
      setFlexJson(null)
      setFormJsonError('')
      setEditorMode('json')
    }
    setEditorOpen(true)
  }

  const openFromGallery = (t: FlexTemplate) => {
    setShowGallery(false)
    const jsonStr = JSON.stringify(t.json, null, 2)
    setEditingTemplate(null)
    setFormName(t.name)
    setFormCategory(t.category)
    setFormType('flex')
    setFormContent(jsonStr)
    setFlexJson(t.json as Record<string, unknown>)
    setFormJsonError('')
    setFormError('')
    setEditorMode('visual')
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditingTemplate(null)
  }

  // ─── Content change handlers ───

  const handleContentChange = (val: string) => {
    setFormContent(val)
    if (formType === 'flex') {
      try {
        const parsed = JSON.parse(val)
        setFormJsonError('')
        setFlexJson(parsed)
      } catch (e) {
        setFormJsonError(String(e).split('\n')[0])
      }
    }
  }

  const handleFlexEditorChange = (newJson: Record<string, unknown>) => {
    setFlexJson(newJson)
    setFormContent(JSON.stringify(newJson, null, 2))
    setFormJsonError('')
  }

  const handleTypeChange = (type: 'text' | 'image' | 'flex') => {
    setFormType(type)
    if (type === 'flex') {
      setEditorMode('visual')
      if (!flexJson) {
        try { setFlexJson(JSON.parse(formContent)) } catch { /* noop */ }
      }
    } else {
      setEditorMode('json')
      setFlexJson(null)
      setFormJsonError('')
    }
  }

  // ─── Save ───

  const handleSave = async () => {
    if (!formName.trim()) { setFormError('テンプレート名を入力してください'); return }
    if (!formCategory.trim()) { setFormError('カテゴリを入力してください'); return }
    if (!formContent.trim()) { setFormError('メッセージ内容を入力してください'); return }
    if (formType === 'flex') {
      try { JSON.parse(formContent) } catch { setFormError('Flex JSONの形式が不正です'); return }
    }

    setSaving(true)
    setFormError('')
    try {
      const payload = {
        name: formName,
        category: formCategory,
        messageType: formType,
        messageContent: formType === 'flex' ? JSON.stringify(JSON.parse(formContent)) : formContent,
      }

      if (editingTemplate) {
        const res = await api.templates.update(editingTemplate.id, payload)
        if (!res.success) { setFormError(res.error || '更新失敗'); return }
      } else {
        const res = await api.templates.create(payload)
        if (!res.success) { setFormError(res.error || '作成失敗'); return }
      }
      closeEditor()
      load()
    } catch {
      setFormError('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  // ─── Delete ───

  const handleDelete = async (id: string) => {
    if (!confirm('このテンプレートを削除してもよいですか？')) return
    try {
      await api.templates.delete(id)
      load()
    } catch {
      setError('削除に失敗しました')
    }
  }

  // ─── Render ───

  return (
    <div>
      <Header
        title="テンプレート管理"
        action={
          <div className="flex gap-2">
            <button
              onClick={() => setShowGallery(true)}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#9C27B0' }}
            >
              + ギャラリーから作成
            </button>
            <button
              onClick={() => openCreate()}
              className="px-4 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#06C755' }}
            >
              + 新規テンプレート
            </button>
          </div>
        }
      />

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Category filter */}
      {!loading && categories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-full transition-colors ${
              selectedCategory === 'all' ? 'text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
            }`}
            style={selectedCategory === 'all' ? { backgroundColor: '#06C755' } : undefined}
          >
            全て
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 min-h-[44px] text-xs font-medium rounded-full transition-colors ${
                selectedCategory === cat ? 'text-white' : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
              }`}
              style={selectedCategory === cat ? { backgroundColor: '#06C755' } : undefined}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* ─── Gallery Modal ─── */}
      {showGallery && (
        <FlexTemplateGallery onSelect={openFromGallery} onClose={() => setShowGallery(false)} />
      )}

      {/* ─── Editor Modal ─── */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeEditor}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
              <h2 className="text-lg font-bold text-gray-900">
                {editingTemplate ? `「${editingTemplate.name}」を編集` : '新規テンプレート'}
              </h2>
              <button onClick={closeEditor} className="text-gray-400 hover:text-gray-600 text-xl p-2">✕</button>
            </div>

            {/* Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Left: Form + Editor */}
              <div className="flex-1 overflow-y-auto border-r">
                <div className="p-6 space-y-4 max-w-lg">
                  {/* Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">テンプレート名 <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="例: ウェルカムメッセージ"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">カテゴリ <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="例: 挨拶、キャンペーン、通知"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                    />
                  </div>

                  {/* Message type */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">メッセージタイプ</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                      value={formType}
                      onChange={(e) => handleTypeChange(e.target.value as 'text' | 'image' | 'flex')}
                    >
                      <option value="text">テキスト</option>
                      <option value="image">画像</option>
                      <option value="flex">Flex</option>
                    </select>
                  </div>
                </div>

                {/* Flex: mode toggle + editor */}
                {formType === 'flex' && (
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
                      {formJsonError && <span className="text-xs text-red-500 ml-2">{formJsonError}</span>}
                      {!formJsonError && formContent && <span className="text-xs text-green-600 ml-2">✓ 有効</span>}
                    </div>

                    {editorMode === 'visual' && flexJson ? (
                      <div className="h-[400px] overflow-hidden">
                        <FlexEditor json={flexJson} onChange={handleFlexEditorChange} />
                      </div>
                    ) : (
                      <div className="p-6">
                        <textarea
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                          rows={16}
                          placeholder='{"type": "bubble", ...}'
                          value={formContent}
                          onChange={(e) => handleContentChange(e.target.value)}
                          style={{ lineHeight: '1.5' }}
                        />
                        <p className="text-xs text-gray-400 mt-1">{formContent.length.toLocaleString()} 文字</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Text / Image content */}
                {formType !== 'flex' && (
                  <div className="px-6 pb-6">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      {formType === 'image' ? '画像URL' : 'メッセージ内容'} <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                      rows={6}
                      placeholder={formType === 'image' ? 'https://example.com/image.jpg' : 'メッセージ内容を入力'}
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                    />
                  </div>
                )}

                {formError && <p className="px-6 pb-4 text-sm text-red-600">{formError}</p>}
              </div>

              {/* Right: Preview */}
              <div className="w-[380px] shrink-0 bg-gray-50 p-6 overflow-y-auto">
                <p className="text-xs font-medium text-gray-500 mb-3">LINEプレビュー</p>
                {formType === 'flex' && formContent && !formJsonError ? (
                  <div className="bg-[#7494C0] rounded-2xl p-4 min-h-[300px]">
                    <InlineFlexPreview content={formContent} />
                  </div>
                ) : formType === 'text' && formContent ? (
                  <div className="bg-[#7494C0] rounded-2xl p-4 min-h-[200px]">
                    <div className="bg-white rounded-xl px-4 py-3 max-w-[260px] shadow-sm">
                      <p className="text-sm whitespace-pre-wrap">{formContent}</p>
                    </div>
                  </div>
                ) : formType === 'image' && formContent ? (
                  <div className="bg-[#7494C0] rounded-2xl p-4 min-h-[200px]">
                    <img src={formContent} alt="" className="rounded-xl max-w-[260px] shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
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
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 min-h-[44px] text-sm font-medium text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
                style={{ backgroundColor: '#06C755' }}
              >
                {saving ? '保存中...' : editingTemplate ? '更新' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Template List ─── */}
      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="px-4 py-4 border-b border-gray-100 flex items-center gap-4 animate-pulse">
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-48" />
                <div className="h-2 bg-gray-100 rounded w-32" />
              </div>
              <div className="h-5 bg-gray-100 rounded-full w-16" />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <p className="text-gray-500 mb-4">テンプレートがありません</p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={() => setShowGallery(true)}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg"
              style={{ backgroundColor: '#9C27B0' }}
            >
              ギャラリーから作成
            </button>
            <button
              onClick={() => openCreate()}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg"
              style={{ backgroundColor: '#06C755' }}
            >
              新規テンプレート
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div key={template.id} className="bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        {template.category}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-50 text-orange-600">
                        {messageTypeLabels[template.messageType] || template.messageType}
                      </span>
                      <span className="text-xs text-gray-400">{template.messageContent.length.toLocaleString()} chars</span>
                    </div>
                    <p className="text-base font-semibold text-gray-900">{template.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(template.createdAt)}</p>

                    {/* Mini preview toggle */}
                    {template.messageType === 'flex' && (
                      <button
                        onClick={() => setPreviewId(previewId === template.id ? null : template.id)}
                        className="text-xs text-purple-600 hover:text-purple-700 mt-1"
                      >
                        {previewId === template.id ? '▲ プレビューを閉じる' : '▼ プレビューを表示'}
                      </button>
                    )}
                    {template.messageType === 'text' && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{template.messageContent}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(template)}
                      className="text-xs text-green-600 hover:text-green-700 px-2 py-1 rounded hover:bg-green-50 transition-colors min-h-[36px] flex items-center"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded hover:bg-red-50 transition-colors min-h-[36px] flex items-center"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded preview */}
              {previewId === template.id && template.messageType === 'flex' && (
                <div className="border-t bg-gray-50 p-4">
                  <div className="bg-[#7494C0] rounded-2xl p-4 max-w-[340px] mx-auto">
                    <InlineFlexPreview content={template.messageContent} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <CcPromptButton prompts={ccPrompts} />
    </div>
  )
}
