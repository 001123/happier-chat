import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_app/')({
  beforeLoad: () => {
    throw redirect({
      to: '/chat/$threadId',
      params: { threadId: crypto.randomUUID() },
      replace: true,
    })
  },
})
