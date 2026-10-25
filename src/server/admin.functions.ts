import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { listUsers, setUserRole } from './admin.server'
import { adminMiddleware } from './auth.functions'
import { applySync, getCatalogMeta, listCatalogRows, previewSync, setCatalogOverride } from './catalog.server'
import { assertSameOrigin } from './session.server'
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
    return applySync(data.token)
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
