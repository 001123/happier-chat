import * as React from 'react'
import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { IconFlask, IconLoader2, IconShield } from '@tabler/icons-react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { errorMessage } from '@/lib/utils'
import { login, loginAdmin, loginDemo, signup } from '@/server/auth.functions'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    mismatch: 'Mật khẩu nhập lại không khớp',
    signupTitle: 'Tạo tài khoản',
    loginTitle: 'Chào mừng trở lại',
    signupHint: 'Đăng ký để lưu provider và model của riêng bạn.',
    loginHint: 'Đăng nhập để tiếp tục trò chuyện.',
    password: 'Mật khẩu',
    confirmPassword: 'Nhập lại mật khẩu',
    signup: 'Đăng ký',
    login: 'Đăng nhập',
    useDemo: 'Dùng tài khoản demo',
    loginAdmin: 'Đăng nhập admin',
    haveAccount: 'Đã có tài khoản? ',
    noAccount: 'Chưa có tài khoản? ',
  },
  en: {
    mismatch: 'Passwords do not match',
    signupTitle: 'Create an account',
    loginTitle: 'Welcome back',
    signupHint: 'Sign up to save your own providers and models.',
    loginHint: 'Sign in to continue chatting.',
    password: 'Password',
    confirmPassword: 'Confirm password',
    signup: 'Sign up',
    login: 'Sign in',
    useDemo: 'Use demo account',
    loginAdmin: 'Sign in as admin',
    haveAccount: 'Already have an account? ',
    noAccount: "Don't have an account? ",
  },
})

/** Open-redirect guard: only same-app paths. */
export function safeRedirect(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export function AuthForm({
  mode,
  redirectTo,
  demoEmail,
  adminEmail,
}: {
  mode: 'login' | 'signup'
  redirectTo: string
  demoEmail?: string | null
  adminEmail?: string | null
}) {
  const t = useMessages(messages)
  const router = useRouter()
  const navigate = useNavigate()
  const [error, setError] = React.useState('')
  const [pending, setPending] = React.useState(false)
  const isSignup = mode === 'signup'

  async function run(action: () => Promise<unknown>) {
    setError('')
    setPending(true)
    try {
      await action()
      await router.invalidate()
      await navigate({ href: redirectTo, replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setPending(false)
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    if (isSignup && password !== form.get('confirm')) return setError(t.mismatch)
    void run(() => (isSignup ? signup : login)({ data: { email, password } }))
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo className="size-10" />
          <h1 className="font-serif text-3xl tracking-tight">{isSignup ? t.signupTitle : t.loginTitle}</h1>
          <p className="text-sm text-muted-foreground">
            {isSignup ? t.signupHint : t.loginHint}
          </p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border bg-card p-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">{t.password}</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignup ? 'new-password' : 'current-password'}
              minLength={isSignup ? 8 : undefined}
              required
            />
          </div>
          {isSignup && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm">{t.confirmPassword}</Label>
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
            </div>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={pending}>
            {pending && <IconLoader2 className="animate-spin" />}
            {isSignup ? t.signup : t.login}
          </Button>
          {demoEmail && (
            <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => run(() => loginDemo())}>
              <IconFlask />
              {t.useDemo}
              <span className="truncate text-muted-foreground">{demoEmail}</span>
            </Button>
          )}
          {adminEmail && (
            <Button type="button" variant="outline" size="lg" disabled={pending} onClick={() => run(() => loginAdmin())}>
              <IconShield />
              {t.loginAdmin}
              <span className="truncate text-muted-foreground">{adminEmail}</span>
            </Button>
          )}
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isSignup ? t.haveAccount : t.noAccount}
          <Link
            to={isSignup ? '/login' : '/signup'}
            search={{ redirect: redirectTo }}
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            {isSignup ? t.login : t.signup}
          </Link>
        </p>
      </div>
    </div>
  )
}
