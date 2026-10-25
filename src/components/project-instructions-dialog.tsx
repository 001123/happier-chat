import * as React from 'react'
import { useForm } from '@tanstack/react-form'
import { matchesKeyboardEvent } from '@tanstack/react-hotkeys'
import { IconScript } from '@tabler/icons-react'
import { z } from 'zod'

import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { defineMessages, useMessages } from '@/lib/i18n'
import { CUSTOM_INSTRUCTIONS_MAX } from '@/lib/chat-settings'
import { setProjectInstructions } from '@/lib/projects'
import type { Project } from '@/lib/projects'

const messages = defineMessages({
  vi: {
    title: (name: string | undefined) => `Hướng dẫn cho dự án “${name}”`,
    description: 'Áp dụng cho mọi cuộc trò chuyện trong dự án này, ưu tiên hơn hướng dẫn tuỳ chỉnh chung.',
    placeholder: 'Ví dụ: Dự án dùng React 19 + TanStack Start. Luôn trả lời kèm đường dẫn file liên quan.',
    cancel: 'Huỷ',
    save: 'Lưu',
  },
  en: {
    title: (name: string | undefined) => `Instructions for project “${name}”`,
    description: 'Applies to every chat in this project and takes priority over your general custom instructions.',
    placeholder: 'Example: This project uses React 19 + TanStack Start. Always include the relevant file paths in your answers.',
    cancel: 'Cancel',
    save: 'Save',
  },
})

export function ProjectInstructionsDialog({
  project,
  onClose,
}: {
  project: Project | undefined
  onClose: () => void
}) {
  const t = useMessages(messages)
  const form = useForm({
    defaultValues: { instructions: project?.instructions ?? '' },
    validators: { onChange: z.object({ instructions: z.string().max(CUSTOM_INSTRUCTIONS_MAX) }) },
    onSubmit: ({ value }) => {
      if (project) setProjectInstructions(project.id, value.instructions)
      onClose()
    },
  })
  React.useEffect(() => {
    if (project) form.reset({ instructions: project.instructions ?? '' })
  }, [project?.id])

  const save = () => void form.handleSubmit()

  return (
    <AlertDialog open={!!project} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-lg">
        <div className="flex gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <IconScript className="size-4" />
          </span>
          <div className="grid gap-1">
            <AlertDialogTitle>{t.title(project?.name)}</AlertDialogTitle>
            <AlertDialogDescription>{t.description}</AlertDialogDescription>
          </div>
        </div>
        <form.Field name="instructions">
          {(field) => (
            <div className="grid gap-1.5">
              <Textarea
                autoFocus
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                onKeyDown={(event) => {
                  if (matchesKeyboardEvent(event.nativeEvent, 'Mod+Enter')) save()
                }}
                maxLength={CUSTOM_INSTRUCTIONS_MAX}
                placeholder={t.placeholder}
                className="max-h-[50vh] min-h-40"
              />
              <p className="text-right text-xs text-muted-foreground tabular-nums">
                {field.state.value.length}/{CUSTOM_INSTRUCTIONS_MAX}
              </p>
            </div>
          )}
        </form.Field>
        <AlertDialogFooter>
          <AlertDialogClose render={<Button variant="ghost" />}>{t.cancel}</AlertDialogClose>
          <Button onClick={save}>{t.save}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
