import { createMiddleware, createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { getDummyHash, hashPassword, verifyPassword } from './crypto.server'
import { getDb, promoteBootstrapAdmin } from './db.server'
import { assertSameOrigin, endSession, getSessionUser, rateLimit, startSession } from './session.server'
import { defineMessages, getLocale } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    invalidEmail: 'Email không hợp lệ',
    passwordTooShort: 'Mật khẩu cần ít nhất 8 ký tự',
    loginRequired: 'Bạn cần đăng nhập',
    adminOnly: 'Chỉ admin mới có quyền này',
    emailTaken: 'Email này đã được đăng ký',
    badCredentials: 'Email hoặc mật khẩu không đúng',
    demoDisabled: 'Tài khoản demo chưa được bật',
    adminQuickDisabled: 'Đăng nhập nhanh admin chưa được bật',
  },
  en: {
    invalidEmail: 'Invalid email address',
    passwordTooShort: 'Password must be at least 8 characters',
    loginRequired: 'You need to sign in',
    adminOnly: 'Only admins can do this',
    emailTaken: 'This email is already registered',
    badCredentials: 'Incorrect email or password',
    demoDisabled: 'The demo account is not enabled',
    adminQuickDisabled: 'Quick admin sign-in is not enabled',
  },
})

const credentials = z.object({
  email: z.string().trim().toLowerCase().email({ error: () => messages[getLocale()].invalidEmail }).max(254),
  password: z.string().min(8, { error: () => messages[getLocale()].passwordTooShort }).max(200),
})

/** Rejects the call unless a user is logged in, and hands the user to the handler. */
export const authMiddleware = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const user = getSessionUser()
  if (!user) throw new Error(messages[getLocale()].loginRequired)
  return next({ context: { user } })
})

/** Rejects the call unless the logged-in user is an admin. The role is read from the database on every call. */
export const adminMiddleware = createMiddleware({ type: 'function' })
  .middleware([authMiddleware])
  .server(async ({ context, next }) => {
    if (context.user.role !== 'admin') throw new Error(messages[getLocale()].adminOnly)
    return next()
  })

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => getSessionUser())

export const signup = createServerFn({ method: 'POST' })
  .validator(credentials)
  .handler(async ({ data }) => {
    assertSameOrigin()
    rateLimit('signup', 5, 10 * 60_000)
    const db = getDb()
    const passwordHash = await hashPassword(data.password)
    const id = crypto.randomUUID()
    const result = db
      .prepare('insert into users (id, email, password_hash, created_at) values (?, ?, ?, ?) on conflict(email) do nothing')
      .run(id, data.email, passwordHash, Date.now())
    if (result.changes === 0) throw new Error(messages[getLocale()].emailTaken)
    promoteBootstrapAdmin()
    startSession(id)
    return { id, email: data.email }
  })

async function authenticate(email: string, password: string) {
  assertSameOrigin()
  rateLimit('login', 10, 5 * 60_000)
  const user = getDb().prepare('select id, email, password_hash from users where email = ?').get(email) as
    | { id: string; email: string; password_hash: string }
    | undefined
  const matches = await verifyPassword(user?.password_hash ?? (await getDummyHash()), password)
  if (!user || !matches) throw new Error(messages[getLocale()].badCredentials)
  startSession(user.id)
  return { id: user.id, email: user.email }
}

export const login = createServerFn({ method: 'POST' })
  .validator(credentials.extend({ password: z.string().min(1).max(200) }))
  .handler(async ({ data }) => authenticate(data.email, data.password))

function debugAccountsEnabled() {
  const flag = process.env.DEBUG_HAPPIER_CHAT_SHOW_DEMO_ACCOUNT
  return !!flag && !['0', 'false'].includes(flag.toLowerCase())
}

/** The demo account from DEBUG_HAPPIER_CHAT_SHOW_DEMO_*, or null when the flag is off or incomplete. */
function demoAccount() {
  const email = process.env.DEBUG_HAPPIER_CHAT_SHOW_DEMO_EMAIL
  const password = process.env.DEBUG_HAPPIER_CHAT_SHOW_DEMO_PASSWORD
  if (!debugAccountsEnabled() || !email || !password) return null
  return { email, password }
}

/** The admin account from ADMIN_EMAIL/ADMIN_PASSWORD, offered only in development with the debug flag on. */
function adminAccount() {
  const email = process.env.ADMIN_EMAIL?.trim()
  const password = process.env.ADMIN_PASSWORD
  if (process.env.NODE_ENV === 'production' || !debugAccountsEnabled() || !email || !password) return null
  return { email, password }
}

/** One-click logins for the login page. Only the emails reach the browser; passwords stay on the server. */
export const getQuickLogins = createServerFn({ method: 'GET' }).handler(async () => ({
  demoEmail: demoAccount()?.email ?? null,
  adminEmail: adminAccount()?.email ?? null,
}))

export const loginDemo = createServerFn({ method: 'POST' }).handler(async () => {
  const demo = demoAccount()
  if (!demo) throw new Error(messages[getLocale()].demoDisabled)
  return authenticate(demo.email, demo.password)
})

export const loginAdmin = createServerFn({ method: 'POST' }).handler(async () => {
  const admin = adminAccount()
  if (!admin) throw new Error(messages[getLocale()].adminQuickDisabled)
  return authenticate(admin.email, admin.password)
})

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  assertSameOrigin()
  endSession()
  return { ok: true }
})
