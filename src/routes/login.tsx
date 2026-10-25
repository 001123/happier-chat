import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthForm, safeRedirect } from '@/components/auth-form'
import { defineMessages, getLocale } from '@/lib/i18n'
import { getCurrentUser, getQuickLogins } from '@/server/auth.functions'

const messages = defineMessages({
  vi: { title: 'Đăng nhập · Happier Chat' },
  en: { title: 'Sign in · Happier Chat' },
})

export const Route = createFileRoute('/login')({
  validateSearch: (search): { redirect?: string } =>
    search.redirect === undefined ? {} : { redirect: safeRedirect(search.redirect) },
  beforeLoad: async ({ search }) => {
    if (await getCurrentUser()) throw redirect({ href: search.redirect ?? '/' })
  },
  loader: () => getQuickLogins(),
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect: redirectTo } = Route.useSearch()
  const quickLogins = Route.useLoaderData()
  return <AuthForm mode="login" redirectTo={redirectTo ?? '/'} {...quickLogins} />
}
