import * as React from 'react'
import type { StreamChunk, TokenUsage } from '@tanstack/ai'
import { IconInfoCircle } from '@tabler/icons-react'
import { cn } from 'cn'

import type { Effort } from '@/lib/effort'
import { LOCALE_TAGS, defineMessages, getLocale, useMessages } from '@/lib/i18n'
import { formatPrice, formatTokens } from '@/lib/model-catalog'
import type { CatalogModel } from '@/lib/model-catalog'
import { useActiveModel, useModelOptions } from '@/lib/provider-store'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const messages = defineMessages({
  vi: {
    error: 'Lỗi',
    conversation: 'Hội thoại',
    turns: 'Số turn',
    messages: 'Tin nhắn',
    modelCalls: 'Lần gọi model',
    pricing: (context: string, input: string, output: string) =>
      `context ${context} · giá ${input} / ${output} mỗi 1M token`,
    inputHint: 'gồm cả phần cache',
    cacheRead: 'Cache đọc',
    cacheWrite: 'Cache ghi',
    estCost: 'Chi phí ước tính',
    turnCost: 'Chi phí',
    unpriced: (n: string) => `thiếu giá ${n} lần gọi`,
    pricedBy: 'theo giá models.dev',
    lastContext: 'Context lần cuối',
    ofTokens: (n: string) => `của ${n} token`,
    total: 'Tổng:',
    token: 'token',
    speed: 'Tốc độ',
    tokensPerSecLast: 'Token/s (lần cuối)',
    ttftHint: 'tới token đầu tiên',
    perCall: 'Từng lần gọi',
    noRuns: 'Chưa có run nào trong phiên này.',
    finish: 'Kết thúc',
    errorShort: 'lỗi',
    footnote: 'Số liệu token tính từ các run trong phiên hiện tại (từ khi mở trang).',
    turnDetails: 'Chi tiết turn',
    merged: (n: number) => `Gộp ${n} lần gọi model`,
    contextLabel: 'Context hội thoại',
    contextEmpty: 'Chưa có dữ liệu context trong phiên này.',
    contextLeft: (n: string) => `còn ${n} token`,
  },
  en: {
    error: 'Error',
    conversation: 'Conversation',
    turns: 'Turns',
    messages: 'Messages',
    modelCalls: 'Model calls',
    pricing: (context: string, input: string, output: string) =>
      `context ${context} · price ${input} / ${output} per 1M tokens`,
    inputHint: 'including cache',
    cacheRead: 'Cache read',
    cacheWrite: 'Cache write',
    estCost: 'Estimated cost',
    turnCost: 'Cost',
    unpriced: (n: string) => `${n} calls missing price`,
    pricedBy: 'per models.dev pricing',
    lastContext: 'Last context',
    ofTokens: (n: string) => `of ${n} tokens`,
    total: 'Total:',
    token: 'tokens',
    speed: 'Speed',
    tokensPerSecLast: 'Token/s (last)',
    ttftHint: 'time to first token',
    perCall: 'Per call',
    noRuns: 'No runs in this session yet.',
    finish: 'Finish',
    errorShort: 'error',
    footnote: 'Token figures are computed from runs in the current session (since the page was opened).',
    turnDetails: 'Turn details',
    merged: (n: number) => `Merged ${n} model calls`,
    contextLabel: 'Conversation context',
    contextEmpty: 'No context data in this session yet.',
    contextLeft: (n: string) => `${n} tokens left`,
  },
})

export type RunStat = {
  runId: string
  startedAt: number
  /** The `<providerId>/<modelId>` key the run was sent with, for catalog prices. */
  modelKey?: string
  /** Reasoning effort the run was sent with. */
  effort?: Effort
  firstTokenAt?: number
  finishedAt?: number
  model?: string
  finishReason?: string | null
  usage?: TokenUsage
  toolCalls: number
  /** Assistant message the run ended on, to attribute runs to chat turns. */
  messageId?: string
  error?: string
}

const CONTENT_TYPES = new Set([
  'TEXT_MESSAGE_CONTENT',
  'REASONING_MESSAGE_CONTENT',
  'TOOL_CALL_ARGS',
])

export function useChatStats(modelKey?: string, effort?: Effort) {
  const [runs, setRuns] = React.useState<Array<RunStat>>([])
  const modelKeyRef = React.useRef(modelKey)
  modelKeyRef.current = modelKey
  const effortRef = React.useRef(effort)
  effortRef.current = effort

  const push = React.useCallback((chunk: StreamChunk) => {
    const c = chunk as Record<string, any>
    const now = Date.now()
    if (chunk.type === 'RUN_STARTED') {
      setRuns((prev) => [...prev, { runId: c.runId, startedAt: now, modelKey: modelKeyRef.current, effort: effortRef.current, toolCalls: 0 }])
      return
    }
    const patch = (fn: (run: RunStat) => RunStat) =>
      setRuns((prev) => {
        const last = prev.at(-1)
        if (!last || last.finishedAt) return prev
        return [...prev.slice(0, -1), fn(last)]
      })

    if (CONTENT_TYPES.has(chunk.type)) {
      patch((r) => (r.firstTokenAt ? r : { ...r, firstTokenAt: now }))
    } else if (chunk.type === 'TOOL_CALL_START') {
      patch((r) => ({ ...r, toolCalls: r.toolCalls + 1 }))
    } else if (chunk.type === 'RUN_FINISHED') {
      patch((r) => ({
        ...r,
        finishedAt: now,
        model: c.model ?? r.model,
        finishReason: c.outcome?.type === 'interrupt' ? 'interrupt' : (c.finishReason ?? null),
        usage: isUsage(c.usage) ? c.usage : undefined,
      }))
    } else if (chunk.type === 'RUN_ERROR') {
      patch((r) => ({
        ...r,
        finishedAt: now,
        error: c.message ?? messages[getLocale()].error,
        usage: isUsage(c.usage) ? c.usage : undefined,
      }))
    }
  }, [])

  const clear = React.useCallback(() => setRuns([]), [])

  /** Tags finished runs that have no message yet with the assistant message they produced. */
  const attach = React.useCallback((messageId: string) => {
    setRuns((prev) =>
      prev.some((r) => r.finishedAt && !r.messageId)
        ? prev.map((r) => (r.finishedAt && !r.messageId ? { ...r, messageId } : r))
        : prev,
    )
  }, [])

  return { runs, push, clear, attach }
}

function isUsage(u: unknown): u is TokenUsage {
  return typeof u === 'object' && u !== null && !Array.isArray(u) && 'promptTokens' in u
}

/**
 * USD cost of a run from catalog prices per 1M tokens. Prompt tokens include cached ones, so cache
 * reads and writes are priced separately and fall back to the input price when the catalog has none.
 */
function runCost(usage: TokenUsage | undefined, info: CatalogModel | null | undefined) {
  const cost = info?.cost
  if (!usage || cost?.input == null || cost.output == null) return undefined
  const cacheRead = usage.promptTokensDetails?.cachedTokens ?? 0
  const cacheWrite = usage.promptTokensDetails?.cacheWriteTokens ?? 0
  const uncached = Math.max(0, usage.promptTokens - cacheRead - cacheWrite)
  return (
    (uncached * cost.input +
      cacheRead * (cost.cacheRead ?? cost.input) +
      cacheWrite * (cost.cacheWrite ?? cost.input) +
      usage.completionTokens * cost.output) /
    1_000_000
  )
}

function summarize(runs: Array<RunStat>, infoFor: (run: RunStat) => CatalogModel | null) {
  let cost = 0
  let unpriced = 0
  let input = 0
  let output = 0
  let cacheRead = 0
  let cacheWrite = 0
  let reasoning = 0
  let toolCalls = 0
  let genTokens = 0
  let genMs = 0
  let ttftSum = 0
  let ttftCount = 0
  for (const r of runs) {
    toolCalls += r.toolCalls
    if (r.firstTokenAt) {
      ttftSum += r.firstTokenAt - r.startedAt
      ttftCount++
    }
    const u = r.usage
    if (!u) continue
    const price = runCost(u, infoFor(r))
    if (price === undefined) unpriced++
    else cost += price
    input += u.promptTokens
    output += u.completionTokens
    cacheRead += u.promptTokensDetails?.cachedTokens ?? 0
    cacheWrite += u.promptTokensDetails?.cacheWriteTokens ?? 0
    reasoning += u.completionTokensDetails?.reasoningTokens ?? 0
    if (r.firstTokenAt && r.finishedAt && r.finishedAt > r.firstTokenAt) {
      genTokens += u.completionTokens
      genMs += r.finishedAt - r.firstTokenAt
    }
  }
  const last = runs.at(-1)
  const lastSpeed =
    last?.usage && last.firstTokenAt && last.finishedAt && last.finishedAt > last.firstTokenAt
      ? last.usage.completionTokens / ((last.finishedAt - last.firstTokenAt) / 1000)
      : undefined
  const lastInfo = last ? infoFor(last) : null
  return {
    cost: unpriced < runs.filter((r) => r.usage).length ? cost : undefined,
    unpriced,
    contextUsed: last?.usage && lastInfo?.context ? last.usage.promptTokens / lastInfo.context : undefined,
    lastInfo,
    input,
    output,
    cacheRead,
    cacheWrite,
    reasoning,
    toolCalls,
    total: input + output,
    cacheHit: input > 0 ? cacheRead / input : undefined,
    avgSpeed: genMs > 0 ? genTokens / (genMs / 1000) : undefined,
    lastSpeed,
    avgTtft: ttftCount > 0 ? ttftSum / ttftCount : undefined,
    model: [...runs].reverse().find((r) => r.model)?.model,
  }
}

const num = (n: number) => n.toLocaleString(LOCALE_TAGS[getLocale()])
const usd = (n: number | undefined) =>
  n === undefined ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: n < 0.01 ? 5 : n < 1 ? 4 : 2 })}`
const fmt = (n: number | undefined, unit = '', digits = 1) =>
  n === undefined ? '—' : `${n.toLocaleString(LOCALE_TAGS[getLocale()], { maximumFractionDigits: digits })}${unit}`

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-lg border bg-background p-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

export function ChatStatsPanel({
  runs,
  turns,
  messageCount,
}: {
  runs: Array<RunStat>
  turns: number
  messageCount: number
}) {
  const t = useMessages(messages)
  const options = useModelOptions()
  const infoFor = (run: RunStat) => options.find((option) => option.key === run.modelKey)?.info ?? null
  const s = summarize(runs, infoFor)

  return (
    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3 text-sm">
      <Section title={t.conversation}>
        <div className="grid grid-cols-2 gap-2">
          <Stat label={t.turns} value={num(turns)} />
          <Stat label={t.messages} value={num(messageCount)} />
          <Stat label={t.modelCalls} value={num(runs.length)} />
          <Stat label="Tool call" value={num(s.toolCalls)} />
        </div>
        {s.model && (
          <p className="truncate text-xs text-muted-foreground">
            Model: <span className="font-mono text-foreground">{s.model}</span>
          </p>
        )}
        {s.lastInfo && (
          <p className="text-xs text-muted-foreground">
            {s.lastInfo.name} ·{' '}
            {t.pricing(
              formatTokens(s.lastInfo.context),
              formatPrice(s.lastInfo.cost?.input),
              formatPrice(s.lastInfo.cost?.output),
            )}
          </p>
        )}
      </Section>

      <Section title="Token">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Input" value={num(s.input)} hint={t.inputHint} />
          <Stat label="Output" value={num(s.output)} hint={s.reasoning ? `reasoning ${num(s.reasoning)}` : undefined} />
          <Stat
            label={t.cacheRead}
            value={num(s.cacheRead)}
            hint={s.cacheHit === undefined ? undefined : `${fmt(s.cacheHit * 100, '%')} input`}
          />
          <Stat label={t.cacheWrite} value={num(s.cacheWrite)} />
          <Stat
            label={t.estCost}
            value={usd(s.cost)}
            hint={s.unpriced ? t.unpriced(num(s.unpriced)) : t.pricedBy}
          />
          <Stat
            label={t.lastContext}
            value={fmt(s.contextUsed && s.contextUsed * 100, '%')}
            hint={s.lastInfo?.context ? t.ofTokens(formatTokens(s.lastInfo.context)) : undefined}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {t.total} <span className="font-medium text-foreground tabular-nums">{num(s.total)}</span> {t.token}
        </p>
      </Section>

      <Section title={t.speed}>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Token/s (TB)" value={fmt(s.avgSpeed)} />
          <Stat label={t.tokensPerSecLast} value={fmt(s.lastSpeed)} />
          <Stat label="TTFT (TB)" value={fmt(s.avgTtft && s.avgTtft / 1000, ' s', 2)} hint={t.ttftHint} />
        </div>
      </Section>

      <Section title={t.perCall}>
        {runs.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.noRuns}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-background">
            <table className="w-full text-xs tabular-nums">
              <thead className="text-muted-foreground">
                <tr className="border-b text-right [&>th]:px-2 [&>th]:py-1.5 [&>th]:font-normal">
                  <th className="text-left">#</th>
                  <th>In</th>
                  <th>Out</th>
                  <th>Cache</th>
                  <th>tok/s</th>
                  <th>$</th>
                  <th>{t.finish}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r, i) => {
                  const speed =
                    r.usage && r.firstTokenAt && r.finishedAt && r.finishedAt > r.firstTokenAt
                      ? r.usage.completionTokens / ((r.finishedAt - r.firstTokenAt) / 1000)
                      : undefined
                  return (
                    <tr key={`${r.runId}-${i}`} className="border-b last:border-0 text-right [&>td]:px-2 [&>td]:py-1">
                      <td className="text-left text-muted-foreground">{i + 1}</td>
                      <td>{r.usage ? num(r.usage.promptTokens) : '—'}</td>
                      <td>{r.usage ? num(r.usage.completionTokens) : '—'}</td>
                      <td>{r.usage ? num(r.usage.promptTokensDetails?.cachedTokens ?? 0) : '—'}</td>
                      <td>{fmt(speed, '', 0)}</td>
                      <td>{usd(runCost(r.usage, infoFor(r)))}</td>
                      <td className="text-muted-foreground">
                        {r.error ? t.errorShort : r.finishedAt ? (r.finishReason ?? 'null') : '…'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <p className="text-[11px] text-muted-foreground">
        {t.footnote}
      </p>
    </div>
  )
}

/**
 * Hover card with token stats for one assistant turn, aggregated over every run that streamed
 * into the message. Renders nothing for turns from before the page was opened.
 */
export function TurnInfoButton({ runs, messageId }: { runs: Array<RunStat>; messageId: string }) {
  const t = useMessages(messages)
  const options = useModelOptions()
  const turnRuns = runs.filter((r) => r.messageId === messageId && r.usage)
  const last = turnRuns.at(-1)
  if (!last?.usage) return null

  let input = 0
  let output = 0
  let cacheRead = 0
  let genTokens = 0
  let genMs = 0
  let cost = 0
  let priced = 0
  for (const r of turnRuns) {
    const u = r.usage!
    const price = runCost(u, options.find((option) => option.key === r.modelKey)?.info)
    if (price !== undefined) {
      cost += price
      priced++
    }
    input += u.promptTokens
    output += u.completionTokens
    cacheRead += u.promptTokensDetails?.cachedTokens ?? 0
    if (r.firstTokenAt && r.finishedAt && r.finishedAt > r.firstTokenAt) {
      genTokens += u.completionTokens
      genMs += r.finishedAt - r.firstTokenAt
    }
  }
  const speed = genMs > 0 ? genTokens / (genMs / 1000) : undefined
  const context = last.usage.promptTokens + last.usage.completionTokens
  const contextWindow = options.find((option) => option.key === last.modelKey)?.info?.context

  const rows: Array<[string, string]> = [
    ['Effort', last.effort ?? '—'],
    ['Token in', formatTokens(input)],
    ['Token out', formatTokens(output)],
    ['Token/s', fmt(speed)],
    ['Cache', input > 0 ? `${fmt((cacheRead / input) * 100, '%')} (${formatTokens(cacheRead)})` : '—'],
    ['Context', contextWindow ? `${formatTokens(context)} / ${formatTokens(contextWindow)} (${fmt((context / contextWindow) * 100, '%')})` : formatTokens(context)],
    // A run without catalog prices makes the total a lower bound.
    [t.turnCost, priced === 0 ? '—' : `${priced < turnRuns.length ? '≥ ' : ''}${usd(cost)}`],
  ]

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.turnDetails}
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <IconInfoCircle />
      </TooltipTrigger>
      <TooltipContent className="flex-col items-stretch gap-1 py-2">
        {last.model && <div className="mb-0.5 truncate font-mono opacity-70">{last.model}</div>}
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-6">
            <span className="opacity-70">{label}</span>
            <span className="tabular-nums">{value}</span>
          </div>
        ))}
        {turnRuns.length > 1 && <div className="opacity-70">{t.merged(turnRuns.length)}</div>}
      </TooltipContent>
    </Tooltip>
  )
}

const RING_RADIUS = 6
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

/** Empty context ring that holds the real ring's spot while a started chat is still loading. */
export function ContextRingPlaceholder({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('inline-flex size-7 shrink-0 items-center justify-center', className)}>
      <svg viewBox="0 0 16 16" className="size-4">
        <circle cx="8" cy="8" r={RING_RADIUS} fill="none" strokeWidth="2" className="stroke-muted-foreground/25" />
      </svg>
    </span>
  )
}

/**
 * Ring filled by how much of the model's context window the conversation used on its last run,
 * with a hover card summarizing the conversation so far.
 */
export function ContextRing({
  runs,
  turns,
  messageCount,
}: {
  runs: Array<RunStat>
  turns: number
  messageCount: number
}) {
  const t = useMessages(messages)
  const options = useModelOptions()
  const activeModel = useActiveModel()
  const infoFor = (run: RunStat) => options.find((option) => option.key === run.modelKey)?.info ?? null
  const s = summarize(runs, infoFor)
  const last = [...runs].reverse().find((r) => r.usage)
  const context = last?.usage ? last.usage.promptTokens + last.usage.completionTokens : undefined
  const contextWindow = (last ? infoFor(last) : activeModel?.info)?.context
  const used = context !== undefined && contextWindow ? Math.min(context / contextWindow, 1) : 0
  const tone = used >= 0.9 ? 'text-destructive' : used >= 0.7 ? 'text-amber-500' : 'text-primary'

  const rows: Array<[string, string]> = [
    [t.turns, num(turns)],
    [t.messages, num(messageCount)],
    [t.modelCalls, num(runs.length)],
    ['Tool call', num(s.toolCalls)],
    ['Token in', formatTokens(s.input)],
    ['Token out', s.reasoning ? `${formatTokens(s.output)} (reasoning ${formatTokens(s.reasoning)})` : formatTokens(s.output)],
    ['Cache', s.cacheHit === undefined ? '—' : `${fmt(s.cacheHit * 100, '%')} (${formatTokens(s.cacheRead)})`],
    [t.estCost, usd(s.cost)],
  ]

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t.contextLabel}
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <svg viewBox="0 0 16 16" aria-hidden className="size-4 -rotate-90">
          <circle cx="8" cy="8" r={RING_RADIUS} fill="none" strokeWidth="2" className="stroke-muted-foreground/25" />
          <circle
            cx="8"
            cy="8"
            r={RING_RADIUS}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - used)}
            className={cn('transition-[stroke-dashoffset] duration-500 ease-out', tone, used === 0 && 'opacity-0')}
          />
        </svg>
      </TooltipTrigger>
      <TooltipContent className="min-w-56 flex-col items-stretch gap-1 py-2">
        <div className="flex justify-between gap-6 font-medium">
          <span>{t.contextLabel}</span>
          <span className="tabular-nums">{context !== undefined && contextWindow ? fmt(used * 100, '%') : '—'}</span>
        </div>
        {context !== undefined ? (
          <div className="mb-1 opacity-70 tabular-nums">
            {contextWindow
              ? `${formatTokens(context)} / ${formatTokens(contextWindow)} · ${t.contextLeft(formatTokens(Math.max(contextWindow - context, 0)))}`
              : formatTokens(context)}
          </div>
        ) : (
          <div className="mb-1 opacity-70">{t.contextEmpty}</div>
        )}
        {(s.model ?? activeModel?.info?.name) && (
          <div className="mb-0.5 truncate font-mono opacity-70">{s.model ?? activeModel?.info?.name}</div>
        )}
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-6">
            <span className="opacity-70">{label}</span>
            <span className="tabular-nums">{value}</span>
          </div>
        ))}
      </TooltipContent>
    </Tooltip>
  )
}
