import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

import { AppSidebar } from '@/components/app-sidebar'
import { ProviderOnboardingDialog } from '@/components/provider-onboarding'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { claimAccountData } from '@/lib/account-data'
import { LEFT_SIDEBAR_COOKIE, readDisplaySettings } from '@/lib/display-settings'
import { providersQueryOptions } from '@/lib/provider-store'
import { getCurrentUser } from '@/server/auth.functions'

const getSidebarOpen = createIsomorphicFn()
  .server(() => getCookie(LEFT_SIDEBAR_COOKIE) !== 'false')
  .client(() => readDisplaySettings().leftSidebarOpen)

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
    if (typeof window !== 'undefined' && claimAccountData(user.id)) {
      // Another account's chats were cached in memory; reload so no store keeps showing them.
      window.location.reload()
      await new Promise(() => {})
    }
    return { user }
  },
  // Providers are seeded into the query cache (dehydrated with the page), so the composer's model picker
  // needs no request after hydration. Later changes go through provider mutations, so this runs once.
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(providersQueryOptions)
    return { sidebarOpen: getSidebarOpen() }
  },
  staleTime: Infinity,
  component: AppLayout,
})

function AppLayout() {
  const { sidebarOpen } = Route.useLoaderData()

  return (
    <SidebarProvider defaultOpen={sidebarOpen}>
      <AppSidebar />
      {/* min-w-0 lets wide tables scroll inside their box instead of widening the page. */}
      <SidebarInset className="min-w-0">
        <Outlet />
      </SidebarInset>
      <ProviderOnboardingDialog />
    </SidebarProvider>
  )
}
