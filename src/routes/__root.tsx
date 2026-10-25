/// <reference types="vite/client" />
import type { ReactNode } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { aiDevtoolsPlugin } from '@tanstack/react-ai-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import appCss from '../styles.css?url'
import { themeScript } from '@/components/theme-toggle'
import { buttonVariants } from '@/components/ui/button'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { TooltipProvider } from '@/components/ui/tooltip'
import { customColorsScript } from '@/lib/custom-colors'
import { displaySettingsScript } from '@/lib/display-settings'
import { defineMessages, getLocale, useLocale, useMessages } from '@/lib/i18n'

const SITE_NAME = 'Happier Chat'

const messages = defineMessages({
  vi: {
    siteTitle: 'Happier Chat — Trò chuyện cùng AI, vui hơn mỗi ngày',
    siteDescription: 'Happier Chat — trò chuyện cùng AI, vui hơn mỗi ngày.',
    ogLocale: 'vi_VN',
    notFound: 'Không tìm thấy trang bạn yêu cầu.',
    home: 'Về trang chủ',
  },
  en: {
    siteTitle: 'Happier Chat — Chat with AI, happier every day',
    siteDescription: 'Happier Chat — chat with AI, happier every day.',
    ogLocale: 'en_US',
    notFound: 'The page you requested could not be found.',
    home: 'Back to home',
  },
})

const SITE_URL = (import.meta.env.VITE_SITE_URL ?? '').replace(/\/$/, '')
const OG_IMAGE = `${SITE_URL}/og-image.png`

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => {
    const { siteTitle: SITE_TITLE, siteDescription: SITE_DESCRIPTION, ogLocale } = messages[getLocale()]
    return {
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: SITE_TITLE },
      { name: 'description', content: SITE_DESCRIPTION },
      { name: 'application-name', content: SITE_NAME },
      { name: 'theme-color', content: '#e89f0c' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: SITE_TITLE },
      { property: 'og:description', content: SITE_DESCRIPTION },
      { property: 'og:locale', content: ogLocale },
      ...(SITE_URL ? [{ property: 'og:url', content: SITE_URL }] : []),
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: SITE_NAME },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: SITE_TITLE },
      { name: 'twitter:description', content: SITE_DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.ico', sizes: '48x48' },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
    }
  },
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang={useLocale()} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `${themeScript};${customColorsScript};${displaySettingsScript}` }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          plugins={[
            { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> },
            { name: 'TanStack Query', render: <ReactQueryDevtoolsPanel /> },
            aiDevtoolsPlugin(),
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  return (
    <TooltipProvider>
      <Outlet />
    </TooltipProvider>
  )
}

function NotFound() {
  const t = useMessages(messages)
  return (
    <Empty className="min-h-svh">
      <EmptyHeader>
        <EmptyTitle className="text-2xl">404</EmptyTitle>
        <EmptyDescription>{t.notFound}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Link to="/" className={buttonVariants()}>
          {t.home}
        </Link>
      </EmptyContent>
    </Empty>
  )
}
