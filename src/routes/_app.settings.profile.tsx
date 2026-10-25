import * as React from 'react'
import { createFileRoute, useRouteContext, useRouter } from '@tanstack/react-router'
import { IconLoader2 } from '@tabler/icons-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { defineMessages, getLocale, LOCALE_TAGS, useLocale, useMessages } from '@/lib/i18n'
import { errorMessage } from '@/lib/utils'
import { PROFILE_NAME_MAX, updateProfile } from '@/server/profile.functions'

const messages = defineMessages({
  vi: {
    title: 'Cá nhân · Cài đặt · Happier Chat',
    heading: 'Cá nhân',
    intro: 'Thông tin cơ bản về tài khoản của bạn.',
    name: 'Tên hiển thị',
    namePlaceholder: 'Tên của bạn',
    nameHelp: 'Hiển thị ở thanh bên thay cho email.',
    email: 'Email',
    role: 'Vai trò',
    roleAdmin: 'Admin',
    roleUser: 'Người dùng',
    joined: 'Ngày tham gia',
    save: 'Lưu',
    saved: 'Đã lưu',
  },
  en: {
    title: 'Profile · Settings · Happier Chat',
    heading: 'Profile',
    intro: 'Basic information about your account.',
    name: 'Display name',
    namePlaceholder: 'Your name',
    nameHelp: 'Shown in the sidebar instead of your email.',
    email: 'Email',
    role: 'Role',
    roleAdmin: 'Admin',
    roleUser: 'User',
    joined: 'Joined',
    save: 'Save',
    saved: 'Saved',
  },
})

export const Route = createFileRoute('/_app/settings/profile')({
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  component: ProfilePage,
})

function ProfilePage() {
  const t = useMessages(messages)
  const locale = useLocale()
  const { user } = useRouteContext({ from: '/_app' })
  const router = useRouter()
  const [name, setName] = React.useState(user.name)
  const [saving, setSaving] = React.useState(false)
  const [saved, setSaved] = React.useState(false)
  const [error, setError] = React.useState('')
  const dirty = name.trim() !== user.name

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const result = await updateProfile({ data: { name } })
      setName(result.name)
      setSaved(true)
      // The user lives in the /_app route context, so re-run its beforeLoad to refresh the sidebar.
      await router.invalidate()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">{t.heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.intro}</p>
      </div>

      <div className="flex items-center gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-primary text-xl font-medium text-primary-foreground uppercase">
          {(user.name || user.email).charAt(0)}
        </span>
        <div className="min-w-0">
          <div className="truncate font-medium">{user.name || user.email}</div>
          {user.name && <div className="truncate text-sm text-muted-foreground">{user.email}</div>}
        </div>
      </div>

      <form onSubmit={save} className="flex flex-col gap-3">
        <div>
          <label htmlFor="profile-name" className="text-sm font-medium">
            {t.name}
          </label>
          <p className="mt-0.5 text-sm text-muted-foreground">{t.nameHelp}</p>
        </div>
        <div className="flex gap-2">
          <Input
            id="profile-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setSaved(false)
            }}
            maxLength={PROFILE_NAME_MAX}
            placeholder={t.namePlaceholder}
            autoComplete="name"
            className="max-w-sm bg-card"
          />
          <Button type="submit" disabled={saving || !dirty}>
            {saving && <IconLoader2 className="animate-spin" />}
            {t.save}
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : (
          saved && !dirty && <p className="text-sm text-muted-foreground">{t.saved}</p>
        )}
      </form>

      <dl className="divide-y rounded-xl border bg-card text-sm">
        <div className="flex items-center justify-between gap-4 p-4">
          <dt className="font-medium">{t.email}</dt>
          <dd className="truncate text-muted-foreground">{user.email}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 p-4">
          <dt className="font-medium">{t.role}</dt>
          <dd>
            <Badge variant="secondary">{user.role === 'admin' ? t.roleAdmin : t.roleUser}</Badge>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4 p-4">
          <dt className="font-medium">{t.joined}</dt>
          <dd className="text-muted-foreground tabular-nums">
            {new Date(user.createdAt).toLocaleDateString(LOCALE_TAGS[locale], { dateStyle: 'long' })}
          </dd>
        </div>
      </dl>
    </div>
  )
}
