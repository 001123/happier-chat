import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthForm, safeRedirect } from '@/components/auth-form'
import { defineMessages, getLocale } from '@/lib/i18n'
import { getCurrentUser, getQuickLogins } from '@/server/auth.functions'

const messages = defineMessages({
  vi: { title: 'Đăng ký · Happier Chat' },
  en: { title: 'Sign up · Happier Chat' },
})

export const Route = createFileRoute('/signup')({
  validateSearch: (search): { redirect?: string } =>
    search.redirect === undefined ? {} : { redirect: safeRedirect(search.redirect) },
  beforeLoad: async ({ search }) => {
    if (await getCurrentUser()) throw redirect({ href: search.redirect ?? '/' })
  },
  loader: () => getQuickLogins(),
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  component: SignupPage,
})

function SignupPage() {
  const { redirect: redirectTo } = Route.useSearch()
  const quickLogins = Route.useLoaderData()
  return <AuthForm mode="signup" redirectTo={redirectTo ?? '/'} {...quickLogins} />
}
