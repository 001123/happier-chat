import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from './auth.functions'
import { usageSummary } from './usage.server'
import { USAGE_PERIODS } from '@/lib/usage'

export const getUsageSummary = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ days: z.literal(USAGE_PERIODS) }))
  .handler(async ({ context, data }) => usageSummary(context.user.id, data.days || null))
