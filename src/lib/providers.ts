import type { Locale } from './i18n'
import type { CatalogModel } from './model-catalog'

/** Which wire format a model is called with. */
export type ModelApi = 'anthropic' | 'chat' | 'responses' | 'gemini' | 'ollama'

/** `info` comes from the model catalog on read and is never stored with the provider. */
export type ProviderModel = { id: string; api: ModelApi; enabled: boolean; info?: CatalogModel | null }

/** A provider as the browser sees it: the API key never leaves the server, only a hint. */
export type ProviderView = {
  id: string
  name: string
  preset: PresetId
  anthropicUrl: string | null
  openaiUrl: string | null
  geminiUrl: string | null
  ollamaUrl: string | null
  modelsUrl: string | null
  keyHint: string
  models: Array<ProviderModel>
}

export const MODEL_API_LABELS: Record<ModelApi, string> = {
  anthropic: 'Anthropic Messages',
  chat: 'OpenAI Chat Completions',
  responses: 'OpenAI Responses',
  gemini: 'Google Gemini',
  ollama: 'Ollama',
}

export const MODEL_API_SHORT_LABELS: Record<ModelApi, string> = {
  anthropic: 'Messages',
  chat: 'Chat',
  responses: 'Responses',
  gemini: 'Gemini',
  ollama: 'Ollama',
}

export type PresetId = 'opencode-go' | 'anthropic' | 'openai' | 'openrouter' | 'gemini' | 'ollama' | 'custom'

export type ProviderPreset = {
  id: PresetId
  label: Record<Locale, string>
  description: Record<Locale, string>
  anthropicUrl: string | null
  openaiUrl: string | null
  geminiUrl?: string | null
  ollamaUrl?: string | null
  modelsUrl: string | null
  keyUrl?: string
  /** A local server such as Ollama accepts calls without a key. */
  keyOptional?: boolean
  /** The format of a model id, or null for a model this app cannot call. */
  apiFor?: (modelId: string) => ModelApi | null
}

// https://opencode.ai/docs/go/ — each model is served on one wire format.
const OPENCODE_GO_ANTHROPIC = new Set(['claude-haiku-5-5', 'minimax-m3', 'qwen3.8-max', 'qwen3.8-flash', 'qwen3.7-plus'])
const OPENCODE_GO_RESPONSES = new Set([
  'grok-4.7',
  'gpt-6-luna',
  'gpt-5.6-luna',
  'muse-spark-1.3-contributor',
  'muse-spark-1.2-contributor',
])

export const PRESETS: Array<ProviderPreset> = [
  {
    id: 'opencode-go',
    label: { vi: 'OpenCode Go', en: 'OpenCode Go' },
    description: { vi: 'Gói OpenCode Go: GLM, Kimi, DeepSeek, Qwen, Claude Haiku… chung một key.', en: 'OpenCode Go plan: GLM, Kimi, DeepSeek, Qwen, Claude Haiku… on a single key.' },
    anthropicUrl: 'https://opencode.ai/inference/go/anthropic',
    openaiUrl: 'https://opencode.ai/inference/go/openai/v1',
    modelsUrl: 'https://opencode.ai/inference/go/v1/models',
    keyUrl: 'https://opencode.ai/auth',
    apiFor: (id) => {
      if (OPENCODE_GO_ANTHROPIC.has(id)) return 'anthropic'
      if (OPENCODE_GO_RESPONSES.has(id)) return 'responses'
      if (id.startsWith('gemini')) return null
      return 'chat'
    },
  },
  {
    id: 'anthropic',
    label: { vi: 'Anthropic', en: 'Anthropic' },
    description: { vi: 'API chính thức của Anthropic (Claude).', en: 'Official Anthropic (Claude) API.' },
    anthropicUrl: 'https://api.anthropic.com',
    openaiUrl: null,
    modelsUrl: null,
    keyUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openai',
    label: { vi: 'OpenAI', en: 'OpenAI' },
    description: { vi: 'API chính thức của OpenAI.', en: 'Official OpenAI API.' },
    anthropicUrl: null,
    openaiUrl: 'https://api.openai.com/v1',
    modelsUrl: null,
    keyUrl: 'https://platform.openai.com/api-keys',
    apiFor: () => 'responses',
  },
  {
    id: 'openrouter',
    label: { vi: 'OpenRouter', en: 'OpenRouter' },
    description: { vi: 'Hàng trăm model qua một endpoint tương thích OpenAI.', en: 'Hundreds of models through one OpenAI-compatible endpoint.' },
    anthropicUrl: null,
    openaiUrl: 'https://openrouter.ai/api/v1',
    modelsUrl: null,
    keyUrl: 'https://openrouter.ai/settings/keys',
  },
  {
    id: 'gemini',
    label: { vi: 'Google Gemini', en: 'Google Gemini' },
    description: { vi: 'API chính thức của Google AI Studio (Gemini).', en: 'Official Google AI Studio (Gemini) API.' },
    anthropicUrl: null,
    openaiUrl: null,
    geminiUrl: 'https://generativelanguage.googleapis.com',
    modelsUrl: null,
    keyUrl: 'https://aistudio.google.com/apikey',
    apiFor: () => 'gemini',
  },
  {
    id: 'ollama',
    label: { vi: 'Ollama (local)', en: 'Ollama (local)' },
    description: { vi: 'Model chạy trên máy bạn qua Ollama. Không cần API key.', en: 'Models running on your machine through Ollama. No API key needed.' },
    anthropicUrl: null,
    openaiUrl: null,
    ollamaUrl: 'http://localhost:11434',
    modelsUrl: null,
    keyOptional: true,
    apiFor: () => 'ollama',
  },
  {
    id: 'custom',
    label: { vi: 'Tuỳ chỉnh', en: 'Custom' },
    description: { vi: 'Endpoint bất kỳ tương thích Anthropic hoặc OpenAI (LiteLLM, vLLM, LM Studio…).', en: 'Any Anthropic- or OpenAI-compatible endpoint (LiteLLM, vLLM, LM Studio…).' },
    anthropicUrl: null,
    openaiUrl: null,
    modelsUrl: null,
  },
]

export function getPreset(id: string): ProviderPreset {
  return PRESETS.find((preset) => preset.id === id) ?? PRESETS[PRESETS.length - 1]!
}

/** Key of the provider whose model details the catalog files this preset under. */
export function catalogProviderId(preset: string) {
  return preset === 'gemini' ? 'google' : preset
}

/** Best guess of a model's wire format from the preset and the endpoints the provider has. */
export function guessModelApi(
  preset: ProviderPreset,
  urls: { anthropicUrl: string | null; openaiUrl: string | null },
  modelId: string,
): ModelApi | null {
  if (preset.apiFor) return preset.apiFor(modelId)
  if (urls.anthropicUrl && (!urls.openaiUrl || modelId.startsWith('claude'))) return 'anthropic'
  if (urls.openaiUrl) return 'chat'
  return null
}

/** The selection key of a model in the composer: `<providerId>/<modelId>`. */
export function modelKey(providerId: string, modelId: string) {
  return `${providerId}/${modelId}`
}

export function parseModelKey(key: string) {
  const slash = key.indexOf('/')
  if (slash <= 0) return null
  return { providerId: key.slice(0, slash), modelId: key.slice(slash + 1) }
}
