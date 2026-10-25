import { createAnthropicChat } from '@tanstack/ai-anthropic'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'

import type { ModelApi, PresetId, ProviderModel, ProviderView } from '@/lib/providers'
import { decrypt, encrypt } from './crypto.server'
import { getDb } from './db.server'
import { defineMessages, getLocale } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    providerNotFound: 'Không tìm thấy API key',
    missingApiKey: 'Thiếu API key',
    noEndpoint: 'Chưa có endpoint nào',
    noEndpointFor: (api: string) => `Provider chưa có endpoint cho ${api}`,
    modelNotEnabled: (modelId: string, name: string) => `Model ${modelId} chưa được bật trong provider ${name}`,
    noAnthropicEndpoint: (name: string) => `Provider ${name} chưa có endpoint Anthropic`,
    noOpenaiEndpoint: (name: string) => `Provider ${name} chưa có endpoint OpenAI`,
  },
  en: {
    providerNotFound: 'Provider not found',
    missingApiKey: 'Missing API key',
    noEndpoint: 'No endpoint configured',
    noEndpointFor: (api: string) => `Provider has no endpoint for ${api}`,
    modelNotEnabled: (modelId: string, name: string) => `Model ${modelId} is not enabled in provider ${name}`,
    noAnthropicEndpoint: (name: string) => `Provider ${name} has no Anthropic endpoint`,
    noOpenaiEndpoint: (name: string) => `Provider ${name} has no OpenAI endpoint`,
  },
})

type ProviderRow = {
  id: string
  name: string
  preset: PresetId
  anthropic_url: string | null
  openai_url: string | null
  models_url: string | null
  api_key_enc: string
  models: string
}

export type Endpoints = {
  anthropicUrl: string | null
  openaiUrl: string | null
  modelsUrl: string | null
  apiKey: string
}

export type ProviderInput = Omit<Endpoints, 'apiKey'> & {
  id?: string
  name: string
  preset: PresetId
  apiKey?: string
  models: Array<ProviderModel>
}

function keyHint(apiKey: string) {
  return apiKey.length <= 8 ? '••••' : `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`
}

function toView(row: ProviderRow): ProviderView {
  return {
    id: row.id,
    name: row.name,
    preset: row.preset,
    anthropicUrl: row.anthropic_url,
    openaiUrl: row.openai_url,
    modelsUrl: row.models_url,
    keyHint: keyHint(decrypt(row.api_key_enc)),
    models: JSON.parse(row.models) as Array<ProviderModel>,
  }
}

function getRow(userId: string, providerId: string) {
  const row = getDb().prepare('select * from providers where id = ? and user_id = ?').get(providerId, userId) as
    | ProviderRow
    | undefined
  if (!row) throw new Error(messages[getLocale()].providerNotFound)
  return row
}

export function listProviders(userId: string) {
  const rows = getDb().prepare('select * from providers where user_id = ? order by created_at').all(userId) as Array<ProviderRow>
  return rows.map(toView)
}

/** Endpoints of a saved provider, with fields from an unsaved form taking precedence. */
export function resolveEndpoints(userId: string, input: Partial<Endpoints> & { providerId?: string }): Endpoints {
  const row = input.providerId ? getRow(userId, input.providerId) : null
  const apiKey = input.apiKey || (row ? decrypt(row.api_key_enc) : '')
  if (!apiKey) throw new Error(messages[getLocale()].missingApiKey)
  return {
    anthropicUrl: input.anthropicUrl !== undefined ? input.anthropicUrl : (row?.anthropic_url ?? null),
    openaiUrl: input.openaiUrl !== undefined ? input.openaiUrl : (row?.openai_url ?? null),
    modelsUrl: input.modelsUrl !== undefined ? input.modelsUrl : (row?.models_url ?? null),
    apiKey,
  }
}

export function saveProvider(userId: string, input: ProviderInput) {
  const db = getDb()
  const models = JSON.stringify(input.models)
  if (input.id) {
    const row = getRow(userId, input.id)
    const apiKeyEnc = input.apiKey ? encrypt(input.apiKey) : row.api_key_enc
    db.prepare(
      'update providers set name = ?, preset = ?, anthropic_url = ?, openai_url = ?, models_url = ?, api_key_enc = ?, models = ? where id = ? and user_id = ?',
    ).run(input.name, input.preset, input.anthropicUrl, input.openaiUrl, input.modelsUrl, apiKeyEnc, models, input.id, userId)
    return toView(getRow(userId, input.id))
  }
  if (!input.apiKey) throw new Error(messages[getLocale()].missingApiKey)
  const id = crypto.randomUUID()
  db.prepare(
    'insert into providers (id, user_id, name, preset, anthropic_url, openai_url, models_url, api_key_enc, models, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, userId, input.name, input.preset, input.anthropicUrl, input.openaiUrl, input.modelsUrl, encrypt(input.apiKey), models, Date.now())
  return toView(getRow(userId, id))
}

export function deleteProvider(userId: string, providerId: string) {
  getDb().prepare('delete from providers where id = ? and user_id = ?').run(providerId, userId)
}

const trimSlash = (url: string) => url.replace(/\/+$/, '')

/**
 * Headers some presets require. OpenCode Go routes and caches per conversation and asks clients to
 * name themselves: https://opencode.ai/docs/go/#where-can-i-use-it
 */
function presetHeaders(preset: PresetId, sessionId: string): Record<string, string> {
  if (preset !== 'opencode-go') return {}
  return { 'user-agent': `happier-chat/${__APP_VERSION__}`, 'x-opencode-session': sessionId }
}

async function readError(res: Response) {
  const text = await res.text().catch(() => '')
  let message = text
  try {
    const body = JSON.parse(text) as { error?: { message?: string } | string; message?: string }
    message = (typeof body.error === 'string' ? body.error : body.error?.message) ?? body.message ?? text
  } catch {}
  return `HTTP ${res.status}${message ? `: ${message.slice(0, 300)}` : ''}`
}

function anthropicHeaders(apiKey: string) {
  return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
}

function openaiHeaders(apiKey: string) {
  return { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' }
}

/** Model ids the provider lists, from its models URL or the OpenAI / Anthropic `/models` route. */
export async function fetchModelIds(endpoints: Endpoints): Promise<Array<string>> {
  const { anthropicUrl, openaiUrl, modelsUrl, apiKey } = endpoints
  const useAnthropic = !modelsUrl && !openaiUrl && anthropicUrl
  const url = modelsUrl || (openaiUrl ? `${trimSlash(openaiUrl)}/models` : anthropicUrl ? `${trimSlash(anthropicUrl)}/v1/models?limit=1000` : null)
  if (!url) throw new Error(messages[getLocale()].noEndpoint)
  const res = await fetch(url, {
    headers: useAnthropic ? anthropicHeaders(apiKey) : openaiHeaders(apiKey),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(await readError(res))
  const body = (await res.json()) as { data?: Array<{ id: string }> }
  return (body.data ?? []).map((model) => model.id).sort((a, b) => a.localeCompare(b))
}

/** Sends the smallest possible request to one model, to check the key, URL and model id together. */
export async function pingModel(endpoints: Endpoints, preset: PresetId, modelId: string, api: ModelApi) {
  const { anthropicUrl, openaiUrl, apiKey } = endpoints
  const base = api === 'anthropic' ? anthropicUrl : openaiUrl
  if (!base) throw new Error(messages[getLocale()].noEndpointFor(api))
  const request =
    api === 'anthropic'
      ? { path: '/v1/messages', headers: anthropicHeaders(apiKey), body: { model: modelId, max_tokens: 16, messages: [{ role: 'user', content: 'ping' }] } }
      : api === 'chat'
        ? { path: '/chat/completions', headers: openaiHeaders(apiKey), body: { model: modelId, max_tokens: 16, messages: [{ role: 'user', content: 'ping' }] } }
        : { path: '/responses', headers: openaiHeaders(apiKey), body: { model: modelId, max_output_tokens: 16, input: 'ping' } }
  const started = Date.now()
  const res = await fetch(`${trimSlash(base)}${request.path}`, {
    method: 'POST',
    headers: { ...request.headers, ...presetHeaders(preset, crypto.randomUUID()) },
    body: JSON.stringify(request.body),
    signal: AbortSignal.timeout(30_000),
  })
  if (!res.ok) throw new Error(await readError(res))
  return { ms: Date.now() - started }
}

/**
 * A text adapter for one of the user's models. Throws when the provider or model is not theirs.
 * `sessionId` identifies the conversation to providers that route per session.
 */
export function createUserAdapter(userId: string, providerId: string, modelId: string, sessionId: string) {
  const row = getRow(userId, providerId)
  const model = (JSON.parse(row.models) as Array<ProviderModel>).find((m) => m.id === modelId && m.enabled)
  if (!model) throw new Error(messages[getLocale()].modelNotEnabled(modelId, row.name))
  const apiKey = decrypt(row.api_key_enc)
  const defaultHeaders = presetHeaders(row.preset, sessionId)

  if (model.api === 'anthropic') {
    if (!row.anthropic_url) throw new Error(messages[getLocale()].noAnthropicEndpoint(row.name))
    return {
      api: model.api,
      // Arbitrary model ids from the user's provider: the typed model list cannot know them.
      adapter: createAnthropicChat(modelId as 'claude-haiku-5-5', apiKey, { baseURL: trimSlash(row.anthropic_url), defaultHeaders }),
    }
  }
  if (!row.openai_url) throw new Error(messages[getLocale()].noOpenaiEndpoint(row.name))
  return {
    api: model.api,
    adapter: openaiCompatibleText(modelId, {
      name: row.name,
      baseURL: trimSlash(row.openai_url),
      apiKey,
      defaultHeaders,
      api: model.api === 'responses' ? 'responses' : 'chat-completions',
    }),
  }
}
