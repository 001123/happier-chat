import { createAnthropicChat } from '@tanstack/ai-anthropic'
import { createGeminiChat } from '@tanstack/ai-gemini'
import { createOllamaChat } from '@tanstack/ai-ollama'
import { openaiCompatibleText } from '@tanstack/ai-openai/compatible'

import { getPreset } from '@/lib/providers'
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
    noGeminiEndpoint: (name: string) => `Provider ${name} chưa có endpoint Gemini`,
    noOllamaEndpoint: (name: string) => `Provider ${name} chưa có endpoint Ollama`,
  },
  en: {
    providerNotFound: 'Provider not found',
    missingApiKey: 'Missing API key',
    noEndpoint: 'No endpoint configured',
    noEndpointFor: (api: string) => `Provider has no endpoint for ${api}`,
    modelNotEnabled: (modelId: string, name: string) => `Model ${modelId} is not enabled in provider ${name}`,
    noAnthropicEndpoint: (name: string) => `Provider ${name} has no Anthropic endpoint`,
    noOpenaiEndpoint: (name: string) => `Provider ${name} has no OpenAI endpoint`,
    noGeminiEndpoint: (name: string) => `Provider ${name} has no Gemini endpoint`,
    noOllamaEndpoint: (name: string) => `Provider ${name} has no Ollama endpoint`,
  },
})

type ProviderRow = {
  id: string
  name: string
  preset: PresetId
  anthropic_url: string | null
  openai_url: string | null
  gemini_url: string | null
  ollama_url: string | null
  models_url: string | null
  api_key_enc: string
  models: string
}

export type Endpoints = {
  anthropicUrl: string | null
  openaiUrl: string | null
  geminiUrl: string | null
  ollamaUrl: string | null
  modelsUrl: string | null
  /** Empty only for a preset that needs no key (a local Ollama). */
  apiKey: string
}

export type ProviderInput = Omit<Endpoints, 'apiKey'> & {
  id?: string
  name: string
  preset: PresetId
  apiKey?: string
  models: Array<ProviderModel>
}

/** A provider without a key (a local Ollama) stores an empty string: there is nothing to encrypt. */
const encryptKey = (apiKey?: string) => (apiKey ? encrypt(apiKey) : '')
const decryptKey = (stored: string) => (stored ? decrypt(stored) : '')

function keyHint(apiKey: string) {
  if (!apiKey) return ''
  return apiKey.length <= 8 ? '••••' : `${apiKey.slice(0, 4)}…${apiKey.slice(-4)}`
}

function toView(row: ProviderRow): ProviderView {
  return {
    id: row.id,
    name: row.name,
    preset: row.preset,
    anthropicUrl: row.anthropic_url,
    openaiUrl: row.openai_url,
    geminiUrl: row.gemini_url,
    ollamaUrl: row.ollama_url,
    modelsUrl: row.models_url,
    keyHint: keyHint(decryptKey(row.api_key_enc)),
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
export function resolveEndpoints(
  userId: string,
  input: Partial<Endpoints> & { providerId?: string; preset: PresetId },
): Endpoints {
  const row = input.providerId ? getRow(userId, input.providerId) : null
  const apiKey = input.apiKey || (row ? decryptKey(row.api_key_enc) : '')
  if (!apiKey && !getPreset(input.preset).keyOptional) throw new Error(messages[getLocale()].missingApiKey)
  return {
    anthropicUrl: input.anthropicUrl !== undefined ? input.anthropicUrl : (row?.anthropic_url ?? null),
    openaiUrl: input.openaiUrl !== undefined ? input.openaiUrl : (row?.openai_url ?? null),
    geminiUrl: input.geminiUrl !== undefined ? input.geminiUrl : (row?.gemini_url ?? null),
    ollamaUrl: input.ollamaUrl !== undefined ? input.ollamaUrl : (row?.ollama_url ?? null),
    modelsUrl: input.modelsUrl !== undefined ? input.modelsUrl : (row?.models_url ?? null),
    apiKey,
  }
}

export function saveProvider(userId: string, input: ProviderInput) {
  const db = getDb()
  const models = JSON.stringify(input.models)
  if (input.id) {
    const row = getRow(userId, input.id)
    const apiKeyEnc = input.apiKey ? encryptKey(input.apiKey) : row.api_key_enc
    db.prepare(
      'update providers set name = ?, preset = ?, anthropic_url = ?, openai_url = ?, gemini_url = ?, ollama_url = ?, models_url = ?, api_key_enc = ?, models = ? where id = ? and user_id = ?',
    ).run(input.name, input.preset, input.anthropicUrl, input.openaiUrl, input.geminiUrl, input.ollamaUrl, input.modelsUrl, apiKeyEnc, models, input.id, userId)
    return toView(getRow(userId, input.id))
  }
  if (!input.apiKey && !getPreset(input.preset).keyOptional) throw new Error(messages[getLocale()].missingApiKey)
  const id = crypto.randomUUID()
  db.prepare(
    'insert into providers (id, user_id, name, preset, anthropic_url, openai_url, gemini_url, ollama_url, models_url, api_key_enc, models, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(id, userId, input.name, input.preset, input.anthropicUrl, input.openaiUrl, input.geminiUrl, input.ollamaUrl, input.modelsUrl, encryptKey(input.apiKey), models, Date.now())
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

function geminiHeaders(apiKey: string) {
  return { 'x-goog-api-key': apiKey, 'content-type': 'application/json' }
}

/** A local Ollama needs no key; a proxy in front of it may want a bearer token. */
function ollamaHeaders(apiKey: string): Record<string, string> {
  return { 'content-type': 'application/json', ...(apiKey && { authorization: `Bearer ${apiKey}` }) }
}

async function fetchGeminiModelIds(baseUrl: string, apiKey: string) {
  const ids: Array<string> = []
  let pageToken = ''
  // Pages of up to 1000; the loop only guards against a server that never stops returning a token.
  for (let page = 0; page < 5; page++) {
    const res = await fetch(`${trimSlash(baseUrl)}/v1beta/models?pageSize=1000${pageToken && `&pageToken=${encodeURIComponent(pageToken)}`}`, {
      headers: geminiHeaders(apiKey),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(await readError(res))
    const body = (await res.json()) as {
      models?: Array<{ name: string; supportedGenerationMethods?: Array<string> }>
      nextPageToken?: string
    }
    for (const model of body.models ?? []) {
      // The list also holds embedding, image and AQA models that cannot answer a chat message.
      if (model.supportedGenerationMethods?.includes('generateContent')) ids.push(model.name.replace(/^models\//, ''))
    }
    if (!body.nextPageToken) break
    pageToken = body.nextPageToken
  }
  return ids.sort((a, b) => a.localeCompare(b))
}

async function fetchOllamaModelIds(baseUrl: string, apiKey: string) {
  const res = await fetch(`${trimSlash(baseUrl)}/api/tags`, { headers: ollamaHeaders(apiKey), signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(await readError(res))
  const body = (await res.json()) as { models?: Array<{ name: string }> }
  return (body.models ?? []).map((model) => model.name).sort((a, b) => a.localeCompare(b))
}

/** Model ids the provider lists, from its models URL or the OpenAI / Anthropic `/models` route. */
export async function fetchModelIds(endpoints: Endpoints): Promise<Array<string>> {
  const { anthropicUrl, openaiUrl, geminiUrl, ollamaUrl, modelsUrl, apiKey } = endpoints
  if (geminiUrl) return fetchGeminiModelIds(geminiUrl, apiKey)
  if (ollamaUrl) return fetchOllamaModelIds(ollamaUrl, apiKey)
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
  const { anthropicUrl, openaiUrl, geminiUrl, ollamaUrl, apiKey } = endpoints
  const base = { anthropic: anthropicUrl, chat: openaiUrl, responses: openaiUrl, gemini: geminiUrl, ollama: ollamaUrl }[api]
  if (!base) throw new Error(messages[getLocale()].noEndpointFor(api))
  const ping = [{ role: 'user', content: 'ping' }]
  const request = {
    anthropic: { path: '/v1/messages', headers: anthropicHeaders(apiKey), body: { model: modelId, max_tokens: 16, messages: ping } },
    chat: { path: '/chat/completions', headers: openaiHeaders(apiKey), body: { model: modelId, max_tokens: 16, messages: ping } },
    responses: { path: '/responses', headers: openaiHeaders(apiKey), body: { model: modelId, max_output_tokens: 16, input: 'ping' } },
    gemini: {
      path: `/v1beta/models/${encodeURIComponent(modelId)}:generateContent`,
      headers: geminiHeaders(apiKey),
      body: { contents: [{ role: 'user', parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 16 } },
    },
    ollama: { path: '/api/chat', headers: ollamaHeaders(apiKey), body: { model: modelId, messages: ping, stream: false, options: { num_predict: 16 } } },
  }[api]
  const started = Date.now()
  const res = await fetch(`${trimSlash(base)}${request.path}`, {
    method: 'POST',
    headers: { ...request.headers, ...presetHeaders(preset, crypto.randomUUID()) },
    body: JSON.stringify(request.body),
    // Ollama loads the model into memory on its first request, which can take a while.
    signal: AbortSignal.timeout(api === 'ollama' ? 120_000 : 30_000),
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
  const apiKey = decryptKey(row.api_key_enc)
  const defaultHeaders = presetHeaders(row.preset, sessionId)

  if (model.api === 'anthropic') {
    if (!row.anthropic_url) throw new Error(messages[getLocale()].noAnthropicEndpoint(row.name))
    return {
      api: model.api,
      // Arbitrary model ids from the user's provider: the typed model list cannot know them.
      adapter: createAnthropicChat(modelId as 'claude-haiku-5-5', apiKey, { baseURL: trimSlash(row.anthropic_url), defaultHeaders }),
    }
  }
  if (model.api === 'gemini') {
    if (!row.gemini_url) throw new Error(messages[getLocale()].noGeminiEndpoint(row.name))
    return {
      api: model.api,
      adapter: createGeminiChat(modelId as 'gemini-2.5-flash', apiKey, { baseURL: trimSlash(row.gemini_url), defaultHeaders }),
    }
  }
  if (model.api === 'ollama') {
    if (!row.ollama_url) throw new Error(messages[getLocale()].noOllamaEndpoint(row.name))
    return {
      api: model.api,
      adapter: createOllamaChat(modelId, {
        baseURL: trimSlash(row.ollama_url),
        defaultHeaders: { ...defaultHeaders, ...(apiKey && { authorization: `Bearer ${apiKey}` }) },
      }),
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
