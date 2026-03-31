'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { AiKnowledge } from '@line-crm/shared'
import Header from '@/components/layout/header'

type Category = 'correction' | 'fact' | 'rule'

const categoryLabels: Record<Category, { label: string; className: string; description: string }> = {
  correction: { label: '修正', className: 'bg-red-100 text-red-700', description: 'AIが間違えた回答の修正例' },
  fact: { label: '事実', className: 'bg-blue-100 text-blue-700', description: 'milkに関する事実情報' },
  rule: { label: 'ルール', className: 'bg-purple-100 text-purple-700', description: 'AI回答時のルール・制約' },
}

export default function AiKnowledgePage() {
  const [items, setItems] = useState<AiKnowledge[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({
    category: 'correction' as Category,
    questionPattern: '',
    wrongAnswer: '',
    correctAnswer: '',
  })
  const [saving, setSaving] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.aiKnowledge.list()
      if (res.success) setItems(res.data as unknown as AiKnowledge[])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { loadItems() }, [loadItems])

  const openCreate = () => {
    setEditingId(null)
    setForm({ category: 'correction', questionPattern: '', wrongAnswer: '', correctAnswer: '' })
    setShowModal(true)
  }

  const openEdit = (item: AiKnowledge) => {
    setEditingId(item.id)
    setForm({
      category: item.category as Category,
      questionPattern: item.question_pattern,
      wrongAnswer: item.wrong_answer || '',
      correctAnswer: item.correct_answer,
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.questionPattern.trim() || !form.correctAnswer.trim()) return
    setSaving(true)
    try {
      if (editingId) {
        await api.aiKnowledge.update(editingId, {
          category: form.category,
          questionPattern: form.questionPattern,
          wrongAnswer: form.wrongAnswer || undefined,
          correctAnswer: form.correctAnswer,
        })
      } else {
        await api.aiKnowledge.create({
          category: form.category,
          questionPattern: form.questionPattern,
          wrongAnswer: form.wrongAnswer || undefined,
          correctAnswer: form.correctAnswer,
        })
      }
      setShowModal(false)
      loadItems()
    } catch { /* silent */ }
    setSaving(false)
  }

  const handleToggle = async (item: AiKnowledge) => {
    try {
      await api.aiKnowledge.update(item.id, { isActive: !item.is_active })
      loadItems()
    } catch { /* silent */ }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('このナレッジを削除しますか？')) return
    try {
      await api.aiKnowledge.delete(id)
      loadItems()
    } catch { /* silent */ }
  }

  const activeCount = items.filter((i) => i.is_active).length

  return (
    <div>
      <Header title="AIナレッジ管理" />

      {/* 説明 */}
      <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          AIが間違えた回答を修正ナレッジとして登録すると、次回以降のAI自動応答で参照されます。
          修正を積み重ねることで、milkに特化した正確な応答が可能になります。
        </p>
        <p className="text-xs text-amber-600 mt-1">
          現在 {activeCount} 件のナレッジが有効（AI応答時に参照中）
        </p>
      </div>

      {/* 追加ボタン */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="px-4 py-2 text-sm font-medium text-white rounded-lg"
          style={{ backgroundColor: '#06C755' }}
        >
          + ナレッジ追加
        </button>
      </div>

      {/* 一覧 */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-400 text-sm mb-4">まだナレッジがありません</p>
          <button
            onClick={openCreate}
            className="px-4 py-2 text-sm font-medium text-white rounded-lg"
            style={{ backgroundColor: '#06C755' }}
          >
            最初のナレッジを追加
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cat = categoryLabels[item.category as Category] || categoryLabels.fact
            return (
              <div
                key={item.id}
                className={`bg-white rounded-lg border border-gray-200 p-4 ${!item.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cat.className}`}>
                        {cat.label}
                      </span>
                      <span className="text-sm font-medium text-gray-900">{item.question_pattern}</span>
                      {!item.is_active && (
                        <span className="text-xs text-gray-400">（無効）</span>
                      )}
                    </div>

                    {item.wrong_answer && (
                      <div className="mb-1 flex items-start gap-2">
                        <span className="text-red-500 text-xs font-bold mt-0.5 flex-shrink-0">NG</span>
                        <p className="text-sm text-red-600 line-through">{item.wrong_answer}</p>
                      </div>
                    )}

                    <div className="flex items-start gap-2">
                      <span className="text-green-600 text-xs font-bold mt-0.5 flex-shrink-0">OK</span>
                      <p className="text-sm text-gray-700">{item.correct_answer}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(item)}
                      className={`px-2 py-1 text-xs rounded ${
                        item.is_active
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                      }`}
                    >
                      {item.is_active ? 'ON' : 'OFF'}
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="px-2 py-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded"
                    >
                      編集
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="px-2 py-1 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? 'ナレッジ編集' : 'ナレッジ追加'}
              </h3>
            </div>

            <div className="px-6 py-4 space-y-4">
              {/* カテゴリ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">カテゴリ</label>
                <div className="flex gap-2">
                  {(Object.keys(categoryLabels) as Category[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => setForm((f) => ({ ...f, category: key }))}
                      className={`px-3 py-1.5 text-sm rounded-lg border ${
                        form.category === key
                          ? 'border-green-500 bg-green-50 text-green-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {categoryLabels[key].label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">{categoryLabels[form.category].description}</p>
              </div>

              {/* 質問パターン */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">質問パターン / トピック</label>
                <input
                  type="text"
                  value={form.questionPattern}
                  onChange={(e) => setForm((f) => ({ ...f, questionPattern: e.target.value }))}
                  placeholder="例: 空き状況、予約、駐車場"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* 間違い回答（correctionの場合のみ） */}
              {form.category === 'correction' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    間違い回答（AIがしがちな回答）
                  </label>
                  <textarea
                    value={form.wrongAnswer}
                    onChange={(e) => setForm((f) => ({ ...f, wrongAnswer: e.target.value }))}
                    placeholder="例: いいオフィスアプリから空き状況を確認できます"
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}

              {/* 正しい回答 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {form.category === 'correction' ? '正しい回答' : form.category === 'rule' ? 'ルール内容' : '事実情報'}
                </label>
                <textarea
                  value={form.correctAnswer}
                  onChange={(e) => setForm((f) => ({ ...f, correctAnswer: e.target.value }))}
                  placeholder={
                    form.category === 'correction'
                      ? '例: 事前に空き状況を確認する方法はありません。直接お問い合わせください（050-3000-4480）'
                      : form.category === 'rule'
                        ? '例: 料金について聞かれたら必ず最新の価格表URLを添える'
                        : '例: 2026年4月から営業時間が変更になりました'
                  }
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.questionPattern.trim() || !form.correctAnswer.trim()}
                className="px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#06C755' }}
              >
                {saving ? '保存中...' : editingId ? '更新' : '追加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
