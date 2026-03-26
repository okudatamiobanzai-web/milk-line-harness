'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '@/lib/api'
import Header from '@/components/layout/header'
import CcPromptButton from '@/components/cc-prompt-button'

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Authenticated Image (fetches with Bearer token) ──────────────────────────

function useAuthImage(menuId: string | null) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    if (!menuId) return
    let cancelled = false
    let objectUrl: string | null = null
    setBlobUrl(null)
    setError(false)
    api.richMenus.fetchImageBlob(menuId).then((url) => {
      if (cancelled) return
      if (url) {
        objectUrl = url
        setBlobUrl(url)
      } else {
        setError(true)
      }
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [menuId])
  return { blobUrl, error }
}

function AuthImage({ menuId, alt, className, style }: { menuId: string; alt: string; className?: string; style?: React.CSSProperties }) {
  const { blobUrl, error } = useAuthImage(menuId)
  if (error) return (
    <div className={className} style={{ ...style, background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="text-red-400 text-xs">画像取得エラー</span>
    </div>
  )
  if (!blobUrl) return (
    <div className={className} style={{ ...style, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="text-gray-400 text-xs">画像を読込中...</span>
    </div>
  )
  return <img src={blobUrl} alt={alt} className={className} style={style} />
}

interface RichMenuBounds {
  x: number
  y: number
  width: number
  height: number
}

interface RichMenuAction {
  type: 'uri' | 'postback' | 'message' | 'richmenuswitch' | 'datetimepicker'
  uri?: string
  data?: string
  displayText?: string
  text?: string
  label?: string
  richMenuAliasId?: string
  mode?: 'date' | 'time' | 'datetime'
}

interface RichMenuArea {
  bounds: RichMenuBounds
  action: RichMenuAction
}

interface RichMenu {
  richMenuId: string
  size: { width: number; height: number }
  selected: boolean
  name: string
  chatBarText: string
  areas: RichMenuArea[]
}

interface RichMenuAlias {
  richMenuAliasId: string
  richMenuId: string
}

// ─── Size presets ─────────────────────────────────────────────────────────────

const SIZE_PRESETS = [
  { label: '大（2500×1686）', width: 2500, height: 1686 },
  { label: '半分（2500×843）', width: 2500, height: 843 },
  { label: 'コンパクト（1200×810）', width: 1200, height: 810 },
]

// ─── Action type labels ───────────────────────────────────────────────────────

const ACTION_TYPE_LABELS: Record<string, string> = {
  uri: 'URL遷移',
  postback: 'Postback',
  message: 'メッセージ送信',
  richmenuswitch: 'タブ切替',
  datetimepicker: '日時選択',
}

// ─── CC Prompts ───────────────────────────────────────────────────────────────

const ccPrompts = [
  {
    title: 'リッチメニュー設計',
    prompt: `milkのリッチメニュー設計を手伝ってください。
1. Tab A「milkを使う」とTab B「地域とつながる」の2タブ構成
2. 各タブ6エリア（3×2グリッド）のレイアウト
3. Tab AにはTab Bへの切替ボタン、Tab BにはTab Aへの切替ボタンを配置
4. richmenuswitch アクションのエイリアスID設計
最適なエリア配置とアクション設定を提案してください。`,
  },
  {
    title: 'Canvaテンプレート',
    prompt: `リッチメニュー画像のCanvaテンプレート作成ガイドを教えてください。
1. 2500×1686pxキャンバスの設定方法
2. 3×2グリッド（6エリア）のガイドライン配置
3. milkのブランドカラーを使ったデザインのコツ
4. アイコン・テキストの推奨サイズ
手順を教えてください。`,
  },
]

// ─── milk preset areas (3×2 grid on 2500×1686) ───────────────────────────────

function milkPresetAreas(tab: 'A' | 'B', aliases: { tabA: string; tabB: string }): RichMenuArea[] {
  const w = 833
  const h = 843
  const cols = [0, 833, 1666]
  const rows = [0, 843]

  if (tab === 'A') {
    return [
      { bounds: { x: cols[0], y: rows[0], width: w, height: h }, action: { type: 'uri', uri: 'https://milk-nakashibetsu.com/#hours', label: '営業時間' } },
      { bounds: { x: cols[1], y: rows[0], width: w, height: h }, action: { type: 'uri', uri: 'https://milk-nakashibetsu.com/#price', label: '料金プラン' } },
      { bounds: { x: cols[2], y: rows[0], width: 834, height: h }, action: { type: 'uri', uri: 'https://milk-nakashibetsu.com/#dropin', label: 'ドロップイン手順' } },
      { bounds: { x: cols[0], y: rows[1], width: w, height: h }, action: { type: 'uri', uri: 'https://milk-nakashibetsu.com/#visit', label: '見学予約' } },
      { bounds: { x: cols[1], y: rows[1], width: w, height: h }, action: { type: 'uri', uri: 'https://milk-nakashibetsu.com/#faq', label: 'FAQ' } },
      { bounds: { x: cols[2], y: rows[1], width: 834, height: h }, action: { type: 'richmenuswitch', richMenuAliasId: aliases.tabB, data: 'switch-to-tab-b', label: '地域とつながる →' } },
    ]
  }
  return [
    { bounds: { x: cols[0], y: rows[0], width: w, height: h }, action: { type: 'uri', uri: 'https://milk-nakashibetsu.com/yubitoma', label: '指とま' } },
    { bounds: { x: cols[1], y: rows[0], width: w, height: h }, action: { type: 'uri', uri: 'https://milk-nakashibetsu.com/miseru', label: 'ミセル' } },
    { bounds: { x: cols[2], y: rows[0], width: 834, height: h }, action: { type: 'uri', uri: 'https://milk-nakashibetsu.com/shirube-tabi', label: 'しるべ旅' } },
    { bounds: { x: cols[0], y: rows[1], width: w, height: h }, action: { type: 'uri', uri: 'https://milk-nakashibetsu.com/events', label: 'イベント' } },
    { bounds: { x: cols[1], y: rows[1], width: w, height: h }, action: { type: 'uri', uri: 'https://milk-nakashibetsu.com/radio', label: 'milk radio' } },
    { bounds: { x: cols[2], y: rows[1], width: 834, height: h }, action: { type: 'richmenuswitch', richMenuAliasId: aliases.tabA, data: 'switch-to-tab-a', label: '← milkを使う' } },
  ]
}

// ─── Visual Area Editor component ────────────────────────────────────────────

function AreaEditor({
  menuSize,
  areas,
  imageUrl,
  onAreasChange,
  selectedAreaIndex,
  onSelectArea,
}: {
  menuSize: { width: number; height: number }
  areas: RichMenuArea[]
  imageUrl: string | null
  onAreasChange: (areas: RichMenuArea[]) => void
  selectedAreaIndex: number | null
  onSelectArea: (index: number | null) => void
}) {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null)
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null)

  const getScaledPos = (e: React.MouseEvent): { x: number; y: number } => {
    const rect = canvasRef.current!.getBoundingClientRect()
    const scaleX = menuSize.width / rect.width
    const scaleY = menuSize.height / rect.height
    return {
      x: Math.round((e.clientX - rect.left) * scaleX),
      y: Math.round((e.clientY - rect.top) * scaleY),
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    // Check if clicking on existing area
    const pos = getScaledPos(e)
    const clickedIdx = areas.findIndex(
      (a) =>
        pos.x >= a.bounds.x &&
        pos.x <= a.bounds.x + a.bounds.width &&
        pos.y >= a.bounds.y &&
        pos.y <= a.bounds.y + a.bounds.height
    )
    if (clickedIdx >= 0) {
      onSelectArea(clickedIdx)
      return
    }
    setDrawing(true)
    setDrawStart(pos)
    setDrawCurrent(pos)
    onSelectArea(null)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!drawing) return
    setDrawCurrent(getScaledPos(e))
  }

  const handleMouseUp = () => {
    if (!drawing || !drawStart || !drawCurrent) {
      setDrawing(false)
      return
    }
    const x = Math.min(drawStart.x, drawCurrent.x)
    const y = Math.min(drawStart.y, drawCurrent.y)
    const w = Math.abs(drawCurrent.x - drawStart.x)
    const h = Math.abs(drawCurrent.y - drawStart.y)
    if (w > 20 && h > 20) {
      const newArea: RichMenuArea = {
        bounds: { x, y, width: w, height: h },
        action: { type: 'uri', uri: '', label: `エリア${areas.length + 1}` },
      }
      onAreasChange([...areas, newArea])
      onSelectArea(areas.length)
    }
    setDrawing(false)
    setDrawStart(null)
    setDrawCurrent(null)
  }

  const aspectRatio = menuSize.height / menuSize.width

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        ドラッグでエリアを追加、クリックで選択
      </div>
      <div
        ref={canvasRef}
        className="relative w-full border-2 border-dashed border-gray-300 rounded-lg overflow-hidden cursor-crosshair select-none"
        style={{ paddingBottom: `${aspectRatio * 100}%` }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { if (drawing) handleMouseUp() }}
      >
        <div className="absolute inset-0">
          {imageUrl ? (
            <img src={imageUrl} alt="Rich menu" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
              <span className="text-gray-400 text-sm">画像を先にアップロードしてください</span>
            </div>
          )}

          {/* Existing areas */}
          {areas.map((area, i) => {
            const rect = canvasRef.current?.getBoundingClientRect()
            if (!rect) return null
            const scaleX = rect.width / menuSize.width
            const scaleY = rect.height / menuSize.height
            const isSelected = selectedAreaIndex === i
            return (
              <div
                key={i}
                className={`absolute border-2 flex items-center justify-center transition-colors ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-green-500/70 bg-green-500/10 hover:bg-green-500/20'
                }`}
                style={{
                  left: `${(area.bounds.x / menuSize.width) * 100}%`,
                  top: `${(area.bounds.y / menuSize.height) * 100}%`,
                  width: `${(area.bounds.width / menuSize.width) * 100}%`,
                  height: `${(area.bounds.height / menuSize.height) * 100}%`,
                }}
              >
                <span className={`text-xs font-bold px-1 py-0.5 rounded ${isSelected ? 'bg-blue-600 text-white' : 'bg-black/60 text-white'}`}>
                  {area.action.label || `#${i + 1}`}
                </span>
              </div>
            )
          })}

          {/* Drawing preview */}
          {drawing && drawStart && drawCurrent && (
            <div
              className="absolute border-2 border-blue-400 bg-blue-400/20"
              style={{
                left: `${(Math.min(drawStart.x, drawCurrent.x) / menuSize.width) * 100}%`,
                top: `${(Math.min(drawStart.y, drawCurrent.y) / menuSize.height) * 100}%`,
                width: `${(Math.abs(drawCurrent.x - drawStart.x) / menuSize.width) * 100}%`,
                height: `${(Math.abs(drawCurrent.y - drawStart.y) / menuSize.height) * 100}%`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Area Action Form ────────────────────────────────────────────────────────

function AreaActionForm({
  area,
  index,
  aliases,
  onChange,
  onDelete,
}: {
  area: RichMenuArea
  index: number
  aliases: RichMenuAlias[]
  onChange: (area: RichMenuArea) => void
  onDelete: () => void
}) {
  const updateAction = (updates: Partial<RichMenuAction>) => {
    onChange({ ...area, action: { ...area.action, ...updates } })
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-blue-900">
          エリア #{index + 1} — {area.action.label || '未設定'}
        </h4>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      <div className="text-xs text-blue-700">
        位置: ({area.bounds.x}, {area.bounds.y}) — サイズ: {area.bounds.width}×{area.bounds.height}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">ラベル</label>
          <input
            type="text"
            value={area.action.label || ''}
            onChange={(e) => updateAction({ label: e.target.value })}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="例: 営業時間"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">アクションタイプ</label>
          <select
            value={area.action.type}
            onChange={(e) => {
              const type = e.target.value as RichMenuAction['type']
              const base: RichMenuAction = { type, label: area.action.label }
              if (type === 'uri') Object.assign(base, { uri: '' })
              if (type === 'postback') Object.assign(base, { data: '', displayText: '' })
              if (type === 'message') Object.assign(base, { text: '' })
              if (type === 'richmenuswitch') Object.assign(base, { richMenuAliasId: '', data: '' })
              onChange({ ...area, action: base })
            }}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {Object.entries(ACTION_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Type-specific fields */}
      {area.action.type === 'uri' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">URL</label>
          <input
            type="url"
            value={area.action.uri || ''}
            onChange={(e) => updateAction({ uri: e.target.value })}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="https://milk-nakashibetsu.com/..."
          />
        </div>
      )}

      {area.action.type === 'postback' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Postback data</label>
            <input
              type="text"
              value={area.action.data || ''}
              onChange={(e) => updateAction({ data: e.target.value })}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="action=inquiry"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">表示テキスト（任意）</label>
            <input
              type="text"
              value={area.action.displayText || ''}
              onChange={(e) => updateAction({ displayText: e.target.value })}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="お問い合わせ"
            />
          </div>
        </>
      )}

      {area.action.type === 'message' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">送信テキスト</label>
          <input
            type="text"
            value={area.action.text || ''}
            onChange={(e) => updateAction({ text: e.target.value })}
            className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="見学したい"
          />
        </div>
      )}

      {area.action.type === 'richmenuswitch' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">切替先エイリアスID</label>
            {aliases.length > 0 ? (
              <select
                value={area.action.richMenuAliasId || ''}
                onChange={(e) => updateAction({ richMenuAliasId: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">選択してください</option>
                {aliases.map((a) => (
                  <option key={a.richMenuAliasId} value={a.richMenuAliasId}>
                    {a.richMenuAliasId}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={area.action.richMenuAliasId || ''}
                onChange={(e) => updateAction({ richMenuAliasId: e.target.value })}
                className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="tab-b"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Postback data</label>
            <input
              type="text"
              value={area.action.data || ''}
              onChange={(e) => updateAction({ data: e.target.value })}
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="switch-to-tab-b"
            />
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RichMenusPage() {
  // List state
  const [menus, setMenus] = useState<RichMenu[]>([])
  const [aliases, setAliases] = useState<RichMenuAlias[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Create form state
  const [showCreate, setShowCreate] = useState(false)
  const [formName, setFormName] = useState('')
  const [formChatBarText, setFormChatBarText] = useState('メニュー')
  const [formSizeIdx, setFormSizeIdx] = useState(0)
  const [formSelected, setFormSelected] = useState(true)
  const [formAreas, setFormAreas] = useState<RichMenuArea[]>([])
  const [formImageBase64, setFormImageBase64] = useState<string | null>(null)
  const [formImagePreview, setFormImagePreview] = useState<string | null>(null)
  const [selectedAreaIdx, setSelectedAreaIdx] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  // Alias form state
  const [showAliasForm, setShowAliasForm] = useState(false)
  const [aliasId, setAliasId] = useState('')
  const [aliasMenuId, setAliasMenuId] = useState('')

  // Detail view
  const [detailMenu, setDetailMenu] = useState<RichMenu | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Data loading ─────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [menusRes, aliasesRes] = await Promise.all([
        api.richMenus.list(),
        api.richMenus.aliases.list().catch(() => ({ success: true, data: [] })),
      ])
      if (menusRes.success) setMenus(menusRes.data || [])
      if (aliasesRes.success) setAliases((aliasesRes as any).data || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '読み込みに失敗しました')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ─── Flash messages ───────────────────────────────────────────────────────

  const flash = (msg: string) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  // ─── Image upload handler ─────────────────────────────────────────────────

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setFormImageBase64(result)
      setFormImagePreview(result)
    }
    reader.readAsDataURL(file)
  }

  // ─── Create rich menu ─────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formName.trim()) { setError('メニュー名を入力してください'); return }
    if (formAreas.length === 0) { setError('エリアを1つ以上設定してください'); return }
    setCreating(true)
    setError('')
    try {
      const size = SIZE_PRESETS[formSizeIdx]
      const menuData = {
        size: { width: size.width, height: size.height },
        selected: formSelected,
        name: formName,
        chatBarText: formChatBarText || 'メニュー',
        areas: formAreas.map((a) => ({
          bounds: a.bounds,
          action: a.action,
        })),
      }
      const res = await api.richMenus.create(menuData)
      if (!res.success) throw new Error('作成に失敗しました')

      const richMenuId = res.data.richMenuId

      // Upload image if provided
      if (formImageBase64) {
        const base64 = formImageBase64.replace(/^data:image\/\w+;base64,/, '')
        const ct = formImageBase64.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png'
        await api.richMenus.uploadImage(richMenuId, base64, ct)
      }

      flash(`リッチメニュー「${formName}」を作成しました（ID: ${richMenuId}）`)
      resetForm()
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : '作成に失敗しました')
    } finally {
      setCreating(false)
    }
  }

  const resetForm = () => {
    setShowCreate(false)
    setFormName('')
    setFormChatBarText('メニュー')
    setFormSizeIdx(0)
    setFormSelected(true)
    setFormAreas([])
    setFormImageBase64(null)
    setFormImagePreview(null)
    setSelectedAreaIdx(null)
  }

  // ─── Delete rich menu ─────────────────────────────────────────────────────

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？この操作は取り消せません。`)) return
    try {
      await api.richMenus.delete(id)
      flash(`「${name}」を削除しました`)
      if (detailMenu?.richMenuId === id) setDetailMenu(null)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : '削除に失敗しました')
    }
  }

  // ─── Set default ──────────────────────────────────────────────────────────

  const handleSetDefault = async (id: string, name: string) => {
    if (!confirm(`「${name}」を全ユーザーのデフォルトに設定しますか？`)) return
    try {
      await api.richMenus.setDefault(id)
      flash(`「${name}」をデフォルトに設定しました`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'デフォルト設定に失敗しました')
    }
  }

  // ─── Upload image to existing menu ────────────────────────────────────────

  const handleUploadToExisting = async (menuId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const result = reader.result as string
          const base64 = result.replace(/^data:image\/\w+;base64,/, '')
          const ct = result.startsWith('data:image/jpeg') ? 'image/jpeg' : 'image/png'
          await api.richMenus.uploadImage(menuId, base64, ct)
          flash('画像をアップロードしました')
          await loadData()
        } catch (e) {
          setError(e instanceof Error ? e.message : '画像アップロードに失敗しました')
        }
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  // ─── Alias CRUD ───────────────────────────────────────────────────────────

  const handleCreateAlias = async () => {
    if (!aliasId.trim() || !aliasMenuId) { setError('エイリアスIDとメニューを選択してください'); return }
    try {
      await api.richMenus.aliases.create({ richMenuAliasId: aliasId, richMenuId: aliasMenuId })
      flash(`エイリアス「${aliasId}」を作成しました`)
      setAliasId('')
      setAliasMenuId('')
      setShowAliasForm(false)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エイリアス作成に失敗しました')
    }
  }

  const handleDeleteAlias = async (id: string) => {
    if (!confirm(`エイリアス「${id}」を削除しますか？`)) return
    try {
      await api.richMenus.aliases.delete(id)
      flash(`エイリアス「${id}」を削除しました`)
      await loadData()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'エイリアス削除に失敗しました')
    }
  }

  // ─── Preset (milk Tab A / Tab B) ──────────────────────────────────────────

  const applyPreset = (tab: 'A' | 'B') => {
    const tabAAliasId = aliases.find((a) => a.richMenuAliasId.includes('tab-a'))?.richMenuAliasId || 'tab-a'
    const tabBAliasId = aliases.find((a) => a.richMenuAliasId.includes('tab-b'))?.richMenuAliasId || 'tab-b'
    const preset = milkPresetAreas(tab, { tabA: tabAAliasId, tabB: tabBAliasId })
    setFormAreas(preset)
    setFormName(tab === 'A' ? 'milk - milkを使う' : 'milk - 地域とつながる')
    setFormChatBarText(tab === 'A' ? 'milkを使う' : '地域とつながる')
    setFormSizeIdx(0) // 2500×1686
    setSelectedAreaIdx(null)
    flash(`Tab ${tab} プリセットを適用しました`)
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 min-h-screen">
      <Header title="リッチメニュー管理" />

      <main className="px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
        {/* Flash messages */}
        {successMsg && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {successMsg}
          </div>
        )}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
            <svg className="w-5 h-5 text-red-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">✕</button>
          </div>
        )}

        {/* ─── Section: 既存リッチメニュー一覧 ─── */}
        <section className="bg-white border border-gray-200 rounded-xl">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">リッチメニュー一覧</h2>
              <p className="text-xs text-gray-500 mt-0.5">{menus.length} 件のメニュー</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadData()}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                更新
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="px-4 py-1.5 text-xs font-medium text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#06C755' }}
              >
                + 新規作成
              </button>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">読み込み中...</div>
          ) : menus.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400 text-sm">
              リッチメニューがありません。「新規作成」から作成してください。
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {menus.map((menu) => {
                const linkedAlias = aliases.find((a) => a.richMenuId === menu.richMenuId)
                return (
                  <div
                    key={menu.richMenuId}
                    className={`px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer ${
                      detailMenu?.richMenuId === menu.richMenuId ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setDetailMenu(detailMenu?.richMenuId === menu.richMenuId ? null : menu)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Thumbnail */}
                      <div className="w-28 h-[19px] sm:w-40 sm:h-[27px] lg:w-48 lg:h-[32px] shrink-0 rounded-md overflow-hidden bg-gray-100 border border-gray-200"
                        style={{ aspectRatio: `${menu.size.width}/${menu.size.height}` }}
                      >
                        <AuthImage menuId={menu.richMenuId} alt={menu.name} className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-900 truncate">{menu.name}</h3>
                          {linkedAlias && (
                            <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                              {linkedAlias.richMenuAliasId}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {menu.size.width}×{menu.size.height} · {menu.areas.length}エリア · バーテキスト: {menu.chatBarText}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5 font-mono truncate">{menu.richMenuId}</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleUploadToExisting(menu.richMenuId) }}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="画像アップロード"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSetDefault(menu.richMenuId, menu.name) }}
                          className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="デフォルトに設定"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(menu.richMenuId, menu.name) }}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="削除"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Detail expand — Visual Area Preview */}
                    {detailMenu?.richMenuId === menu.richMenuId && (
                      <div className="mt-4 pt-4 border-t border-gray-200 space-y-3" onClick={(e) => e.stopPropagation()}>
                        {/* Visual overlay preview */}
                        <div className="max-w-3xl">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-xs font-bold text-gray-700">エリアプレビュー</h4>
                            <span className="text-xs text-gray-400">ホバーで詳細表示</span>
                          </div>
                          <div
                            className="relative w-full rounded-lg border border-gray-200 overflow-hidden"
                            style={{ paddingBottom: `${(menu.size.height / menu.size.width) * 100}%` }}
                          >
                            <AuthImage
                              menuId={menu.richMenuId}
                              alt={menu.name}
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                            {/* Area overlays */}
                            {menu.areas.map((area, i) => {
                              const colors = [
                                'rgba(59,130,246,0.15)', 'rgba(16,185,129,0.15)', 'rgba(245,158,11,0.15)',
                                'rgba(239,68,68,0.15)', 'rgba(139,92,246,0.15)', 'rgba(236,72,153,0.15)',
                                'rgba(20,184,166,0.15)', 'rgba(249,115,22,0.15)',
                              ]
                              const borderColors = [
                                'rgba(59,130,246,0.7)', 'rgba(16,185,129,0.7)', 'rgba(245,158,11,0.7)',
                                'rgba(239,68,68,0.7)', 'rgba(139,92,246,0.7)', 'rgba(236,72,153,0.7)',
                                'rgba(20,184,166,0.7)', 'rgba(249,115,22,0.7)',
                              ]
                              const bgColor = colors[i % colors.length]
                              const bColor = borderColors[i % borderColors.length]

                              const actionLabel = area.action.type === 'uri'
                                ? area.action.uri || ''
                                : area.action.type === 'richmenuswitch'
                                  ? `切替 → ${area.action.richMenuAliasId}`
                                  : area.action.type === 'message'
                                    ? `送信: ${area.action.text}`
                                    : area.action.type === 'postback'
                                      ? `PB: ${area.action.data}`
                                      : area.action.type

                              return (
                                <div
                                  key={i}
                                  className="absolute flex flex-col items-center justify-center transition-all duration-150 cursor-default group"
                                  style={{
                                    left: `${(area.bounds.x / menu.size.width) * 100}%`,
                                    top: `${(area.bounds.y / menu.size.height) * 100}%`,
                                    width: `${(area.bounds.width / menu.size.width) * 100}%`,
                                    height: `${(area.bounds.height / menu.size.height) * 100}%`,
                                    background: bgColor,
                                    border: `2px solid ${bColor}`,
                                  }}
                                >
                                  {/* Always visible: number badge + label */}
                                  <span
                                    className="px-1.5 py-0.5 rounded text-white text-xs font-bold leading-none"
                                    style={{ backgroundColor: bColor, fontSize: '10px' }}
                                  >
                                    #{i + 1} {area.action.label || ''}
                                  </span>

                                  {/* Hover tooltip: full action detail */}
                                  <div className="hidden group-hover:flex flex-col items-center mt-1 max-w-full">
                                    <span
                                      className="px-2 py-1 rounded text-white text-center leading-tight break-all"
                                      style={{ backgroundColor: 'rgba(0,0,0,0.75)', fontSize: '9px', maxWidth: '95%' }}
                                    >
                                      {ACTION_TYPE_LABELS[area.action.type]}<br />
                                      {actionLabel}
                                    </span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Area list (compact) */}
                        <div className="grid gap-1.5 max-w-3xl">
                          {menu.areas.map((area, i) => {
                            const dotColors = [
                              'bg-blue-500', 'bg-emerald-500', 'bg-amber-500',
                              'bg-red-500', 'bg-violet-500', 'bg-pink-500',
                              'bg-teal-500', 'bg-orange-500',
                            ]
                            return (
                              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 text-xs">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${dotColors[i % dotColors.length]}`} />
                                <span className="font-bold text-gray-800 shrink-0">#{i + 1}</span>
                                <span className="font-medium text-gray-700 shrink-0">{area.action.label || '—'}</span>
                                <span className="text-gray-400 shrink-0">{ACTION_TYPE_LABELS[area.action.type]}</span>
                                <span className="text-gray-500 truncate">
                                  {area.action.type === 'uri' && `→ ${area.action.uri}`}
                                  {area.action.type === 'richmenuswitch' && `→ ${area.action.richMenuAliasId}`}
                                  {area.action.type === 'message' && `→ 「${area.action.text}」`}
                                  {area.action.type === 'postback' && `→ ${area.action.data}`}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ─── Section: エイリアス管理（タブ切替） ─── */}
        <section className="bg-white border border-gray-200 rounded-xl">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">タブ切替エイリアス</h2>
              <p className="text-xs text-gray-500 mt-0.5">richmenuswitch アクションで使用するエイリアスを管理</p>
            </div>
            <button
              onClick={() => setShowAliasForm(!showAliasForm)}
              className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
            >
              + エイリアス追加
            </button>
          </div>

          {showAliasForm && (
            <div className="px-6 py-4 bg-purple-50 border-b border-purple-100">
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">エイリアスID</label>
                  <input
                    type="text"
                    value={aliasId}
                    onChange={(e) => setAliasId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="例: tab-a, tab-b"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-700 mb-1">リッチメニュー</label>
                  <select
                    value={aliasMenuId}
                    onChange={(e) => setAliasMenuId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">選択</option>
                    {menus.map((m) => (
                      <option key={m.richMenuId} value={m.richMenuId}>{m.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleCreateAlias}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors whitespace-nowrap"
                >
                  作成
                </button>
              </div>
            </div>
          )}

          {aliases.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              エイリアスがありません。タブ切替にはエイリアスの設定が必要です。
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {aliases.map((alias) => {
                const linkedMenu = menus.find((m) => m.richMenuId === alias.richMenuId)
                return (
                  <div key={alias.richMenuAliasId} className="px-6 py-3 flex items-center gap-4">
                    <span className="px-2.5 py-1 text-xs font-mono font-bold bg-purple-100 text-purple-800 rounded-md">
                      {alias.richMenuAliasId}
                    </span>
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                    <span className="text-sm text-gray-700 truncate flex-1">
                      {linkedMenu?.name || alias.richMenuId}
                    </span>
                    <button
                      onClick={() => handleDeleteAlias(alias.richMenuAliasId)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ─── Section: 新規作成フォーム ─── */}
        {showCreate && (
          <section className="bg-white border-2 border-green-300 rounded-xl shadow-lg">
            <div className="px-6 py-4 border-b border-green-100 flex items-center justify-between" style={{ backgroundColor: '#f0fdf4' }}>
              <h2 className="text-base font-bold text-gray-900">リッチメニュー新規作成</h2>
              <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Preset buttons */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h3 className="text-sm font-bold text-amber-900 mb-2">milkプリセット</h3>
                <p className="text-xs text-amber-700 mb-3">確定済みの2タブ設計を自動入力します（3×2グリッド、6エリア）</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => applyPreset('A')}
                    className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Tab A: milkを使う
                  </button>
                  <button
                    onClick={() => applyPreset('B')}
                    className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                  >
                    Tab B: 地域とつながる
                  </button>
                </div>
              </div>

              {/* Basic info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">メニュー名（管理用）</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    placeholder="milk - milkを使う"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">チャットバーテキスト</label>
                  <input
                    type="text"
                    value={formChatBarText}
                    onChange={(e) => setFormChatBarText(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-500 focus:border-green-500"
                    placeholder="メニュー"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">画像サイズ</label>
                  <select
                    value={formSizeIdx}
                    onChange={(e) => setFormSizeIdx(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  >
                    {SIZE_PRESETS.map((p, i) => (
                      <option key={i} value={i}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={formSelected}
                      onChange={(e) => setFormSelected(e.target.checked)}
                      className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                    />
                    デフォルトで表示（selected）
                  </label>
                </div>
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">メニュー画像</label>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    const file = e.dataTransfer.files[0]
                    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
                      const reader = new FileReader()
                      reader.onload = () => {
                        setFormImageBase64(reader.result as string)
                        setFormImagePreview(reader.result as string)
                      }
                      reader.readAsDataURL(file)
                    }
                  }}
                >
                  {formImagePreview ? (
                    <img src={formImagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
                  ) : (
                    <>
                      <svg className="w-10 h-10 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-gray-500">クリックまたはドラッグ＆ドロップで画像を選択</p>
                      <p className="text-xs text-gray-400 mt-1">PNG / JPEG · 推奨 {SIZE_PRESETS[formSizeIdx].width}×{SIZE_PRESETS[formSizeIdx].height}px</p>
                    </>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={handleImageSelect}
                />
              </div>

              {/* Visual area editor */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">タップエリア設定 ({formAreas.length} エリア)</label>
                  {formAreas.length > 0 && (
                    <button
                      onClick={() => { setFormAreas([]); setSelectedAreaIdx(null) }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      全てクリア
                    </button>
                  )}
                </div>
                <AreaEditor
                  menuSize={SIZE_PRESETS[formSizeIdx]}
                  areas={formAreas}
                  imageUrl={formImagePreview}
                  onAreasChange={setFormAreas}
                  selectedAreaIndex={selectedAreaIdx}
                  onSelectArea={setSelectedAreaIdx}
                />
              </div>

              {/* Area action forms */}
              {formAreas.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">エリア詳細設定</h3>
                  {formAreas.map((area, i) => (
                    <div
                      key={i}
                      className={selectedAreaIdx === i ? '' : 'opacity-60 hover:opacity-100 transition-opacity'}
                      onClick={() => setSelectedAreaIdx(i)}
                    >
                      <AreaActionForm
                        area={area}
                        index={i}
                        aliases={aliases}
                        onChange={(updated) => {
                          const next = [...formAreas]
                          next[i] = updated
                          setFormAreas(next)
                        }}
                        onDelete={() => {
                          setFormAreas(formAreas.filter((_, idx) => idx !== i))
                          setSelectedAreaIdx(null)
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Submit */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-6 py-2.5 text-sm font-bold text-white rounded-lg transition-colors disabled:opacity-50"
                  style={{ backgroundColor: '#06C755' }}
                >
                  {creating ? '作成中...' : 'リッチメニューを作成'}
                </button>
                <button
                  onClick={resetForm}
                  className="px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  キャンセル
                </button>
                {formAreas.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {formAreas.length}エリア · {SIZE_PRESETS[formSizeIdx].label}
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* CC Prompts */}
        <CcPromptButton prompts={ccPrompts} />
      </main>
    </div>
  )
}
