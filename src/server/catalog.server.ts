import { Effect, Predicate, Schedule, Schema } from 'effect'

import { applyOverride, applySchedule, DEFAULT_CATALOG_PROVIDERS, nextPrice } from '@/lib/model-catalog'
import type {
  AdminCatalogRow,
  CatalogMeta,
  CatalogModel,
  CatalogOverride,
  ScheduledPrice,
  SyncChange,
  SyncPreview,
} from '@/lib/model-catalog'

import { getDb } from './db.server'
import { defineMessages, getLocale } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    invalidData: 'Dữ liệu models.dev không hợp lệ',
    httpError: (status: number) => `models.dev trả về lỗi ${status}`,
    networkError: 'Không kết nối được tới models.dev',
    timeout: 'models.dev phản hồi quá lâu',
    previewExpired: 'Bản xem trước đã hết hạn, hãy kiểm tra cập nhật lại',
    modelNotFound: 'Không tìm thấy model',
    modelExists: 'Model này đã có trong danh mục; hãy sửa nó thay vì thêm mới',
    unknownProviders: (ids: string) => `models.dev không có provider: ${ids}`,
  },
  en: {
    invalidData: 'Invalid models.dev data',
    httpError: (status: number) => `models.dev returned error ${status}`,
    networkError: 'Could not reach models.dev',
    timeout: 'models.dev took too long to respond',
    previewExpired: 'The preview has expired, please check for updates again',
    modelNotFound: 'Model not found',
    modelExists: 'This model is already in the catalog; edit it instead',
    unknownProviders: (ids: string) => `models.dev has no provider: ${ids}`,
  },
})

const SOURCE_URL = 'https://models.dev/api.json'
const ATTEMPT_TIMEOUT = '15 seconds'
const PENDING_TTL = 10 * 60_000
const MAX_LISTED_CHANGES = 500

type SourceProvider = { name: string; models: Record<string, CatalogModel> }

type SourceResult =
  | { status: 'unchanged' }
  | { status: 'ready'; source: Record<string, SourceProvider>; etag: string | null }

/** models.dev could not be reached or answered with an error; `retryable` drives the backoff. */
class CatalogFetchError extends Schema.TaggedError<CatalogFetchError>()('CatalogFetchError', {
  message: Schema.String,
  retryable: Schema.Boolean,
}) {}

/** models.dev answered, but the snapshot cannot be used. Never retried. */
class CatalogDataError extends Schema.TaggedError<CatalogDataError>()('CatalogDataError', {
  message: Schema.String,
}) {}

/** Up to 2 retries with jittered exponential backoff, only for network errors, timeouts, 429 and 5xx. */
const retrySchedule = Schedule.exponential('500 millis').pipe(
  Schedule.jittered,
  Schedule.upTo({ times: 2 }),
  Schedule.setInputType<CatalogFetchError | CatalogDataError>(),
  Schedule.while(({ input }) => input._tag === 'CatalogFetchError' && input.retryable),
)

/** A fetched snapshot waiting for the admin to confirm its diff. */
type Pending = {
  token: string
  etag: string | null
  providers: Array<string>
  source: Record<string, SourceProvider>
  expiresAt: number
}

let pending: Pending | null = null
let cache: Record<string, Record<string, CatalogModel>> | null = null
let index: Map<string, { providerId: string; model: CatalogModel }> | null = null
let schedules: Map<string, Array<ScheduledPrice>> | null = null

type MetaRow = { providers: string; etag: string | null; synced_at: number | null }

function readMeta() {
  const row = getDb().prepare('select providers, etag, synced_at from catalog_meta where id = 1').get() as MetaRow | undefined
  return {
    providers: row ? (JSON.parse(row.providers) as Array<string>) : DEFAULT_CATALOG_PROVIDERS,
    etag: row?.etag ?? null,
    syncedAt: row?.synced_at ?? null,
  }
}

export function getCatalogMeta(): CatalogMeta {
  const { providers, syncedAt } = readMeta()
  const { count } = getDb().prepare('select count(*) as count from model_catalog').get() as { count: number }
  return { providers, syncedAt, modelCount: count }
}

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const str = (value: unknown) => (typeof value === 'string' && value ? value : null)

function slimModel(id: string, raw: Record<string, any>): CatalogModel {
  const cost = raw.cost && typeof raw.cost === 'object' ? raw.cost : null
  return {
    id,
    name: str(raw.name) ?? id,
    family: str(raw.family),
    releaseDate: str(raw.release_date),
    context: num(raw.limit?.context),
    output: num(raw.limit?.output),
    cost: cost
      ? {
          input: num(cost.input),
          output: num(cost.output),
          cacheRead: num(cost.cache_read),
          cacheWrite: num(cost.cache_write),
          outputAudio: num(cost.output_audio),
        }
      : null,
    input: Array.isArray(raw.modalities?.input) ? raw.modalities.input.filter((item: unknown) => typeof item === 'string') : [],
    reasoning: raw.reasoning === true,
    toolCall: raw.tool_call === true,
    attachment: raw.attachment === true,
    openWeights: raw.open_weights === true,
    structuredOutput: typeof raw.structured_output === 'boolean' ? raw.structured_output : null,
    temperature: typeof raw.temperature === 'boolean' ? raw.temperature : null,
    lastUpdated: str(raw.last_updated),
  }
}

function slimSource(raw: object) {
  const source: Record<string, SourceProvider> = {}
  for (const [providerId, provider] of Object.entries(raw as Record<string, any>)) {
    if (!provider || typeof provider.models !== 'object') continue
    const models: Record<string, CatalogModel> = {}
    for (const [modelId, model] of Object.entries(provider.models as Record<string, any>)) {
      if (model && typeof model === 'object') models[modelId] = slimModel(modelId, model)
    }
    source[providerId] = { name: str(provider.name) ?? providerId, models }
  }
  return source
}

const sameList = (a: Array<string>, b: Array<string>) => a.length === b.length && a.every((item) => b.includes(item))

/**
 * One models.dev download: each attempt (request and body) is capped at {@link ATTEMPT_TIMEOUT}
 * and aborted on timeout, then retried per {@link retrySchedule}. Messages are resolved up front
 * because the locale is read from the request.
 */
const fetchSource = Effect.fn('fetchSource')(
  function* (
    etag: string | null,
    t: (typeof messages)['en'],
  ): Effect.fn.Return<SourceResult, CatalogFetchError | CatalogDataError> {
    const { response, body } = yield* Effect.tryPromise({
      try: async (signal) => {
        const response = await fetch(SOURCE_URL, { headers: etag ? { 'if-none-match': etag } : {}, signal })
        if (response.status === 304 || !response.ok) return { response, body: null }
        return { response, body: (await response.json()) as unknown }
      },
      catch: (cause) =>
        cause instanceof SyntaxError
          ? new CatalogDataError({ message: t.invalidData })
          : new CatalogFetchError({ message: t.networkError, retryable: true }),
    }).pipe(
      Effect.timeout(ATTEMPT_TIMEOUT),
      Effect.catchTag('TimeoutError', () => Effect.fail(new CatalogFetchError({ message: t.timeout, retryable: true }))),
    )
    if (response.status === 304) return { status: 'unchanged' }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500
      return yield* new CatalogFetchError({ message: t.httpError(response.status), retryable })
    }
    if (!Predicate.isObject(body)) return yield* new CatalogDataError({ message: t.invalidData })
    return { status: 'ready', source: slimSource(body), etag: response.headers.get('etag') }
  },
  Effect.retry(retrySchedule),
)

/**
 * Fetches models.dev and diffs it against the stored catalog. The ETag is sent only when the
 * provider selection is unchanged: a 304 then means there is nothing to apply.
 */
export async function previewSync(providers: Array<string>): Promise<SyncPreview> {
  const meta = readMeta()
  const conditional = meta.etag && meta.syncedAt && sameList(providers, meta.providers)
  const result = await Effect.runPromise(fetchSource(conditional ? meta.etag : null, messages[getLocale()]))
  if (result.status === 'unchanged') return result
  const { source, etag } = result

  const unknown = providers.filter((id) => !source[id])
  if (unknown.length) throw new Error(messages[getLocale()].unknownProviders(unknown.join(', ')))

  const stored = new Map<string, string>()
  const rows = getDb().prepare('select provider_id, model_id, data from model_catalog where manual = 0').all() as Array<{
    provider_id: string
    model_id: string
    data: string
  }>
  for (const row of rows) stored.set(`${row.provider_id}\u0000${row.model_id}`, row.data)

  const changes: Array<SyncChange> = []
  const seen = new Set<string>()
  for (const providerId of providers) {
    for (const model of Object.values(source[providerId]!.models)) {
      const key = `${providerId}\u0000${model.id}`
      seen.add(key)
      const before = stored.get(key)
      if (!before) {
        changes.push({ providerId, modelId: model.id, kind: 'added', fields: [] })
        continue
      }
      const old = JSON.parse(before) as CatalogModel
      const fields = (Object.keys(model) as Array<keyof CatalogModel>).filter(
        (field) => JSON.stringify(old[field]) !== JSON.stringify(model[field]),
      )
      if (fields.length) changes.push({ providerId, modelId: model.id, kind: 'changed', fields })
    }
  }
  for (const row of rows) {
    if (!seen.has(`${row.provider_id}\u0000${row.model_id}`)) {
      changes.push({ providerId: row.provider_id, modelId: row.model_id, kind: 'removed', fields: [] })
    }
  }

  const token = crypto.randomUUID()
  pending = { token, etag, providers, source, expiresAt: Date.now() + PENDING_TTL }

  const count = (kind: SyncChange['kind']) => changes.filter((change) => change.kind === kind).length
  return {
    status: 'ready',
    token,
    counts: { added: count('added'), removed: count('removed'), changed: count('changed') },
    changes: changes.slice(0, MAX_LISTED_CHANGES),
    available: Object.entries(source)
      .map(([id, provider]) => ({ id, name: provider.name, models: Object.keys(provider.models).length }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  }
}

/** Writes the previewed snapshot. Overrides survive; models gone from models.dev are removed with theirs. */
export function applySync(token: string) {
  if (!pending || pending.token !== token || pending.expiresAt < Date.now()) {
    pending = null
    throw new Error(messages[getLocale()].previewExpired)
  }
  const { providers, source, etag } = pending
  const db = getDb()
  const now = Date.now()
  const upsert = db.prepare(
    `insert into model_catalog (provider_id, model_id, data, updated_at) values (?, ?, ?, ?)
     on conflict(provider_id, model_id) do update set data = excluded.data, manual = 0,
       updated_at = case when model_catalog.data = excluded.data then model_catalog.updated_at else excluded.updated_at end`,
  )
  db.exec('begin')
  try {
    db.exec('create temp table if not exists synced (provider_id text, model_id text)')
    db.exec('delete from synced')
    const mark = db.prepare('insert into synced values (?, ?)')
    for (const providerId of providers) {
      for (const model of Object.values(source[providerId]!.models)) {
        upsert.run(providerId, model.id, JSON.stringify(model), now)
        mark.run(providerId, model.id)
      }
    }
    db.exec(
      'delete from model_catalog where manual = 0 and not exists (select 1 from synced where synced.provider_id = model_catalog.provider_id and synced.model_id = model_catalog.model_id)',
    )
    db.prepare(
      `insert into catalog_meta (id, providers, etag, synced_at) values (1, ?, ?, ?)
       on conflict(id) do update set providers = excluded.providers, etag = excluded.etag, synced_at = excluded.synced_at`,
    ).run(JSON.stringify(providers), etag, now)
    db.exec('commit')
  } catch (error) {
    db.exec('rollback')
    throw error
  }
  pending = null
  cache = index = null
  return getCatalogMeta()
}

type CatalogRow = {
  provider_id: string
  model_id: string
  data: string
  override: string | null
  updated_at: number
  manual: number
}

export function listCatalogRows(): Array<AdminCatalogRow> {
  const rows = getDb()
    .prepare('select provider_id, model_id, data, override, updated_at, manual from model_catalog order by provider_id, model_id')
    .all() as Array<CatalogRow>
  const schedule = getSchedules()
  return rows.map((row) => ({
    schedule: schedule.get(scheduleKey(row.provider_id, row.model_id)) ?? [],
    providerId: row.provider_id,
    model: JSON.parse(row.data) as CatalogModel,
    override: row.override ? (JSON.parse(row.override) as CatalogOverride) : null,
    updatedAt: row.updated_at,
    manual: row.manual === 1,
  }))
}

/**
 * Adds a model models.dev does not list. Once models.dev lists it under the same provider, a sync takes
 * the row over and keeps any override.
 */
export function addManualModel(providerId: string, model: CatalogModel) {
  const result = getDb()
    .prepare(
      `insert into model_catalog (provider_id, model_id, data, updated_at, manual) values (?, ?, ?, ?, 1)
       on conflict(provider_id, model_id) do nothing`,
    )
    .run(providerId, model.id, JSON.stringify(model), Date.now())
  if (result.changes === 0) throw new Error(messages[getLocale()].modelExists)
  cache = index = null
}

/** Removes a model an admin added; synced models are only removed by a sync. */
export function deleteManualModel(providerId: string, modelId: string) {
  const result = getDb()
    .prepare('delete from model_catalog where provider_id = ? and model_id = ? and manual = 1')
    .run(providerId, modelId)
  if (result.changes === 0) throw new Error(messages[getLocale()].modelNotFound)
  getDb().prepare('delete from model_price_schedule where provider_id = ? and model_id = ?').run(providerId, modelId)
  cache = index = schedules = null
}

/** Saves an admin override, or clears it when `override` is null or empty. */
export function setCatalogOverride(providerId: string, modelId: string, override: CatalogOverride | null) {
  const empty = !override || Object.values(override).every((value) => value === undefined)
  const result = getDb()
    .prepare('update model_catalog set override = ?, updated_at = ? where provider_id = ? and model_id = ?')
    .run(empty ? null : JSON.stringify(override), Date.now(), providerId, modelId)
  if (result.changes === 0) throw new Error(messages[getLocale()].modelNotFound)
  cache = index = null
}

/** The merged catalog for every user, served from memory and rebuilt after an admin write. */
export function getCatalog() {
  if (cache) return cache
  const next: Record<string, Record<string, CatalogModel>> = {}
  for (const row of listCatalogRows()) {
    ;(next[row.providerId] ??= {})[row.model.id] = applyOverride(row.model, row.override)
  }
  cache = next
  return next
}

/** Strips a vendor prefix and lowercases, so `anthropic/Claude-X` and `claude-x` meet. */
const bareId = (modelId: string) => modelId.slice(modelId.lastIndexOf('/') + 1).toLowerCase()

function locateModel(providerId: string, modelId: string) {
  const catalog = getCatalog()
  const own = catalog[providerId]?.[modelId]
  if (own) return { providerId, model: own }
  if (!index) {
    index = new Map()
    for (const [id, models] of Object.entries(catalog)) {
      for (const model of Object.values(models)) {
        if (!index.has(bareId(model.id))) index.set(bareId(model.id), { providerId: id, model })
      }
    }
  }
  return index.get(bareId(modelId)) ?? null
}

/**
 * Details for a model a user enabled, priced as of `at`: the provider's own entry first, then any synced
 * provider with the same bare id, which covers custom gateways that re-serve well-known models.
 */
export function findCatalogModel(providerId: string, modelId: string, at = Date.now()): CatalogModel | null {
  const found = locateModel(providerId, modelId)
  if (!found) return null
  return applySchedule(found.model, getSchedules().get(scheduleKey(found.providerId, found.model.id)), at)
}

/** The next scheduled price change of a model, if one is coming. */
export function findNextPrice(providerId: string, modelId: string, now = Date.now()) {
  const found = locateModel(providerId, modelId)
  if (!found) return null
  return nextPrice(getSchedules().get(scheduleKey(found.providerId, found.model.id)), now)
}

const scheduleKey = (providerId: string, modelId: string) => `${providerId}\u0000${modelId}`

function getSchedules() {
  if (schedules) return schedules
  const rows = getDb()
    .prepare('select provider_id, model_id, effective_from, cost from model_price_schedule order by effective_from')
    .all() as Array<{ provider_id: string; model_id: string; effective_from: number; cost: string }>
  const next = new Map<string, Array<ScheduledPrice>>()
  for (const row of rows) {
    const key = scheduleKey(row.provider_id, row.model_id)
    next.set(key, [...(next.get(key) ?? []), { effectiveFrom: row.effective_from, cost: JSON.parse(row.cost) }])
  }
  schedules = next
  return next
}

/** Schedules a price from `effectiveFrom`, replacing one already set for that day. */
export function setScheduledPrice(providerId: string, modelId: string, price: ScheduledPrice) {
  const exists = getDb().prepare('select 1 from model_catalog where provider_id = ? and model_id = ?').get(providerId, modelId)
  if (!exists) throw new Error(messages[getLocale()].modelNotFound)
  getDb()
    .prepare(
      `insert into model_price_schedule (provider_id, model_id, effective_from, cost) values (?, ?, ?, ?)
       on conflict(provider_id, model_id, effective_from) do update set cost = excluded.cost`,
    )
    .run(providerId, modelId, price.effectiveFrom, JSON.stringify(price.cost))
  schedules = null
}

export function deleteScheduledPrice(providerId: string, modelId: string, effectiveFrom: number) {
  getDb()
    .prepare('delete from model_price_schedule where provider_id = ? and model_id = ? and effective_from = ?')
    .run(providerId, modelId, effectiveFrom)
  schedules = null
}
