import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { listUsers, setUserRole } from './admin.server'
import { adminMiddleware } from './auth.functions'
import {
  addManualModel,
  applySync,
  deleteManualModel,
  deleteScheduledPrice,
  getCatalogMeta,
  listCatalogRows,
  previewSync,
  setCatalogOverride,
  setScheduledPrice,
} from './catalog.server'
import { assertSameOrigin } from './session.server'
import { priceUnpricedUsage } from './usage.server'
import { defineMessages, getLocale } from '@/lib/i18n'

const messages = defineMessages({
  vi: { pickProvider: 'Chọn ít nhất một provider' },
  en: { pickProvider: 'Select at least one provider' },
})

export const getAdminCatalog = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async () => ({ meta: getCatalogMeta(), rows: listCatalogRows() }))

export const previewCatalogSync = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      providers: z
        .array(z.string().trim().min(1).max(100))
        .min(1, { error: () => messages[getLocale()].pickProvider })
        .max(50)
        .transform((ids) => [...new Set(ids)]),
    }),
  )
  .handler(async ({ data }) => {
    assertSameOrigin()
    return previewSync(data.providers)
  })

export const applyCatalogSync = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(z.object({ token: z.string().uuid() }))
  .handler(async ({ data }) => {
    assertSameOrigin()
    const meta = applySync(data.token)
    priceUnpricedUsage()
    return meta
  })

const tokens = z.number().int().positive().max(100_000_000)
const price = z.number().nonnegative().max(100_000)

export const updateCatalogOverride = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      providerId: z.string().min(1).max(100),
      modelId: z.string().min(1).max(200),
      override: z
        .object({
          name: z.string().trim().min(1).max(200).optional(),
          context: tokens.optional(),
          output: tokens.optional(),
          cost: z
            .object({
              input: price.optional(),
              output: price.optional(),
              cacheRead: price.optional(),
              cacheWrite: price.optional(),
            })
            .optional(),
        })
        .nullable(),
    }),
  )
  .handler(async ({ data }) => {
    assertSameOrigin()
    setCatalogOverride(data.providerId, data.modelId, data.override)
    priceUnpricedUsage()
    return { ok: true }
  })

const catalogKey = {
  providerId: z.string().trim().min(1).max(100),
  modelId: z.string().trim().min(1).max(200),
}

export const addCatalogModel = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      ...catalogKey,
      name: z.string().trim().max(200),
      context: tokens.nullable(),
      output: tokens.nullable(),
      cost: z.object({ input: price, output: price, cacheRead: price.nullable(), cacheWrite: price.nullable() }),
    }),
  )
  .handler(async ({ data }) => {
    assertSameOrigin()
    addManualModel(data.providerId, {
      id: data.modelId,
      name: data.name || data.modelId,
      family: null,
      releaseDate: null,
      context: data.context,
      output: data.output,
      cost: data.cost,
      input: ['text'],
      reasoning: false,
      toolCall: false,
      attachment: false,
      openWeights: false,
    })
    priceUnpricedUsage()
    return { ok: true }
  })

export const deleteCatalogModel = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(z.object(catalogKey))
  .handler(async ({ data }) => {
    assertSameOrigin()
    deleteManualModel(data.providerId, data.modelId)
    return { ok: true }
  })

// A day as YYYY-MM-DD, taking effect at its UTC midnight.
const effectiveDay = z.iso.date().transform((day) => Date.parse(`${day}T00:00:00Z`))

export const scheduleCatalogPrice = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(
    z.object({
      ...catalogKey,
      effectiveFrom: effectiveDay,
      cost: z.object({ input: price, output: price, cacheRead: price.nullable(), cacheWrite: price.nullable() }),
    }),
  )
  .handler(async ({ data }) => {
    assertSameOrigin()
    setScheduledPrice(data.providerId, data.modelId, { effectiveFrom: data.effectiveFrom, cost: data.cost })
    priceUnpricedUsage()
    return { ok: true }
  })

export const deleteCatalogPrice = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(z.object({ ...catalogKey, effectiveFrom: z.number().int() }))
  .handler(async ({ data }) => {
    assertSameOrigin()
    deleteScheduledPrice(data.providerId, data.modelId, data.effectiveFrom)
    return { ok: true }
  })

export const getAdminUsers = createServerFn({ method: 'GET' })
  .middleware([adminMiddleware])
  .handler(async () => listUsers())

export const updateUserRole = createServerFn({ method: 'POST' })
  .middleware([adminMiddleware])
  .validator(z.object({ userId: z.string().min(1), role: z.enum(['admin', 'user']) }))
  .handler(async ({ data }) => {
    assertSameOrigin()
    setUserRole(data.userId, data.role)
    return { ok: true }
  })
