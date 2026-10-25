import { createFileRoute, Link, Outlet, useLocation, useRouteContext } from '@tanstack/react-router'
import {
  IconBoxMultiple,
  IconKey,
  IconLanguage,
  IconMessage,
  IconPalette,
  IconTypography,
  IconUser,
  IconUsers,
  IconWaveSine,
} from '@tabler/icons-react'
import { cn } from 'cn'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    settings: 'Cài đặt',
    profile: 'Cá nhân',
    admin: 'Quản trị',
    colors: 'Chủ đề',
    display: 'Hiển thị',
    chat: 'Trò chuyện',
    language: 'Ngôn ngữ',
    voice: 'Giọng nói',
    providers: 'Cấu hình AI',
    models: 'Model',
    users: 'Người dùng',
  },
  en: {
    settings: 'Settings',
    profile: 'Profile',
    admin: 'Administration',
    colors: 'Themes',
    display: 'Display',
    chat: 'Chat',
    language: 'Language',
    voice: 'Voice',
    providers: 'Providers',
    models: 'Models',
    users: 'Users',
  },
})

export const Route = createFileRoute('/_app/settings')({
  ssr: false,
  component: SettingsLayout,
})

const sections = [
  { to: '/settings/profile', label: 'profile', icon: IconUser },
  { to: '/settings/appearance', label: 'colors', icon: IconPalette },
  { to: '/settings/display', label: 'display', icon: IconTypography },
  { to: '/settings/chat', label: 'chat', icon: IconMessage },
  { to: '/settings/language', label: 'language', icon: IconLanguage },
  { to: '/settings/voice', label: 'voice', icon: IconWaveSine },
  { to: '/settings/providers', label: 'providers', icon: IconKey },
] as const

const adminSections = [
  { to: '/settings/admin/models', label: 'models', icon: IconBoxMultiple },
  { to: '/settings/admin/users', label: 'users', icon: IconUsers },
] as const

/** Pages built around a wide table take the full width; forms read better in a narrower column. */
const WIDE_PAGES = new Set<string>(['/settings/admin/models'])

// Switching sections swaps only the page body, so skip the app-wide view transition
// (a 380ms full-screen crossfade) and preload on hover so admin data is ready on click.
const linkProps = { viewTransition: false, preload: 'intent' } as const

const linkClassName =
  'flex h-8 items-center gap-2 rounded-lg px-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:bg-accent hover:text-foreground'

function SettingsLayout() {
  const t = useMessages(messages)
  const { user } = useRouteContext({ from: '/_app' })
  const pathname = useLocation({ select: (location) => location.pathname })
  const wide = WIDE_PAGES.has(pathname)

  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 px-3">
        <SidebarTrigger />
        <h1 className="truncate text-sm font-medium">{t.settings}</h1>
      </header>

      <div className="flex w-full flex-col gap-6 px-4 pt-4 pb-16 md:flex-row md:gap-10 md:px-6">
        <nav className="flex shrink-0 gap-1 overflow-x-auto md:sticky md:top-4 md:w-48 md:flex-col md:self-start">
          {sections.map(({ to, label, icon: Icon }) => (
            <Link key={to} to={to} className={linkClassName} {...linkProps} activeProps={{ className: 'bg-accent font-medium text-foreground' }}>
              <Icon className="size-4" />
              {t[label]}
            </Link>
          ))}
          {user.role === 'admin' && (
            <>
              <span className="mt-4 hidden px-2 pb-1 text-xs font-medium text-muted-foreground md:block">{t.admin}</span>
              {adminSections.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className={linkClassName} {...linkProps} activeProps={{ className: 'bg-accent font-medium text-foreground' }}>
                  <Icon className="size-4" />
                  {t[label]}
                </Link>
              ))}
            </>
          )}
        </nav>
        <main className={cn('min-w-0 flex-1', !wide && 'max-w-4xl')}>
          <div key={pathname} className="animate-in fade-in duration-150 motion-reduce:animate-none">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
