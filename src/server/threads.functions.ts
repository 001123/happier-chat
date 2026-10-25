import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from './auth.functions'
import { assertSameOrigin } from './session.server'
import { clearThreadHistory, deleteThreads, importThread, listThreads, patchThreads, upsertThread } from './threads.server'
import { isModeId } from '@/lib/modes'

const id = z.string().min(1).max(100)
const mode = z.string().refine(isModeId)

export const getThreads = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listThreads(context.user.id))

export const saveThread = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id,
      title: z.string().max(200),
      updatedAt: z.number(),
      projectId: id.optional(),
      mode: mode.optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    upsertThread(context.user.id, data)
    return { ok: true }
  })

export const updateThreads = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      ids: z.array(id).max(1000),
      patch: z.object({
        title: z.string().max(200).optional(),
        renamed: z.boolean().optional(),
        archived: z.boolean().optional(),
        projectId: id.nullable().optional(),
        mode: mode.nullable().optional(),
      }),
    }),
  )
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    patchThreads(context.user.id, data.ids, data.patch)
    return { ok: true }
  })

export const removeThreads = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ ids: z.array(id).max(1000) }))
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    deleteThreads(context.user.id, data.ids)
    return { ok: true }
  })

export const clearThread = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ id }))
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    clearThreadHistory(context.user.id, data.id)
    return { ok: true }
  })

export const importLocalThread = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      thread: z.object({
        id,
        title: z.string().max(200),
        updatedAt: z.number(),
        projectId: id.optional(),
        renamed: z.boolean().optional(),
        archived: z.boolean().optional(),
        mode: mode.optional(),
      }),
      messages: z.array(z.looseObject({ role: z.string() })).max(5000),
    }),
  )
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    return importThread(context.user.id, data.thread as never, data.messages as never)
  })
