import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from './auth.functions'
import { getDb } from './db.server'
import { assertSameOrigin } from './session.server'

export const PROFILE_NAME_MAX = 80

export const updateProfile = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ name: z.string().trim().max(PROFILE_NAME_MAX) }))
  .handler(async ({ context, data }) => {
    assertSameOrigin()
    getDb().prepare('update users set name = ? where id = ?').run(data.name, context.user.id)
    return { name: data.name }
  })
