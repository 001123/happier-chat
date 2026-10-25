import { deleteCookie, getCookie, getRequest, getRequestIP, setCookie } from '@tanstack/react-start/server'

import { randomToken, sha256 } from './crypto.server'
import { getDb } from './db.server'
import { defineMessages, getLocale } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    invalidOrigin: 'Origin không hợp lệ',
    tooManyAttempts: 'Thử quá nhiều lần, vui lòng đợi một lát',
  },
  en: {
    invalidOrigin: 'Invalid origin',
    tooManyAttempts: 'Too many attempts, please wait a moment',
  },
})

export type UserRole = 'admin' | 'user'

export type SessionUser = { id: string; email: string; name: string; role: UserRole; createdAt: number }

const SESSION_COOKIE = 'session'
const SESSION_TTL = 30 * 24 * 60 * 60 * 1000
const RENEW_AFTER = SESSION_TTL / 2

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  } as const
}

/** Starts a fresh session: drops the user's old sessions (rotation) and sets the cookie. */
export function startSession(userId: string) {
  const db = getDb()
  db.prepare('delete from sessions where user_id = ? or expires_at < ?').run(userId, Date.now())
  const token = randomToken()
  db.prepare('insert into sessions (id, user_id, expires_at) values (?, ?, ?)').run(sha256(token), userId, Date.now() + SESSION_TTL)
  setCookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL / 1000 })
}

export function endSession() {
  const token = getCookie(SESSION_COOKIE)
  if (token) getDb().prepare('delete from sessions where id = ?').run(sha256(token))
  deleteCookie(SESSION_COOKIE, cookieOptions())
}

/** The logged-in user of the current request, or null. Renews the session past half its lifetime. */
export function getSessionUser(): SessionUser | null {
  const token = getCookie(SESSION_COOKIE)
  if (!token) return null
  const db = getDb()
  const id = sha256(token)
  const row = db
    .prepare(
      'select users.id, users.email, users.name, users.role, users.created_at, sessions.expires_at from sessions join users on users.id = sessions.user_id where sessions.id = ?',
    )
    .get(id) as {
      id: string
      email: string
      name: string
      role: UserRole
      created_at: number
      expires_at: number
    } | undefined
  if (!row || row.expires_at < Date.now()) return null
  if (row.expires_at - Date.now() < RENEW_AFTER) {
    db.prepare('update sessions set expires_at = ? where id = ?').run(Date.now() + SESSION_TTL, id)
    setCookie(SESSION_COOKIE, token, { ...cookieOptions(), maxAge: SESSION_TTL / 1000 })
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role, createdAt: row.created_at }
}

/** Rejects cross-site mutations: the Origin header, when sent, must match the request host. */
export function assertSameOrigin() {
  const request = getRequest()
  const origin = request.headers.get('origin')
  if (!origin) return
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (new URL(origin).host !== host) throw new Error(messages[getLocale()].invalidOrigin)
}

const attempts = new Map<string, Array<number>>()

/** Sliding-window rate limit per client IP. */
export function rateLimit(key: string, max: number, windowMs: number) {
  const ip = getRequestIP() ?? 'unknown'
  const bucket = `${key}:${ip}`
  const now = Date.now()
  const recent = (attempts.get(bucket) ?? []).filter((time) => now - time < windowMs)
  if (recent.length >= max) throw new Error(messages[getLocale()].tooManyAttempts)
  recent.push(now)
  attempts.set(bucket, recent)
}
