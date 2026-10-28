import type { TokenUsage } from '@tanstack/ai'

import { catalogProviderId, PRESETS } from './providers'

/** Model details from models.dev, trimmed to the fields this app shows. Prices are USD per 1M tokens. */
export type CatalogModel = {
  id: string
  name: string
  family: string | null
  releaseDate: string | null
  context: number | null
  output: number | null
  cost: CatalogCost | null
  input: Array<string>
  reasoning: boolean
  toolCall: boolean
  attachment: boolean
  openWeights: boolean
  /** `null` when models.dev does not say; rows synced before these fields existed lack them. */
  structuredOutput?: boolean | null
  temperature?: boolean | null
  lastUpdated?: string | null
}

export type CatalogCost = {
  input: number | null
  output: number | null
  cacheRead: number | null
  cacheWrite: number | null
  /** Audio output, when models.dev prices it apart from text output; rows synced before it existed lack it. */
  outputAudio?: number | null
}

/** Fields an admin may override; a sync from models.dev never touches them. */
export type CatalogOverride = {
  name?: string
  context?: number
  output?: number
  cost?: { [K in keyof CatalogCost]?: number }
}

export type AdminCatalogRow = {
  providerId: string
  model: CatalogModel
  override: CatalogOverride | null
  updatedAt: number
  /** Added by an admin rather than synced from models.dev. */
  manual: boolean
  /** Scheduled prices, oldest first. */
  schedule: Array<ScheduledPrice>
}

/** A price that takes effect at `effectiveFrom` (ms, UTC midnight of the chosen day) and replaces the catalog price. */
export type ScheduledPrice = {
  effectiveFrom: number
  cost: { input: number; output: number; cacheRead: number | null; cacheWrite: number | null }
}

/** The model with the latest scheduled price in effect at `at`, if any; `schedule` is oldest first. */
export function applySchedule(model: CatalogModel, schedule: Array<ScheduledPrice> | undefined, at = Date.now()): CatalogModel {
  const current = schedule?.filter((entry) => entry.effectiveFrom <= at).at(-1)
  return current ? { ...model, cost: current.cost } : model
}

/** The next scheduled price after `now`, if any. */
export function nextPrice(schedule: Array<ScheduledPrice> | undefined, now = Date.now()) {
  return schedule?.find((entry) => entry.effectiveFrom > now) ?? null
}

export type CatalogMeta = { providers: Array<string>; syncedAt: number | null; modelCount: number }

export type SyncChange = { providerId: string; modelId: string; kind: 'added' | 'removed' | 'changed'; fields: Array<string> }

export type SyncPreview =
  | { status: 'unchanged' }
  | {
      status: 'ready'
      token: string
      counts: { added: number; removed: number; changed: number }
      changes: Array<SyncChange>
      available: Array<{ id: string; name: string; models: number }>
    }

/** The models.dev provider ids synced until an admin picks others: the presets this app ships. */
export const DEFAULT_CATALOG_PROVIDERS = PRESETS.filter((preset) => preset.id !== 'custom' && preset.id !== 'ollama').map((preset) =>
  catalogProviderId(preset.id),
)

export function applyOverride(model: CatalogModel, override: CatalogOverride | null): CatalogModel {
  if (!override) return model
  return {
    ...model,
    name: override.name ?? model.name,
    context: override.context ?? model.context,
    output: override.output ?? model.output,
    cost: override.cost
      ? { input: null, output: null, cacheRead: null, cacheWrite: null, ...model.cost, ...override.cost }
      : model.cost,
  }
}

export function formatTokens(value: number | null) {
  if (value === null) return '—'
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}K`
  return String(value)
}

export function formatPrice(value: number | null | undefined) {
  return value === null || value === undefined ? '—' : `$${+value.toFixed(4)}`
}

/**
 * USD cost of one model call from catalog prices per 1M tokens. Prompt tokens include cached ones, so cache
 * reads and writes are priced separately and fall back to the input price when the catalog has none.
 * Speech output is audio, priced at the audio rate when the catalog has one.
 */
export function usageCost(usage: TokenUsage, cost: CatalogCost | null | undefined, { audio = false } = {}) {
  const output = audio ? (cost?.outputAudio ?? cost?.output) : cost?.output
  if (cost?.input == null || output == null) return undefined
  const cacheRead = usage.promptTokensDetails?.cachedTokens ?? 0
  const cacheWrite = usage.promptTokensDetails?.cacheWriteTokens ?? 0
  const uncached = Math.max(0, usage.promptTokens - cacheRead - cacheWrite)
  return (
    (uncached * cost.input +
      cacheRead * (cost.cacheRead ?? cost.input) +
      cacheWrite * (cost.cacheWrite ?? cost.input) +
      usage.completionTokens * output) /
    1_000_000
  )
}
