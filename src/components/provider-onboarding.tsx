import * as React from 'react'
import { useLocation, useNavigate, useRouteContext } from '@tanstack/react-router'
import { IconKey } from '@tabler/icons-react'

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useProviders } from '@/lib/provider-store'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    title: 'Thêm API key để bắt đầu',
    description:
      'Tài khoản của bạn chưa có API key nào. Thêm API key (OpenCode Go, Anthropic, OpenAI, OpenRouter…) và chọn model để trò chuyện. Key được mã hoá và chỉ lưu trên server.',
    later: 'Để sau',
    configure: 'Thêm API key',
  },
  en: {
    title: 'Connect a provider to get started',
    description:
      'Your account has no providers yet. Add an API key (OpenCode Go, Anthropic, OpenAI, OpenRouter…) and pick a model to chat. Keys are encrypted and stored only on the server.',
    later: 'Later',
    configure: 'Set up provider',
  },
})

const dismissKey = (userId: string) => `provider-onboarding-dismissed:${userId}`

/** Points a user with no provider yet to Settings → Provider. "Later" hides it until the next browser session. */
export function ProviderOnboardingDialog() {
  const t = useMessages(messages)
  const { user } = useRouteContext({ from: '/_app' })
  const { providers, loaded, error } = useProviders()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [dismissed, setDismissed] = React.useState(
    () => typeof window !== 'undefined' && sessionStorage.getItem(dismissKey(user.id)) === '1',
  )

  const open = loaded && !error && providers.length === 0 && !dismissed && pathname !== '/settings/providers'

  function dismiss() {
    sessionStorage.setItem(dismissKey(user.id), '1')
    setDismissed(true)
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && dismiss()}>
      <AlertDialogContent>
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconKey className="size-4" />
          </span>
          <div className="grid gap-1">
            <AlertDialogTitle>{t.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.description}
            </AlertDialogDescription>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>{t.later}</AlertDialogClose>
          <Button onClick={() => navigate({ to: '/settings/providers' })}>{t.configure}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
