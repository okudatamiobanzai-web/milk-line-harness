'use client'

/**
 * Flex Message Visual Editor
 * GUI for editing LINE Flex Message JSON — text, colors, buttons, images, structure.
 */

import { useState, useCallback, useRef } from 'react'
import { api } from '@/lib/api'

type FlexNode = Record<string, unknown>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

type EditableNode = {
  path: string
  label: string
  node: FlexNode
}

function collectEditableNodes(node: FlexNode, path = 'root', label = ''): EditableNode[] {
  if (!node || typeof node !== 'object') return []
  const results: EditableNode[] = []
  const type = node.type as string

  if (type === 'text') {
    results.push({ path, label: label || String(node.text || '').slice(0, 20) || 'テキスト', node })
  } else if (type === 'button') {
    const action = node.action as FlexNode | undefined
    results.push({ path, label: label || String(action?.label || 'ボタン'), node })
  } else if (type === 'image') {
    results.push({ path, label: label || 'Image', node })
  } else if (type === 'separator') {
    results.push({ path, label: '区切り線', node })
  }

  if (Array.isArray(node.contents)) {
    ;(node.contents as FlexNode[]).forEach((child, i) => {
      results.push(...collectEditableNodes(child, `${path}.contents[${i}]`, ''))
    })
  }

  for (const section of ['header', 'hero', 'body', 'footer']) {
    if (node[section] && typeof node[section] === 'object') {
      results.push(...collectEditableNodes(node[section] as FlexNode, `${path}.${section}`, ''))
    }
  }

  return results
}

function getByPath(root: FlexNode, path: string): FlexNode | null {
  if (path === 'root') return root
  const parts = path.replace('root.', '').split(/\.(?![^[]*\])/)
  let current: unknown = root
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return null
    const bracketMatch = part.match(/^(.+)\[(\d+)\]$/)
    if (bracketMatch) {
      const key = bracketMatch[1]
      const idx = parseInt(bracketMatch[2])
      const arr = (current as Record<string, unknown>)[key]
      if (!Array.isArray(arr)) return null
      current = arr[idx]
    } else {
      current = (current as Record<string, unknown>)[part]
    }
  }
  return current as FlexNode
}

function setByPath(root: FlexNode, path: string, field: string, value: unknown): FlexNode {
  const clone = deepClone(root)
  const node = getByPath(clone, path)
  if (node) {
    (node as Record<string, unknown>)[field] = value
  }
  return clone
}

// ─── Options ─────────────────────────────────────────────────────────────────

const TEXT_SIZES = ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', '3xl']
const PRESET_COLORS = ['#06C755', '#2196F3', '#9C27B0', '#FF9800', '#F44336', '#455A64', '#000000', '#555555', '#999999', '#ffffff']
const BUTTON_STYLES = [
  { value: 'primary', label: '塗り' },
  { value: 'secondary', label: '枠線' },
  { value: 'link', label: 'リンク' },
]

// ─── New element factories ───────────────────────────────────────────────────

const NEW_ELEMENTS = {
  text: { type: 'text', text: 'テキストを入力', size: 'sm', wrap: true, color: '#555555' },
  button: {
    type: 'button',
    action: { type: 'postback', label: 'ボタン', data: 'action=tag&tag=example&reply=応答', displayText: 'タップ' },
    style: 'primary', color: '#06C755', height: 'sm',
  },
  image: { type: 'image', url: 'https://placehold.co/600x400/06C755/white?text=Image', size: 'full', aspectRatio: '3:2', aspectMode: 'cover' },
  separator: { type: 'separator' },
} as const

// ─── Node Editors ────────────────────────────────────────────────────────────

function TextNodeEditor({ node, onChange }: { node: FlexNode; onChange: (field: string, value: unknown) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">テキスト</label>
        <textarea
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          rows={2}
          value={String(node.text || '')}
          onChange={(e) => onChange('text', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">サイズ</label>
          <select className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            value={String(node.size || 'md')} onChange={(e) => onChange('size', e.target.value)}>
            {TEXT_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">太さ</label>
          <select className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            value={String(node.weight || 'regular')} onChange={(e) => onChange('weight', e.target.value)}>
            <option value="regular">通常</option>
            <option value="bold">太字</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">文字色</label>
        <div className="flex items-center gap-2">
          <input type="color" value={String(node.color || '#000000')} onChange={(e) => onChange('color', e.target.value)}
            className="w-8 h-8 rounded border border-gray-300 cursor-pointer" />
          <div className="flex gap-1 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button key={c} type="button"
                className={`w-6 h-6 rounded-full border-2 ${String(node.color || '') === c ? 'border-gray-800' : 'border-gray-200'}`}
                style={{ backgroundColor: c }} onClick={() => onChange('color', c)} />
            ))}
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!node.wrap} onChange={(e) => onChange('wrap', e.target.checked)} className="rounded" />
        <span className="text-xs text-gray-600">折り返し (wrap)</span>
      </label>
    </div>
  )
}

function ButtonNodeEditor({ node, onChange }: { node: FlexNode; onChange: (field: string, value: unknown) => void }) {
  const action = (node.action || {}) as FlexNode
  const updateAction = (field: string, value: unknown) => {
    onChange('action', { ...(node.action as Record<string, unknown> || {}), [field]: value })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">ボタンラベル</label>
        <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          value={String(action.label || '')} onChange={(e) => updateAction('label', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">アクション</label>
          <select className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            value={String(action.type || 'postback')} onChange={(e) => updateAction('type', e.target.value)}>
            <option value="postback">Postback</option>
            <option value="uri">URL</option>
            <option value="message">メッセージ</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">スタイル</label>
          <select className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            value={String(node.style || 'primary')} onChange={(e) => onChange('style', e.target.value)}>
            {BUTTON_STYLES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>
      {action.type === 'postback' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Postback data</label>
            <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="action=tag&tag=example&reply=応答テキスト" value={String(action.data || '')} onChange={(e) => updateAction('data', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">表示テキスト</label>
            <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              value={String(action.displayText || '')} onChange={(e) => updateAction('displayText', e.target.value)} />
          </div>
        </>
      )}
      {action.type === 'uri' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
          <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="https://example.com" value={String(action.uri || '')} onChange={(e) => updateAction('uri', e.target.value)} />
        </div>
      )}
      {action.type === 'message' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">送信テキスト</label>
          <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={String(action.text || '')} onChange={(e) => updateAction('text', e.target.value)} />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">ボタン色</label>
        <div className="flex items-center gap-2">
          <input type="color" value={String(node.color || '#06C755')} onChange={(e) => onChange('color', e.target.value)}
            className="w-8 h-8 rounded border border-gray-300 cursor-pointer" />
          <div className="flex gap-1 flex-wrap">
            {PRESET_COLORS.slice(0, 6).map((c) => (
              <button key={c} type="button"
                className={`w-6 h-6 rounded-full border-2 ${String(node.color || '') === c ? 'border-gray-800' : 'border-gray-200'}`}
                style={{ backgroundColor: c }} onClick={() => onChange('color', c)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ImageNodeEditor({ node, onChange }: { node: FlexNode; onChange: (field: string, value: unknown) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setUploadError('2MB以下の画像を選択してください')
      return
    }

    setUploading(true)
    setUploadError('')
    try {
      const reader = new FileReader()
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const res = await api.images.upload(base64, file.name, file.type)
      if (res.success) {
        onChange('url', res.data.url)
      } else {
        setUploadError(res.error || 'アップロード失敗')
      }
    } catch {
      setUploadError('アップロードに失敗しました')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      {/* Upload button */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">画像</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1 px-3 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ backgroundColor: '#06C755' }}
          >
            {uploading ? 'アップロード中...' : '画像をアップロード'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
        </div>
        {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
        <p className="text-[10px] text-gray-400 mt-1">JPEG, PNG, GIF, WebP / 2MB以下</p>
      </div>

      {/* URL input */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">または画像URLを直接入力</label>
        <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="https://example.com/image.jpg" value={String(node.url || '')} onChange={(e) => onChange('url', e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">サイズ</label>
          <select className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            value={String(node.size || 'full')} onChange={(e) => onChange('size', e.target.value)}>
            {['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'full'].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">アスペクト比</label>
          <select className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            value={String(node.aspectRatio || '20:13')} onChange={(e) => onChange('aspectRatio', e.target.value)}>
            <option value="1:1">1:1 (正方形)</option>
            <option value="1.51:1">1.51:1 (横長)</option>
            <option value="20:13">20:13 (標準)</option>
            <option value="3:2">3:2</option>
            <option value="4:3">4:3</option>
            <option value="16:9">16:9 (ワイド)</option>
            <option value="2:1">2:1</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">表示モード</label>
        <select className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
          value={String(node.aspectMode || 'cover')} onChange={(e) => onChange('aspectMode', e.target.value)}>
          <option value="cover">Cover (切り抜き)</option>
          <option value="fit">Fit (全体表示)</option>
        </select>
      </div>
      {/* Preview thumbnail */}
      {typeof node.url === 'string' && node.url && (
        <div className="mt-2">
          <img src={String(node.url)} alt="" className="w-full max-h-[120px] object-cover rounded border border-gray-200"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
        </div>
      )}
    </div>
  )
}

function SectionEditor({ label, bgColor, onBgChange }: {
  label: string; bgColor: string | undefined; onBgChange: (color: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500">{label}の背景色</p>
      <div className="flex items-center gap-2">
        <input type="color" value={bgColor || '#ffffff'} onChange={(e) => onBgChange(e.target.value)}
          className="w-8 h-8 rounded border border-gray-300 cursor-pointer" />
        <div className="flex gap-1 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button key={c} type="button"
              className={`w-6 h-6 rounded-full border-2 ${bgColor === c ? 'border-gray-800' : 'border-gray-200'}`}
              style={{ backgroundColor: c }} onClick={() => onBgChange(c)} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Section labels ──────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  header: 'ヘッダー',
  hero: 'ヒーロー画像',
  body: 'ボディ',
  footer: 'フッター',
}

// ─── Add Element Menu ────────────────────────────────────────────────────────

function AddElementMenu({ onAdd }: { onAdd: (type: keyof typeof NEW_ELEMENTS) => void }) {
  const items: { type: keyof typeof NEW_ELEMENTS; label: string; icon: string }[] = [
    { type: 'text', label: 'テキスト', icon: 'T' },
    { type: 'button', label: 'ボタン', icon: 'B' },
    { type: 'image', label: '画像', icon: 'I' },
    { type: 'separator', label: '区切り線', icon: '—' },
  ]

  return (
    <div className="flex items-center gap-1">
      {items.map((item) => (
        <button
          key={item.type}
          onClick={() => onAdd(item.type)}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
          title={`${item.label}を追加`}
        >
          <span className="w-4 h-4 flex items-center justify-center text-[10px] font-bold bg-gray-100 rounded">
            {item.icon}
          </span>
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

export interface FlexEditorProps {
  json: FlexNode
  onChange: (json: FlexNode) => void
}

export default function FlexEditor({ json, onChange }: FlexEditorProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string>('all')

  const isCarousel = json.type === 'carousel'
  const [carouselIndex, setCarouselIndex] = useState(0)
  const bubbles: FlexNode[] = isCarousel
    ? (json.contents as FlexNode[] || [])
    : json.type === 'bubble'
      ? [json]
      : []
  const currentBubble = bubbles[carouselIndex] || null

  // ─── Modify bubble helper ───

  const modifyBubble = useCallback((mutator: (bubble: FlexNode) => void) => {
    const clone = deepClone(json)
    if (isCarousel) {
      const bubble = (clone.contents as FlexNode[])[carouselIndex]
      if (bubble) mutator(bubble)
    } else {
      mutator(clone)
    }
    onChange(clone)
  }, [json, onChange, isCarousel, carouselIndex])

  const handleFieldChange = useCallback((path: string, field: string, value: unknown) => {
    if (isCarousel) {
      const clone = deepClone(json)
      const bubble = (clone.contents as FlexNode[])[carouselIndex]
      if (!bubble) return
      const node = getByPath(bubble, path)
      if (node) (node as Record<string, unknown>)[field] = value
      onChange(clone)
    } else {
      onChange(setByPath(json, path, field, value))
    }
  }, [json, onChange, isCarousel, carouselIndex])

  const handleSectionBgChange = useCallback((section: string, color: string) => {
    modifyBubble((bubble) => {
      if (bubble[section]) {
        ((bubble[section] as FlexNode).backgroundColor as unknown) = color
      }
    })
  }, [modifyBubble])

  // ─── Add hero image ───

  const addHeroImage = useCallback((url?: string) => {
    modifyBubble((bubble) => {
      bubble.hero = {
        type: 'image',
        url: url || 'https://placehold.co/900x400/06C755/white?text=Hero+Image',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
      }
    })
    setActiveSection('hero')
  }, [modifyBubble])

  const removeHeroImage = useCallback(() => {
    modifyBubble((bubble) => {
      delete bubble.hero
    })
    setActiveSection('all')
  }, [modifyBubble])

  // ─── Add element to section ───

  const addElementToSection = useCallback((section: string, type: keyof typeof NEW_ELEMENTS) => {
    modifyBubble((bubble) => {
      // Ensure section exists
      if (!bubble[section]) {
        bubble[section] = { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px', contents: [] }
      }
      const sectionNode = bubble[section] as FlexNode
      if (!Array.isArray(sectionNode.contents)) {
        sectionNode.contents = []
      }
      ;(sectionNode.contents as FlexNode[]).push(deepClone(NEW_ELEMENTS[type]) as FlexNode)
    })
  }, [modifyBubble])

  // ─── Remove element ───

  const removeElement = useCallback((path: string) => {
    // Parse path to find parent and index
    const match = path.match(/^(.+)\.contents\[(\d+)\]$/)
    if (!match) return

    const parentPath = match[1]
    const idx = parseInt(match[2])

    modifyBubble((bubble) => {
      const parent = getByPath(bubble, parentPath)
      if (parent && Array.isArray(parent.contents)) {
        ;(parent.contents as FlexNode[]).splice(idx, 1)
      }
    })
    setSelectedPath(null)
  }, [modifyBubble])

  // ─── Add section ───

  const addSection = useCallback((section: string) => {
    modifyBubble((bubble) => {
      if (section === 'hero') {
        bubble.hero = {
          type: 'image', url: 'https://placehold.co/900x400/06C755/white?text=Hero+Image',
          size: 'full', aspectRatio: '20:13', aspectMode: 'cover',
        }
      } else {
        bubble[section] = {
          type: 'box', layout: 'vertical', spacing: 'md',
          paddingAll: section === 'footer' ? '16px' : '20px',
          ...(section === 'header' ? { backgroundColor: '#06C755' } : {}),
          contents: section === 'header'
            ? [{ type: 'text', text: 'タイトル', color: '#ffffff', size: 'lg', weight: 'bold' }]
            : section === 'footer'
              ? [{ type: 'button', action: { type: 'postback', label: 'ボタン', data: 'action=example', displayText: 'タップ' }, style: 'primary', color: '#06C755', height: 'sm' }]
              : [{ type: 'text', text: '内容を入力', size: 'sm', wrap: true, color: '#555555' }],
        }
      }
    })
    setActiveSection(section)
  }, [modifyBubble])

  const removeSection = useCallback((section: string) => {
    modifyBubble((bubble) => { delete bubble[section] })
    setActiveSection('all')
  }, [modifyBubble])

  if (!currentBubble) {
    return <p className="text-sm text-gray-400 p-4">Flexメッセージを選択してください</p>
  }

  const allNodes = collectEditableNodes(currentBubble, 'root', '')
  const sections = ['header', 'hero', 'body', 'footer'].filter((s) => currentBubble[s] != null)
  const missingSections = ['header', 'hero', 'body', 'footer'].filter((s) => currentBubble[s] == null)
  const filteredNodes = activeSection === 'all'
    ? allNodes
    : allNodes.filter((n) => n.path.startsWith(`root.${activeSection}`))

  return (
    <div className="flex flex-col h-full">
      {/* Carousel selector */}
      {isCarousel && bubbles.length > 1 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-gray-50">
          <span className="text-xs text-gray-500">バブル:</span>
          {bubbles.map((_, i) => (
            <button key={i} onClick={() => { setCarouselIndex(i); setSelectedPath(null) }}
              className={`px-3 py-1 text-xs rounded-full ${i === carouselIndex ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Section tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b overflow-x-auto">
        <button onClick={() => { setActiveSection('all'); setSelectedPath(null) }}
          className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${activeSection === 'all' ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
          全て
        </button>
        {sections.map((s) => (
          <button key={s} onClick={() => { setActiveSection(s); setSelectedPath(null) }}
            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${activeSection === s ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
            {SECTION_LABELS[s] || s}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {/* Add missing sections */}
        {activeSection === 'all' && missingSections.length > 0 && (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">セクションを追加:</p>
            <div className="flex flex-wrap gap-1">
              {missingSections.map((s) => (
                <button key={s} onClick={() => addSection(s)}
                  className="px-3 py-1.5 text-xs text-green-700 bg-green-50 hover:bg-green-100 rounded-full transition-colors font-medium">
                  + {SECTION_LABELS[s] || s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Section background editor + remove */}
        {activeSection !== 'all' && currentBubble[activeSection] != null && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
            {activeSection === 'hero' ? (
              // Hero is a direct image node
              <ImageNodeEditor
                node={currentBubble[activeSection] as FlexNode}
                onChange={(field, value) => {
                  modifyBubble((bubble) => {
                    ((bubble[activeSection] as FlexNode)[field] as unknown) = value
                  })
                }}
              />
            ) : (
              <SectionEditor
                label={SECTION_LABELS[activeSection] || activeSection}
                bgColor={(currentBubble[activeSection] as FlexNode).backgroundColor as string | undefined}
                onBgChange={(c) => handleSectionBgChange(activeSection, c)}
              />
            )}
            <button onClick={() => removeSection(activeSection)}
              className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors">
              このセクションを削除
            </button>
          </div>
        )}

        {/* Node list */}
        {filteredNodes.length === 0 && activeSection !== 'all' && activeSection !== 'hero' && (
          <p className="text-xs text-gray-400 text-center py-4">要素がありません。下の「+」から追加してください</p>
        )}
        {filteredNodes.map((item, i) => {
          const isSelected = selectedPath === item.path
          const nodeType = item.node.type as string
          const canRemove = item.path.includes('.contents[')

          return (
            <div key={`${item.path}-${i}`} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setSelectedPath(isSelected ? null : item.path)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${isSelected ? 'bg-green-50 border-b border-green-200' : 'hover:bg-gray-50'}`}>
                <span className="w-5 h-5 flex items-center justify-center text-[10px] font-bold bg-gray-100 rounded">
                  {nodeType === 'text' ? 'T' : nodeType === 'button' ? 'B' : nodeType === 'image' ? 'I' : '—'}
                </span>
                <span className={`flex-1 text-sm truncate ${isSelected ? 'text-green-700 font-medium' : 'text-gray-700'}`}>
                  {nodeType === 'text' && String(item.node.text || '').slice(0, 30)}
                  {nodeType === 'button' && String((item.node.action as FlexNode)?.label || 'ボタン')}
                  {nodeType === 'image' && (String(item.node.url || '').includes('placehold') ? '画像 (プレースホルダー)' : '画像')}
                  {nodeType === 'separator' && '区切り線'}
                  {!['text', 'button', 'image', 'separator'].includes(nodeType) && item.label}
                </span>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{nodeType}</span>
                <span className="text-gray-400 text-xs">{isSelected ? '▲' : '▼'}</span>
              </button>

              {isSelected && (
                <div className="p-3 bg-white">
                  {nodeType === 'text' && <TextNodeEditor node={item.node} onChange={(f, v) => handleFieldChange(item.path, f, v)} />}
                  {nodeType === 'button' && <ButtonNodeEditor node={item.node} onChange={(f, v) => handleFieldChange(item.path, f, v)} />}
                  {nodeType === 'image' && <ImageNodeEditor node={item.node} onChange={(f, v) => handleFieldChange(item.path, f, v)} />}
                  {nodeType === 'separator' && <p className="text-xs text-gray-400">区切り線（編集項目なし）</p>}

                  {/* Remove button */}
                  {canRemove && (
                    <div className="mt-3 pt-3 border-t">
                      <button onClick={() => removeElement(item.path)}
                        className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors">
                        この要素を削除
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Add element to current section */}
        {activeSection !== 'all' && activeSection !== 'hero' && currentBubble[activeSection] != null && (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3">
            <p className="text-xs text-gray-500 mb-2">要素を追加:</p>
            <AddElementMenu onAdd={(type) => addElementToSection(activeSection, type)} />
          </div>
        )}

        {/* Quick add to body/footer when viewing all */}
        {activeSection === 'all' && (
          <div className="bg-gray-50 border border-dashed border-gray-300 rounded-lg p-3 space-y-2">
            <p className="text-xs text-gray-500 mb-1">ボディに要素を追加:</p>
            <AddElementMenu onAdd={(type) => addElementToSection('body', type)} />
            {currentBubble.footer != null && (
              <>
                <p className="text-xs text-gray-500 mt-2 mb-1">フッターに要素を追加:</p>
                <AddElementMenu onAdd={(type) => addElementToSection('footer', type)} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
