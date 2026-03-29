'use client'

/**
 * Flex Message Visual Editor
 * GUI for editing LINE Flex Message JSON — text, colors, buttons, structure.
 * Works alongside the existing FlexMessagePreview (flex-preview.tsx).
 */

import { useState, useCallback } from 'react'

type FlexNode = Record<string, unknown>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

/** Walk the Flex tree and collect editable nodes with paths */
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

  // Recurse into contents
  if (Array.isArray(node.contents)) {
    ;(node.contents as FlexNode[]).forEach((child, i) => {
      results.push(...collectEditableNodes(child, `${path}.contents[${i}]`, ''))
    })
  }

  // Bubble sections
  for (const section of ['header', 'hero', 'body', 'footer']) {
    if (node[section] && typeof node[section] === 'object') {
      results.push(...collectEditableNodes(node[section] as FlexNode, `${path}.${section}`, ''))
    }
  }

  return results
}

/** Get a node from the tree by dot-bracket path */
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

/** Set a value in the tree by dot-bracket path + field */
function setByPath(root: FlexNode, path: string, field: string, value: unknown): FlexNode {
  const clone = deepClone(root)
  const node = getByPath(clone, path)
  if (node) {
    (node as Record<string, unknown>)[field] = value
  }
  return clone
}

// ─── Size & Color options ────────────────────────────────────────────────────

const TEXT_SIZES = ['xxs', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl', '3xl']
const PRESET_COLORS = ['#06C755', '#2196F3', '#9C27B0', '#FF9800', '#F44336', '#455A64', '#000000', '#555555', '#999999', '#ffffff']
const BUTTON_STYLES = [
  { value: 'primary', label: '塗り' },
  { value: 'secondary', label: '枠線' },
  { value: 'link', label: 'リンク' },
]

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
          <select
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            value={String(node.size || 'md')}
            onChange={(e) => onChange('size', e.target.value)}
          >
            {TEXT_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">太さ</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            value={String(node.weight || 'regular')}
            onChange={(e) => onChange('weight', e.target.value)}
          >
            <option value="regular">通常</option>
            <option value="bold">太字</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">文字色</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(node.color || '#000000')}
            onChange={(e) => onChange('color', e.target.value)}
            className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
          />
          <div className="flex gap-1 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`w-6 h-6 rounded-full border-2 ${String(node.color || '') === c ? 'border-gray-800' : 'border-gray-200'}`}
                style={{ backgroundColor: c }}
                onClick={() => onChange('color', c)}
              />
            ))}
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!node.wrap}
          onChange={(e) => onChange('wrap', e.target.checked)}
          className="rounded"
        />
        <span className="text-xs text-gray-600">折り返し (wrap)</span>
      </label>
    </div>
  )
}

function ButtonNodeEditor({ node, onChange }: { node: FlexNode; onChange: (field: string, value: unknown) => void }) {
  const action = (node.action || {}) as FlexNode

  const updateAction = (field: string, value: unknown) => {
    const newAction = { ...(node.action as Record<string, unknown> || {}), [field]: value }
    onChange('action', newAction)
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">ボタンラベル</label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          value={String(action.label || '')}
          onChange={(e) => updateAction('label', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">アクション</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            value={String(action.type || 'postback')}
            onChange={(e) => updateAction('type', e.target.value)}
          >
            <option value="postback">Postback</option>
            <option value="uri">URL</option>
            <option value="message">メッセージ</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">スタイル</label>
          <select
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
            value={String(node.style || 'primary')}
            onChange={(e) => onChange('style', e.target.value)}
          >
            {BUTTON_STYLES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Action-specific fields */}
      {action.type === 'postback' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Postback data</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="action=tag&tag=example&reply=応答テキスト"
              value={String(action.data || '')}
              onChange={(e) => updateAction('data', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">表示テキスト</label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              value={String(action.displayText || '')}
              onChange={(e) => updateAction('displayText', e.target.value)}
            />
          </div>
        </>
      )}
      {action.type === 'uri' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">URL</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="https://example.com"
            value={String(action.uri || '')}
            onChange={(e) => updateAction('uri', e.target.value)}
          />
        </div>
      )}
      {action.type === 'message' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">送信テキスト</label>
          <input
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            value={String(action.text || '')}
            onChange={(e) => updateAction('text', e.target.value)}
          />
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">ボタン色</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(node.color || '#06C755')}
            onChange={(e) => onChange('color', e.target.value)}
            className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
          />
          <div className="flex gap-1 flex-wrap">
            {PRESET_COLORS.slice(0, 6).map((c) => (
              <button
                key={c}
                type="button"
                className={`w-6 h-6 rounded-full border-2 ${String(node.color || '') === c ? 'border-gray-800' : 'border-gray-200'}`}
                style={{ backgroundColor: c }}
                onClick={() => onChange('color', c)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function ImageNodeEditor({ node, onChange }: { node: FlexNode; onChange: (field: string, value: unknown) => void }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">画像URL</label>
        <input
          type="text"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="https://example.com/image.jpg"
          value={String(node.url || '')}
          onChange={(e) => onChange('url', e.target.value)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">サイズ</label>
        <select
          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white"
          value={String(node.size || 'full')}
          onChange={(e) => onChange('size', e.target.value)}
        >
          <option value="xxs">xxs</option>
          <option value="xs">xs</option>
          <option value="sm">sm</option>
          <option value="md">md</option>
          <option value="lg">lg</option>
          <option value="xl">xl</option>
          <option value="xxl">xxl</option>
          <option value="full">full</option>
        </select>
      </div>
    </div>
  )
}

function SectionEditor({ label, bgColor, onBgChange }: {
  label: string
  bgColor: string | undefined
  onBgChange: (color: string) => void
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500">{label}の背景色</p>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={bgColor || '#ffffff'}
          onChange={(e) => onBgChange(e.target.value)}
          className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
        />
        <div className="flex gap-1 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`w-6 h-6 rounded-full border-2 ${bgColor === c ? 'border-gray-800' : 'border-gray-200'}`}
              style={{ backgroundColor: c }}
              onClick={() => onBgChange(c)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Section type labels ─────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  header: 'ヘッダー',
  hero: 'ヒーロー',
  body: 'ボディ',
  footer: 'フッター',
}

// ─── Main Editor ─────────────────────────────────────────────────────────────

export interface FlexEditorProps {
  json: FlexNode
  onChange: (json: FlexNode) => void
}

export default function FlexEditor({ json, onChange }: FlexEditorProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<string>('all')

  // For carousel, edit one bubble at a time
  const isCarousel = json.type === 'carousel'
  const [carouselIndex, setCarouselIndex] = useState(0)
  const bubbles: FlexNode[] = isCarousel
    ? (json.contents as FlexNode[] || [])
    : json.type === 'bubble'
      ? [json]
      : []
  const currentBubble = bubbles[carouselIndex] || null

  const handleFieldChange = useCallback((path: string, field: string, value: unknown) => {
    if (isCarousel) {
      const clone = deepClone(json)
      const contents = clone.contents as FlexNode[]
      const bubble = contents[carouselIndex]
      if (!bubble) return
      // path is relative to the bubble
      const node = getByPath(bubble, path)
      if (node) {
        (node as Record<string, unknown>)[field] = value
      }
      onChange(clone)
    } else {
      onChange(setByPath(json, path, field, value))
    }
  }, [json, onChange, isCarousel, carouselIndex])

  const handleSectionBgChange = useCallback((section: string, color: string) => {
    if (isCarousel) {
      const clone = deepClone(json)
      const bubble = (clone.contents as FlexNode[])[carouselIndex]
      if (bubble && bubble[section]) {
        ((bubble[section] as FlexNode).backgroundColor as unknown) = color
      }
      onChange(clone)
    } else {
      const clone = deepClone(json)
      if (clone[section]) {
        ((clone[section] as FlexNode).backgroundColor as unknown) = color
      }
      onChange(clone)
    }
  }, [json, onChange, isCarousel, carouselIndex])

  if (!currentBubble) {
    return <p className="text-sm text-gray-400 p-4">Flexメッセージを選択してください</p>
  }

  // Collect all editable nodes from current bubble
  const allNodes = collectEditableNodes(currentBubble, 'root', '')

  // Group by section
  const sections = ['header', 'hero', 'body', 'footer'].filter(
    (s) => currentBubble[s] != null
  )

  const filteredNodes = activeSection === 'all'
    ? allNodes
    : allNodes.filter((n) => n.path.startsWith(`root.${activeSection}`))

  const selectedNode = selectedPath ? getByPath(currentBubble, selectedPath) : null

  return (
    <div className="flex flex-col h-full">
      {/* Carousel selector */}
      {isCarousel && bubbles.length > 1 && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-gray-50">
          <span className="text-xs text-gray-500">バブル:</span>
          {bubbles.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCarouselIndex(i); setSelectedPath(null) }}
              className={`px-3 py-1 text-xs rounded-full ${
                i === carouselIndex
                  ? 'bg-green-100 text-green-700 font-medium'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Section tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b overflow-x-auto">
        <button
          onClick={() => { setActiveSection('all'); setSelectedPath(null) }}
          className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${
            activeSection === 'all' ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
          }`}
        >
          全て
        </button>
        {sections.map((s) => (
          <button
            key={s}
            onClick={() => { setActiveSection(s); setSelectedPath(null) }}
            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${
              activeSection === s ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {SECTION_LABELS[s] || s}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Section background editor */}
        {activeSection !== 'all' && currentBubble[activeSection] != null && (
          <div className="bg-white border border-gray-200 rounded-lg p-3 mb-2">
            <SectionEditor
              label={SECTION_LABELS[activeSection] || activeSection}
              bgColor={(currentBubble[activeSection] as FlexNode).backgroundColor as string | undefined}
              onBgChange={(c) => handleSectionBgChange(activeSection, c)}
            />
          </div>
        )}

        {/* Node list */}
        {filteredNodes.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-4">編集可能な要素がありません</p>
        )}
        {filteredNodes.map((item, i) => {
          const isSelected = selectedPath === item.path
          const nodeType = item.node.type as string

          return (
            <div key={`${item.path}-${i}`} className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Node header - clickable */}
              <button
                onClick={() => setSelectedPath(isSelected ? null : item.path)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  isSelected ? 'bg-green-50 border-b border-green-200' : 'hover:bg-gray-50'
                }`}
              >
                <span className="text-xs">
                  {nodeType === 'text' ? 'T' : nodeType === 'button' ? 'B' : nodeType === 'image' ? 'I' : '-'}
                </span>
                <span className={`flex-1 text-sm ${isSelected ? 'text-green-700 font-medium' : 'text-gray-700'}`}>
                  {nodeType === 'text' && String(item.node.text || '').slice(0, 30)}
                  {nodeType === 'button' && String((item.node.action as FlexNode)?.label || 'ボタン')}
                  {nodeType === 'image' && 'Image'}
                  {nodeType === 'separator' && '区切り線'}
                  {!['text', 'button', 'image', 'separator'].includes(nodeType) && item.label}
                </span>
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                  {nodeType}
                </span>
                <span className="text-gray-400 text-xs">{isSelected ? '▲' : '▼'}</span>
              </button>

              {/* Expanded editor */}
              {isSelected && (
                <div className="p-3 bg-white">
                  {nodeType === 'text' && (
                    <TextNodeEditor
                      node={item.node}
                      onChange={(field, value) => handleFieldChange(item.path, field, value)}
                    />
                  )}
                  {nodeType === 'button' && (
                    <ButtonNodeEditor
                      node={item.node}
                      onChange={(field, value) => handleFieldChange(item.path, field, value)}
                    />
                  )}
                  {nodeType === 'image' && (
                    <ImageNodeEditor
                      node={item.node}
                      onChange={(field, value) => handleFieldChange(item.path, field, value)}
                    />
                  )}
                  {nodeType === 'separator' && (
                    <p className="text-xs text-gray-400">区切り線（編集項目なし）</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
