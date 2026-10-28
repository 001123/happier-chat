import type { ChatMiddleware, GenerationMiddleware, TokenUsage } from '@tanstack/ai'

import { findCatalogModel, findNextPrice } from './catalog.server'
import { getDb } from './db.server'
import { usageCost } from '@/lib/model-catalog'
import type { UpcomingPrice, UsageKind, UsageModelRow, UsageSummary } from '@/lib/usage'

type UsageEvent = {
  userId: string
  kind: UsageKind
  /** The catalog provider id (`anthropic`, `google`, ...), or `edge` for the free voice. */
  provider: string
  model: string
  threadId?: string
  runId?: string
  usage?: TokenUsage
  chars?: number
  cost?: number
}

function recordUsage(event: UsageEvent) {
  const details = event.usage?.promptTokensDetails
  getDb()
    .prepare(
      `insert into usage_events (user_id, kind, provider, model, thread_id, run_id, input_tokens, output_tokens,
        cache_read_tokens, cache_write_tokens, chars, cost_usd, created_at)
       values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.userId,
      event.kind,
      event.provider,
      event.model,
      event.threadId ?? null,
      event.runId ?? null,
      event.usage?.promptTokens ?? 0,
      event.usage?.completionTokens ?? 0,
      details?.cachedTokens ?? 0,
      details?.cacheWriteTokens ?? 0,
      event.chars ?? null,
      event.cost ?? null,
      Date.now(),
    )
}

/** Stats never fail the request they describe: a failed write is logged and dropped. */
function safeRecord(event: UsageEvent) {
  try {
    recordUsage(event)
  } catch (error) {
    console.error('usage: failed to record', error)
  }
}

/**
 * Records every model call of a chat run, priced from the catalog when it happens, so later price
 * changes do not rewrite past costs. `onUsage` fires once per agent-loop step.
 */
export function chatUsageMiddleware(userId: string, catalogProvider: string): ChatMiddleware {
  return {
    name: 'usage',
    onUsage: (ctx, usage) => {
      safeRecord({
        userId,
        kind: 'chat',
        provider: catalogProvider,
        model: ctx.model,
        threadId: ctx.threadId,
        runId: ctx.runId,
        usage,
        cost: usageCost(usage, findCatalogModel(catalogProvider, ctx.model)?.cost),
      })
    },
  }
}

/**
 * Records a speech request: Gemini reports tokens and is priced at the audio rate. Edge and the free OpenRouter
 * models cost nothing; a paid OpenRouter model bills characters, which the catalog cannot price, so it stays unpriced.
 */
export function speechUsageMiddleware(
  userId: string | null,
  engine: 'gemini' | 'edge' | 'openrouter',
  chars: number,
): GenerationMiddleware {
  return {
    name: 'usage',
    onFinish: (ctx, info) => {
      if (!userId) return
      const provider = engine === 'gemini' ? 'google' : engine
      safeRecord({
        userId,
        kind: 'tts',
        provider,
        model: ctx.model,
        threadId: ctx.threadId,
        runId: ctx.runId,
        usage: info.usage,
        chars,
        cost:
          engine === 'edge' || (engine === 'openrouter' && ctx.model.endsWith(':free'))
            ? 0
            : engine === 'gemini' && info.usage
              ? usageCost(info.usage, findCatalogModel(provider, ctx.model)?.cost, { audio: true })
              : undefined,
      })
    },
  }
}

/**
 * Prices calls recorded before their model had a catalog price, at the price in effect when each call happened.
 * Runs after an admin catalog write. Character-billed OpenRouter speech reports no tokens, so it stays unpriced.
 */
export function priceUnpricedUsage() {
  const db = getDb()
  const rows = db
    .prepare(
      `select id, kind, provider, model, input_tokens as inputTokens, output_tokens as outputTokens,
        cache_read_tokens as cacheReadTokens, cache_write_tokens as cacheWriteTokens, created_at as createdAt
       from usage_events where cost_usd is null and provider != 'openrouter' and input_tokens + output_tokens > 0`,
    )
    .all() as Array<
    Pick<UsageModelRow, 'kind' | 'provider' | 'model' | 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens'> & {
      id: number
      createdAt: number
    }
  >
  const update = db.prepare('update usage_events set cost_usd = ? where id = ?')
  for (const row of rows) {
    const cost = usageCost(
      {
        promptTokens: row.inputTokens,
        completionTokens: row.outputTokens,
        totalTokens: row.inputTokens + row.outputTokens,
        promptTokensDetails: { cachedTokens: row.cacheReadTokens, cacheWriteTokens: row.cacheWriteTokens },
      },
      findCatalogModel(row.provider, row.model, row.createdAt)?.cost,
      { audio: row.kind === 'tts' },
    )
    if (cost !== undefined) update.run(cost, row.id)
  }
}

const DAY = 24 * 60 * 60 * 1000

export function usageSummary(userId: string, days: number | null): UsageSummary {
  const since = days ? Date.now() - days * DAY : 0
  const db = getDb()
  const models = db
    .prepare(
      `select kind, provider, model, count(*) as calls,
        sum(input_tokens) as inputTokens, sum(output_tokens) as outputTokens,
        sum(cache_read_tokens) as cacheReadTokens, sum(cache_write_tokens) as cacheWriteTokens,
        coalesce(sum(chars), 0) as chars, sum(cost_usd) as cost,
        sum(case when cost_usd is null then 1 else 0 end) as unpriced
       from usage_events where user_id = ? and created_at >= ?
       group by kind, provider, model order by cost desc, inputTokens + outputTokens desc`,
    )
    .all(userId, since) as Array<UsageModelRow>
  // Days in the server's local time zone; good enough for a personal chart.
  const daily = db
    .prepare(
      `select date(created_at / 1000, 'unixepoch', 'localtime') as day, kind,
        sum(input_tokens + output_tokens) as tokens, coalesce(sum(cost_usd), 0) as cost
       from usage_events where user_id = ? and created_at >= ?
       group by day, kind order by day`,
    )
    .all(userId, since) as Array<{ day: string; kind: UsageKind; tokens: number; cost: number }>
  return { models, daily, upcoming: upcomingPrices(userId) }
}

/** How far ahead a price drop is announced on the usage page; a running discount shows however long it lasts. */
const UPCOMING_WINDOW = 90 * DAY

/** Price changes coming up for models used in the last 30 days, with that usage priced now and after. */
function upcomingPrices(userId: string): Array<UpcomingPrice> {
  const now = Date.now()
  const rows = getDb()
    .prepare(
      `select kind, provider, model, sum(input_tokens) as inputTokens, sum(output_tokens) as outputTokens,
        sum(cache_read_tokens) as cacheReadTokens, sum(cache_write_tokens) as cacheWriteTokens
       from usage_events where user_id = ? and created_at >= ? and provider != 'edge'
       group by kind, provider, model`,
    )
    .all(userId, now - 30 * DAY) as Array<
    Pick<UsageModelRow, 'kind' | 'provider' | 'model' | 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheWriteTokens'>
  >
  const upcoming: Array<UpcomingPrice> = []
  for (const row of rows) {
    const next = findNextPrice(row.provider, row.model, now)
    if (!next) continue
    const current = findCatalogModel(row.provider, row.model, now)
    // Token counts add up, so pricing the month's totals equals pricing each call.
    const usage = {
      promptTokens: row.inputTokens,
      completionTokens: row.outputTokens,
      totalTokens: row.inputTokens + row.outputTokens,
      promptTokensDetails: { cachedTokens: row.cacheReadTokens, cacheWriteTokens: row.cacheWriteTokens },
    }
    const audio = row.kind === 'tts'
    const currentMonthly = usageCost(usage, current?.cost, { audio })
    const nextMonthly = usageCost(usage, next.cost, { audio })
    if (currentMonthly === undefined || nextMonthly === undefined) continue
    if (nextMonthly <= currentMonthly && next.effectiveFrom - now > UPCOMING_WINDOW) continue
    upcoming.push({
      kind: row.kind,
      provider: row.provider,
      model: row.model,
      name: current?.name ?? row.model,
      effectiveFrom: next.effectiveFrom,
      currentMonthly,
      nextMonthly,
    })
  }
  return upcoming.sort((a, b) => a.effectiveFrom - b.effectiveFrom)
}
