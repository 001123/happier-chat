import { createFileRoute, useRouter } from '@tanstack/react-router'

import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { setChatSetting, useChatSettings } from '@/lib/chat-settings'
import { LOCALES, LOCALE_NAMES, defineMessages, getLocale, setLocale, useLocale, useMessages } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    title: 'Ngôn ngữ · Cài đặt · Happier Chat',
    heading: 'Ngôn ngữ',
    intro: 'Chọn ngôn ngữ của giao diện và ngôn ngữ trợ lý dùng để trả lời.',
    uiLanguage: 'Ngôn ngữ giao diện',
    uiLanguageHelp: 'Menu, nút và thông báo trong ứng dụng.',
    replyLanguage: 'Ngôn ngữ trả lời',
    followUi: (name: string) => `Giống giao diện (${name})`,
    matchUser: 'Theo ngôn ngữ bạn viết',
    followUiHelp: 'Trợ lý trả lời bằng ngôn ngữ giao diện, kể cả khi bạn đổi giao diện sau này.',
    matchUserHelp: 'Trợ lý trả lời bằng đúng ngôn ngữ bạn dùng trong tin nhắn.',
    fixedHelp: (name: string) => `Trợ lý luôn trả lời bằng ${name}, dù bạn viết bằng ngôn ngữ nào.`,
  },
  en: {
    title: 'Language · Settings · Happier Chat',
    heading: 'Language',
    intro: 'Choose the interface language and the language the assistant replies in.',
    uiLanguage: 'Interface language',
    uiLanguageHelp: 'Menus, buttons and messages in the app.',
    replyLanguage: 'Reply language',
    followUi: (name: string) => `Same as interface (${name})`,
    matchUser: 'Match your message',
    followUiHelp: 'The assistant replies in the interface language, even if you change it later.',
    matchUserHelp: 'The assistant replies in whatever language your message is written in.',
    fixedHelp: (name: string) => `The assistant always replies in ${name}, whatever language you write in.`,
  },
})

export const Route = createFileRoute('/_app/settings/language')({
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  component: LanguageSettingsPage,
})

/** The reply-language choice; maps onto `ChatSettings.replyLanguages` (`null` / `[]` / `[locale]`). */
type ReplyChoice = 'ui' | 'auto' | Locale

function toReplyChoice(languages: ReadonlyArray<Locale> | null): ReplyChoice {
  if (languages === null) return 'ui'
  return languages[0] ?? 'auto'
}

function fromReplyChoice(choice: ReplyChoice): Array<Locale> | null {
  if (choice === 'ui') return null
  if (choice === 'auto') return []
  return [choice]
}

function LanguageSettingsPage() {
  const t = useMessages(messages)
  const router = useRouter()
  const locale = useLocale()
  const settings = useChatSettings()
  const replyChoice = toReplyChoice(settings.replyLanguages)

  const replyItems: Record<ReplyChoice, string> = {
    ui: t.followUi(LOCALE_NAMES[locale]),
    auto: t.matchUser,
    ...LOCALE_NAMES,
  }
  const replyHelp =
    replyChoice === 'ui' ? t.followUiHelp : replyChoice === 'auto' ? t.matchUserHelp : t.fixedHelp(LOCALE_NAMES[replyChoice])

  function changeLocale(next: Locale | null) {
    if (!next || next === locale) return
    setLocale(next)
    // Re-run `head()` so the tab title follows the new language.
    void router.invalidate()
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">{t.heading}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.intro}</p>
      </div>

      <div className="divide-y rounded-xl border bg-card">
        <SettingRow label={t.uiLanguage} description={t.uiLanguageHelp}>
          <Select items={LOCALE_NAMES} value={locale} onValueChange={changeLocale}>
            <SelectTrigger aria-label={t.uiLanguage} className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOCALES.map((l) => (
                <SelectItem key={l} value={l} lang={l}>
                  {LOCALE_NAMES[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>

        <SettingRow label={t.replyLanguage} description={replyHelp}>
          <Select
            items={replyItems}
            value={replyChoice}
            onValueChange={(choice: ReplyChoice | null) =>
              choice && setChatSetting('replyLanguages', fromReplyChoice(choice))
            }
          >
            <SelectTrigger aria-label={t.replyLanguage} className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ui">{replyItems.ui}</SelectItem>
              <SelectItem value="auto">{replyItems.auto}</SelectItem>
              <SelectSeparator />
              {LOCALES.map((l) => (
                <SelectItem key={l} value={l} lang={l}>
                  {LOCALE_NAMES[l]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </div>
    </div>
  )
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
