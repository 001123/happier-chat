import { getDb } from './db.server'
import type { UserRole } from './session.server'
import { defineMessages, getLocale } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    lastAdmin: 'Cần giữ lại ít nhất một admin',
    userNotFound: 'Không tìm thấy người dùng',
  },
  en: {
    lastAdmin: 'At least one admin must remain',
    userNotFound: 'User not found',
  },
})

export type AdminUserView = { id: string; email: string; role: UserRole; createdAt: number }

export function listUsers(): Array<AdminUserView> {
  const rows = getDb().prepare('select id, email, role, created_at from users order by created_at').all() as Array<{
    id: string
    email: string
    role: UserRole
    created_at: number
  }>
  return rows.map((row) => ({ id: row.id, email: row.email, role: row.role, createdAt: row.created_at }))
}

/** Changes a user's role. Takes effect on the user's next request, since sessions read the role live. */
export function setUserRole(userId: string, role: UserRole) {
  // One statement, so two admins demoting each other at once can't leave the app with none.
  const result = getDb()
    .prepare(
      `update users set role = ? where id = ?
       and (? = 'admin' or exists (select 1 from users where role = 'admin' and id != ?))`,
    )
    .run(role, userId, role, userId)
  if (result.changes === 0) {
    const exists = getDb().prepare('select 1 from users where id = ?').get(userId)
    throw new Error(exists ? messages[getLocale()].lastAdmin : messages[getLocale()].userNotFound)
  }
}
