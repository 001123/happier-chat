export type UsageKind = 'chat' | 'tts'

/** Usage of one model over a period. `cost` is null when no call was priced; `unpriced` counts the calls missing a price. */
export type UsageModelRow = {
  kind: UsageKind
  provider: string
  model: string
  calls: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  chars: number
  cost: number | null
  unpriced: number
}

/**
 * A scheduled price change of a model the user used lately, with last 30 days' usage priced both ways.
 * A rise (`nextMonthly > currentMonthly`) means the current price is a discount that ends at `effectiveFrom`.
 */
export type UpcomingPrice = {
  kind: UsageKind
  provider: string
  model: string
  name: string
  effectiveFrom: number
  currentMonthly: number
  nextMonthly: number
}

export type UsageSummary = {
  models: Array<UsageModelRow>
  daily: Array<{ day: string; kind: UsageKind; tokens: number; cost: number }>
  upcoming: Array<UpcomingPrice>
}

export const USAGE_PERIODS = [7, 30, 90, 0] as const
export type UsagePeriod = (typeof USAGE_PERIODS)[number]
