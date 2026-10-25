import * as React from 'react'
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { HotkeysProvider } from '@tanstack/react-hotkeys'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getCookie } from '@tanstack/react-start/server'

import { AppSidebar } from '@/components/app-sidebar'
import { ProviderOnboardingDialog } from '@/components/provider-onboarding'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { claimAccountData } from '@/lib/account-data'
import { LEFT_SIDEBAR_COOKIE, readDisplaySettings } from '@/lib/display-settings'
import { providersQueryOptions } from '@/lib/provider-store'
import { migrateLocalProjects, projectsQueryOptions } from '@/lib/projects'
import { syncLegacyThreads, threadsQueryOptions } from '@/lib/threads'
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
    // Threads and projects come with the page too (the DB collections start from this cache), so the sidebar and a
    // deep-linked chat know their thread without a second request.
    const [, threads, projects] = await Promise.all([
      context.queryClient.ensureQueryData(providersQueryOptions),
      context.queryClient.ensureQueryData(threadsQueryOptions),
      context.queryClient.ensureQueryData(projectsQueryOptions),
    ])
    return { sidebarOpen: getSidebarOpen(), threads, projects }
  },
  staleTime: Infinity,
  component: AppLayout,
})

function AppLayout() {
  const { sidebarOpen, threads, projects } = Route.useLoaderData()

  // Once per page load: uploads what only this browser knew about from before chats lived on the server.
  // Changes made on another device arrive through the collections' own refetch when the window regains focus.
  React.useEffect(() => {
    syncLegacyThreads(threads)
    void migrateLocalProjects(projects)
  }, [])

  return (
    <HotkeysProvider>
      <SidebarProvider defaultOpen={sidebarOpen}>
        <AppSidebar />
        {/* min-w-0 lets wide tables scroll inside their box instead of widening the page. */}
        <SidebarInset className="min-w-0">
          <Outlet />
        </SidebarInset>
        <ProviderOnboardingDialog />
      </SidebarProvider>
    </HotkeysProvider>
  )
}
