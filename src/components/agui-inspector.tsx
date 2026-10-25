import * as React from 'react'
import type { StreamChunk } from '@tanstack/ai'
import { cn } from 'cn'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    empty:
      'Gửi tin nhắn để xem luồng sự kiện AG-UI (SSE) từ server. Thử: “Thời tiết Hà Nội?”, “Chuyển sang giao diện tối”, “Gửi email cho an@example.com chào buổi sáng”.',
  },
  en: {
    empty:
      'Send a message to see the AG-UI (SSE) event stream from the server. Try: “What is the weather in Hanoi?”, “Switch to dark theme”, “Email an@example.com to say good morning”.',
  },
})

export type AguiEntry = {
  id: number
  type: string
  at: number
  count: number
  detail: string
  raw: StreamChunk
}

const DELTA_TYPES = new Set([
  'TEXT_MESSAGE_CONTENT',
  'TOOL_CALL_ARGS',
  'REASONING_MESSAGE_CONTENT',
])

function describe(chunk: StreamChunk): string {
  const c = chunk as Record<string, any>
  switch (chunk.type) {
    case 'RUN_STARTED':
      return `runId=${c.runId}`
    case 'RUN_FINISHED':
      return c.outcome?.type === 'interrupt'
        ? `interrupt × ${c.outcome.interrupts?.length ?? 0}`
        : `finishReason=${c.finishReason ?? 'null'}`
    case 'RUN_ERROR':
      return c.message ?? ''
    case 'TOOL_CALL_START':
      return c.toolCallName ?? c.toolName ?? ''
    case 'TOOL_CALL_RESULT':
      return typeof c.content === 'string' ? c.content : JSON.stringify(c.content)
    case 'CUSTOM':
      return `${c.name} ${JSON.stringify(c.value)}`
    case 'STATE_SNAPSHOT':
    case 'STATE_DELTA':
      return JSON.stringify(c.snapshot ?? c.state ?? c.delta)
    default:
      return typeof c.delta === 'string' ? c.delta : ''
  }
}

function deltaKey(chunk: StreamChunk) {
  const c = chunk as Record<string, any>
  return `${chunk.type}:${c.messageId ?? c.toolCallId ?? ''}`
}

export function useAguiLog() {
  const [entries, setEntries] = React.useState<Array<AguiEntry>>([])
  const nextId = React.useRef(0)
  const lastKey = React.useRef<string | null>(null)

  const push = React.useCallback((chunk: StreamChunk) => {
    const key = DELTA_TYPES.has(chunk.type) ? deltaKey(chunk) : null
    const merge = key !== null && key === lastKey.current
    lastKey.current = key
    setEntries((prev) => {
      const last = prev.at(-1)
      if (merge && last) {
        return [
          ...prev.slice(0, -1),
          { ...last, count: last.count + 1, detail: last.detail + describe(chunk), raw: chunk },
        ]
      }
      return [
        ...prev,
        { id: nextId.current++, type: chunk.type, at: Date.now(), count: 1, detail: describe(chunk), raw: chunk },
      ].slice(-300)
    })
  }, [])

  const clear = React.useCallback(() => {
    lastKey.current = null
    setEntries([])
  }, [])

  return { entries, push, clear }
}

const TONE: Record<string, string> = {
  RUN: 'text-sky-600 dark:text-sky-400',
  TEXT: 'text-emerald-600 dark:text-emerald-400',
  TOOL: 'text-amber-600 dark:text-amber-400',
  REASONING: 'text-violet-600 dark:text-violet-400',
  CUSTOM: 'text-pink-600 dark:text-pink-400',
  STATE: 'text-teal-600 dark:text-teal-400',
}

export function AguiEventList({ entries }: { entries: Array<AguiEntry> }) {
  const t = useMessages(messages)
  const [selected, setSelected] = React.useState<number | null>(null)
  const endRef = React.useRef<HTMLDivElement>(null)
  const start = entries[0]?.at ?? 0

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [entries.length])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-2 font-mono text-xs">
      {entries.length === 0 && (
        <p className="p-3 font-sans text-muted-foreground">
          {t.empty}
        </p>
      )}
      {entries.map((e) => (
        <div key={e.id}>
          <button
            type="button"
            onClick={() => setSelected(selected === e.id ? null : e.id)}
            className="flex w-full items-baseline gap-2 rounded px-1.5 py-1 text-left hover:bg-muted"
          >
            <span className="w-12 shrink-0 text-muted-foreground tabular-nums">
              +{((e.at - start) / 1000).toFixed(2)}
            </span>
            <span className={cn('shrink-0 font-semibold', TONE[e.type.split('_')[0]!])}>
              {e.type}
              {e.count > 1 && <span className="font-normal text-muted-foreground"> ×{e.count}</span>}
            </span>
            <span className="truncate text-muted-foreground">{e.detail}</span>
          </button>
          {selected === e.id && (
            <pre className="mx-1.5 mb-1 overflow-x-auto rounded bg-muted p-2 whitespace-pre-wrap break-all">
              {JSON.stringify(e.raw, null, 2)}
            </pre>
          )}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  )
}
