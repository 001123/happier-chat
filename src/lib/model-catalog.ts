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
