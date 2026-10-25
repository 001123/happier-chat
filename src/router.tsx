import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  // Created per router so server requests never share a cache.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000 } },
  })

  const router = createRouter({
    routeTree,
    context: { queryClient },
    // Query owns freshness; the router's own preload cache would only get in the way.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultViewTransition: true,
  })

  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
