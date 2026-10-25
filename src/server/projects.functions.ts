import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from './auth.functions'
import { deleteProjects, insertProjects, listProjects, patchProject } from './projects.server'
import { assertSameOrigin } from './session.server'

const id = z.string().min(1).max(100)

const project = z.object({
  id,
  name: z.string().min(1).max(200),
  createdAt: z.number(),
  collapsed: z.boolean().optional(),
  instructions: z.string().max(20_000).optional(),
})

export const getProjects = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context }) => listProjects(context.user.id))

// Also carries the one-time upload of projects that only existed in a browser.
export const saveProjects = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ projects: z.array(project).max(1000) }))
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    insertProjects(context.user.id, data.projects)
    return { ok: true }
  })

export const updateProject = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id,
      patch: z.object({
        name: z.string().min(1).max(200).optional(),
        collapsed: z.boolean().optional(),
        instructions: z.string().max(20_000).nullable().optional(),
      }),
    }),
  )
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    patchProject(context.user.id, data.id, data.patch)
    return { ok: true }
  })

export const removeProjects = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ ids: z.array(id).max(1000) }))
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    deleteProjects(context.user.id, data.ids)
    return { ok: true }
  })
