import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from './auth.functions'
import { findCatalogModel } from './catalog.server'
import { deleteProvider, fetchModelIds, listProviders, pingModel, resolveEndpoints, saveProvider } from './providers.server'
import { assertSameOrigin } from './session.server'
import { defineMessages, getLocale } from '@/lib/i18n'
import { catalogProviderId } from '@/lib/providers'

const messages = defineMessages({
  vi: {
    invalidUrl: 'URL không hợp lệ',
    urlScheme: 'URL phải bắt đầu bằng http(s)://',
    nameRequired: 'Cần đặt tên hiển thị',
    endpointRequired: 'Cần ít nhất một endpoint (Anthropic, OpenAI, Gemini hoặc Ollama)',
  },
  en: {
    invalidUrl: 'Invalid URL',
    urlScheme: 'URL must start with http(s)://',
    nameRequired: 'Provider name is required',
    endpointRequired: 'At least one endpoint (Anthropic, OpenAI, Gemini or Ollama) is required',
  },
})

const url = z
  .string()
  .trim()
  .url({ error: () => messages[getLocale()].invalidUrl })
  .refine((value) => /^https?:\/\//.test(value), { error: () => messages[getLocale()].urlScheme })
  .nullable()

const api = z.enum(['anthropic', 'chat', 'responses', 'gemini', 'ollama'])
const preset = z.enum(['opencode', 'opencode-go', 'anthropic', 'openai', 'openrouter', 'gemini', 'ollama', 'custom'])

const endpoints = z.object({
  providerId: z.string().optional(),
  anthropicUrl: url.optional(),
  openaiUrl: url.optional(),
  geminiUrl: url.optional(),
  ollamaUrl: url.optional(),
  modelsUrl: url.optional(),
  apiKey: z.string().trim().max(500).optional(),
})

export const getProviders = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) =>
    listProviders(context.user.id).map((provider) => ({
      ...provider,
      models: provider.models.map((model) => ({
        ...model,
        info: findCatalogModel(catalogProviderId(provider.preset), model.id),
      })),
    })),
  )

export const upsertProvider = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z
      .object({
        id: z.string().optional(),
        name: z.string().trim().min(1, { error: () => messages[getLocale()].nameRequired }).max(60),
        preset,
        anthropicUrl: url,
        openaiUrl: url,
        geminiUrl: url,
        ollamaUrl: url,
        modelsUrl: url,
        apiKey: z.string().trim().max(500).optional(),
        models: z.array(z.object({ id: z.string().min(1).max(200), api, enabled: z.boolean() })).max(500),
      })
      .refine((data) => data.anthropicUrl || data.openaiUrl || data.geminiUrl || data.ollamaUrl, { error: () => messages[getLocale()].endpointRequired }),
  )
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    return saveProvider(context.user.id, data)
  })

export const removeProvider = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    deleteProvider(context.user.id, data.id)
    return { ok: true }
  })

export const listRemoteModels = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(endpoints.extend({ preset }))
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    const ids = await fetchModelIds(resolveEndpoints(context.user.id, data))
    return ids.map((id) => ({ id, info: findCatalogModel(catalogProviderId(data.preset), id) }))
  })

/** Catalog details for model ids typed in by hand, so they show prices before the provider is saved. */
export const lookupModels = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ preset, ids: z.array(z.string().min(1).max(200)).max(50) }))
  .handler(async ({ data }) => data.ids.map((id) => ({ id, info: findCatalogModel(catalogProviderId(data.preset), id) })))

export const testModel = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(endpoints.extend({ preset, modelId: z.string().min(1), api }))
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    return pingModel(resolveEndpoints(context.user.id, data), data.preset, data.modelId, data.api)
  })
