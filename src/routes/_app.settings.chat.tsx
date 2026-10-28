import { createFileRoute } from '@tanstack/react-router'
import { IconRotate } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  CUSTOM_INSTRUCTIONS_MAX,
  DEFAULTS,
  resetChatSettings,
  setChatSetting,
  useChatSettings,
  useChatToggles,
} from '@/lib/chat-settings'
import { defineMessages, getLocale, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    title: 'Trò chuyện · Cài đặt · Happier Chat',
    heading: 'Trò chuyện',
    intro: 'Chọn những gì hiển thị trong cuộc trò chuyện và cách trợ lý trả lời.',
    reset: 'Khôi phục mặc định',
    instructions: 'Hướng dẫn tuỳ chỉnh',
    instructionsHelp: 'Cho trợ lý biết về bạn và cách bạn muốn được trả lời. Áp dụng cho mọi cuộc trò chuyện.',
    placeholder: 'Ví dụ: Tôi là lập trình viên frontend. Hãy trả lời ngắn gọn, ưu tiên ví dụ code TypeScript.',
  },
  en: {
    title: 'Chat · Settings · Happier Chat',
    heading: 'Chat',
    intro: 'Choose what shows up in the conversation and how the assistant replies.',
    reset: 'Reset to default',
    instructions: 'Custom instructions',
    instructionsHelp: 'Tell the assistant about yourself and how you want it to respond. Applies to every conversation.',
    placeholder: 'e.g. I am a frontend developer. Keep answers short and prefer TypeScript code examples.',
  },
})

export const Route = createFileRoute('/_app/settings/chat')({
  head: () => ({ meta: [{ title: messages[getLocale()].title }] }),
  component: ChatSettingsPage,
})

function ChatSettingsPage() {
  const t = useMessages(messages)
  const settings = useChatSettings()
  const chatToggles = useChatToggles()
  const pageKeys = [...chatToggles.map((option) => option.key), 'customInstructions'] as const
  const customized = pageKeys.some((key) => settings[key] !== DEFAULTS[key])

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">{t.heading}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.intro}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={!customized}
          onClick={() => resetChatSettings(pageKeys)}
        >
          <IconRotate />
          {t.reset}
        </Button>
      </div>

      <div className="divide-y rounded-xl border bg-card">
        {chatToggles.map((option) => (
          <label
            key={option.key}
            className="flex cursor-pointer items-center justify-between gap-4 p-4"
          >
            <div>
              <div className="text-sm font-medium">{option.label}</div>
              <p className="mt-0.5 text-sm text-muted-foreground">{option.description}</p>
            </div>
            <Switch
              checked={settings[option.key]}
              onCheckedChange={(checked) => setChatSetting(option.key, checked)}
            />
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label htmlFor="custom-instructions" className="text-sm font-medium">
            {t.instructions}
          </label>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t.instructionsHelp}
          </p>
        </div>
        <Textarea
          id="custom-instructions"
          value={settings.customInstructions}
          onChange={(event) => setChatSetting('customInstructions', event.target.value)}
          maxLength={CUSTOM_INSTRUCTIONS_MAX}
          placeholder={t.placeholder}
          className="min-h-32 bg-card"
        />
        <p className="text-right text-xs text-muted-foreground tabular-nums">
          {settings.customInstructions.length}/{CUSTOM_INSTRUCTIONS_MAX}
        </p>
      </div>
    </div>
  )
}
