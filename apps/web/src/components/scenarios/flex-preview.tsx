'use client'

/**
 * LINE Flex Message Visual Preview
 * Renders Flex JSON as a LINE-like bubble card (simplified but readable).
 */

import { useState } from 'react'

type FlexNode = Record<string, unknown>

function getColor(color?: unknown): string | undefined {
  return typeof color === 'string' ? color : undefined
}

function FlexText({ node }: { node: FlexNode }) {
  const text = String(node.text || '')
  const size = String(node.size || 'md')
  const weight = node.weight === 'bold' ? 'font-semibold' : ''
  const wrap = node.wrap ? '' : 'truncate'

  const sizeMap: Record<string, string> = {
    xxs: 'text-[10px]', xs: 'text-[11px]', sm: 'text-xs', md: 'text-sm',
    lg: 'text-base', xl: 'text-lg', xxl: 'text-xl', '3xl': 'text-2xl',
  }

  return (
    <p
      className={`${sizeMap[size] || 'text-sm'} ${weight} ${wrap} leading-relaxed`}
      style={{ color: getColor(node.color), marginTop: node.margin === 'none' ? 0 : undefined }}
    >
      {text}
    </p>
  )
}

function FlexButton({ node }: { node: FlexNode }) {
  const action = node.action as FlexNode | undefined
  if (!action) return null

  const label = String(action.label || 'ボタン')
  const style = node.style === 'primary' ? 'bg' : 'border border-current bg-transparent'
  const color = getColor(node.color) || '#06C755'
  const height = node.height === 'sm' ? 'py-1.5 text-xs' : 'py-2 text-sm'

  const isPostback = action.type === 'postback'
  const isUri = action.type === 'uri'

  return (
    <div
      className={`${height} rounded-lg text-center font-medium cursor-default`}
      style={
        node.style === 'primary'
          ? { backgroundColor: color, color: '#fff' }
          : node.style === 'link'
            ? { color: color }
            : { borderColor: color, color: color }
      }
      title={
        isPostback ? `postback: ${String(action.data || '').slice(0, 80)}`
          : isUri ? `→ ${action.uri}`
            : undefined
      }
    >
      {label}
      {isPostback && <span className="ml-1 opacity-50 text-[10px]">⚡</span>}
      {isUri && <span className="ml-1 opacity-50 text-[10px]">↗</span>}
    </div>
  )
}

function FlexImage({ node }: { node: FlexNode }) {
  const url = String(node.url || '')
  if (!url) return null

  return (
    <img
      src={url}
      alt=""
      className="w-full object-cover rounded"
      style={{
        maxHeight: node.size === 'full' ? 200 : 120,
      }}
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none'
      }}
    />
  )
}

function FlexSeparator() {
  return <hr className="border-gray-200 my-2" />
}

function FlexBox({ node, depth = 0 }: { node: FlexNode; depth?: number }) {
  const layout = node.layout as string
  const contents = (node.contents || []) as FlexNode[]

  if (depth > 8) return null

  const isHorizontal = layout === 'horizontal'
  const spacing = node.spacing as string | undefined

  const spacingMap: Record<string, string> = {
    none: 'gap-0', xs: 'gap-0.5', sm: 'gap-1', md: 'gap-2', lg: 'gap-3', xl: 'gap-4',
  }

  return (
    <div
      className={`${isHorizontal ? 'flex items-center' : 'flex flex-col'} ${spacingMap[spacing || 'none'] || 'gap-1'}`}
      style={{
        backgroundColor: getColor(node.backgroundColor),
      }}
    >
      {contents.map((child, i) => (
        <FlexContent key={i} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

function FlexContent({ node, depth = 0 }: { node: FlexNode; depth?: number }) {
  if (!node || typeof node !== 'object') return null

  switch (node.type) {
    case 'text': return <FlexText node={node} />
    case 'button': return <FlexButton node={node} />
    case 'image': return <FlexImage node={node} />
    case 'box': return <FlexBox node={node} depth={(depth || 0) + 1} />
    case 'separator': return <FlexSeparator />
    default: return null
  }
}

function BubblePreview({ bubble }: { bubble: FlexNode }) {
  const hero = bubble.hero as FlexNode | undefined
  const body = bubble.body as FlexNode | undefined
  const footer = bubble.footer as FlexNode | undefined

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden max-w-[300px] border border-gray-100">
      {/* Hero */}
      {hero && hero.type === 'image' && (
        <img
          src={String(hero.url || '')}
          alt=""
          className="w-full h-[140px] object-cover"
          onError={(e) => {
            const el = e.target as HTMLImageElement
            el.style.height = '60px'
            el.style.objectFit = 'contain'
            el.style.backgroundColor = '#f3f4f6'
            el.alt = '画像読み込みエラー'
          }}
        />
      )}

      {/* Body */}
      {body && (
        <div className="px-4 py-3 space-y-2" style={{ backgroundColor: getColor(body.backgroundColor) }}>
          <FlexBox node={body} />
        </div>
      )}

      {/* Footer */}
      {footer && (
        <div className="px-4 pb-3 space-y-1.5">
          {((footer as FlexNode).contents as FlexNode[] || []).map((child, i) => (
            <FlexContent key={i} node={child} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function FlexMessagePreview({ content, onClose }: { content: string; onClose: () => void }) {
  const [tab, setTab] = useState<'preview' | 'json'>('preview')

  let parsed: FlexNode | null = null
  let parseError = ''
  try {
    parsed = JSON.parse(content) as FlexNode
  } catch (e) {
    parseError = String(e)
  }

  const isCarousel = parsed?.type === 'carousel'
  const bubbles: FlexNode[] = isCarousel
    ? (parsed?.contents as FlexNode[] || [])
    : parsed?.type === 'bubble'
      ? [parsed]
      : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-gray-100 rounded-2xl shadow-2xl max-w-[90vw] max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b">
          <div className="flex gap-2">
            <button
              onClick={() => setTab('preview')}
              className={`px-3 py-1 text-sm rounded-full ${tab === 'preview' ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              プレビュー
            </button>
            <button
              onClick={() => setTab('json')}
              className={`px-3 py-1 text-sm rounded-full ${tab === 'json' ? 'bg-green-100 text-green-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              JSON
            </button>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none p-1">✕</button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto max-h-[70vh]">
          {parseError ? (
            <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
              JSONパースエラー: {parseError}
            </div>
          ) : tab === 'preview' ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {bubbles.map((bubble, i) => (
                <div key={i} className="flex-shrink-0">
                  {isCarousel && <p className="text-[10px] text-gray-400 mb-1 text-center">{i + 1}/{bubbles.length}</p>}
                  <BubblePreview bubble={bubble} />
                </div>
              ))}
              {bubbles.length === 0 && (
                <p className="text-sm text-gray-400">プレビュー不可（対応外の形式です）</p>
              )}
            </div>
          ) : (
            <pre className="bg-gray-900 text-green-300 p-4 rounded-lg text-xs overflow-auto max-h-[60vh] whitespace-pre-wrap">
              {JSON.stringify(parsed, null, 2)}
            </pre>
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-white border-t flex items-center justify-between text-xs text-gray-400">
          <span>{content.length.toLocaleString()} bytes</span>
          <span>
            {isCarousel ? `カルーセル（${bubbles.length}枚）` : 'バブル'}
            {' · '}
            ⚡=postback ↗=リンク
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Inline Flex Preview (no modal wrapper) ─────────────────────────────────
export function InlineFlexPreview({ content }: { content: string }) {
  let parsed: FlexNode | null = null
  try {
    parsed = JSON.parse(content) as FlexNode
  } catch {
    return <p className="text-xs text-red-500">JSONパースエラー</p>
  }

  const isCarousel = parsed?.type === 'carousel'
  const bubbles: FlexNode[] = isCarousel
    ? (parsed?.contents as FlexNode[] || [])
    : parsed?.type === 'bubble'
      ? [parsed]
      : []

  if (bubbles.length === 0) return <p className="text-xs text-gray-400">プレビュー不可</p>

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {bubbles.map((bubble, i) => (
        <div key={i} className="flex-shrink-0">
          {isCarousel && <p className="text-[10px] text-gray-400 mb-1 text-center">{i + 1}/{bubbles.length}</p>}
          <BubblePreview bubble={bubble} />
        </div>
      ))}
    </div>
  )
}
