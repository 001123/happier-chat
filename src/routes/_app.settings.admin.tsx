import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

/** Hides the admin pages from non-admins. The data boundary is adminMiddleware on each server function. */
export const Route = createFileRoute('/_app/settings/admin')({
  beforeLoad: ({ context }) => {
    if (context.user.role !== 'admin') throw redirect({ to: '/settings', replace: true })
  },
  component: Outlet,
})
