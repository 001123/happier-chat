import { queryOptions, useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useRouteContext, useRouter } from '@tanstack/react-router'

import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { defineMessages, getLocale, LOCALE_TAGS, useLocale, useMessages } from '@/lib/i18n'
import { errorMessage } from '@/lib/utils'
import { getAdminUsers, updateUserRole } from '@/server/admin.functions'

const adminUsersQuery = queryOptions({ queryKey: ['admin', 'users'], queryFn: () => getAdminUsers() })

export const Route = createFileRoute('/_app/settings/admin/users')({
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(adminUsersQuery),
  component: UsersPage,
})

const messages = defineMessages({
  vi: {
    title: 'Người dùng · Quản trị · Happier Chat',
    heading: 'Người dùng',
    intro: 'Admin được đồng bộ và chỉnh sửa danh mục model. Thay đổi quyền có hiệu lực ngay ở request kế tiếp.',
    you: 'Bạn',
    joined: (date: string) => `Tham gia ${date}`,
    roleAdmin: 'Admin',
    roleUser: 'Người dùng',
  },
  en: {
    title: 'Users · Administration · Happier Chat',
    heading: 'Users',
    intro: 'Admins can sync and edit the model catalog. Role changes take effect on the next request.',
    you: 'You',
    joined: (date: string) => `Joined ${date}`,
    roleAdmin: 'Admin',
    roleUser: 'User',
  },
})

type Role = 'admin' | 'user'

function UsersPage() {
  const t = useMessages(messages)
  const locale = useLocale()
  const roleLabels: Record<Role, string> = { admin: t.roleAdmin, user: t.roleUser }
  const { data: users } = useSuspenseQuery(adminUsersQuery)
  const { user: me } = useRouteContext({ from: '/_app' })
  const router = useRouter()
  const queryClient = useQueryClient()
  const changeRole = useMutation({
    mutationFn: (change: { userId: string; role: Role }) => updateUserRole({ data: change }),
    // Demoting yourself drops the admin pages, so re-run the route guards too, even after a failure.
    onSettled: async () => {
      await queryClient.invalidateQueries(adminUsersQuery)
      await router.invalidate()
    },
  })

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">{t.heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.intro}
        </p>
      </div>

      {changeRole.error && (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage(changeRole.error)}
        </p>
      )}

      <div className="divide-y rounded-xl border bg-card">
        {users.map((user) => (
          <div key={user.id} className="flex items-center gap-4 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{user.email}</span>
                {user.id === me.id && <Badge variant="secondary">{t.you}</Badge>}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t.joined(new Date(user.createdAt).toLocaleDateString(LOCALE_TAGS[locale]))}
              </p>
            </div>
            <Select
              items={roleLabels}
              value={user.role}
              onValueChange={(role: Role | null) => role && role !== user.role && changeRole.mutate({ userId: user.id, role })}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(roleLabels) as Array<Role>).map((role) => (
                  <SelectItem key={role} value={role}>
                    {roleLabels[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  )
}
