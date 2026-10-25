import { Menu } from '@base-ui/react/menu'
import { IconCheck, IconChevronDown, IconFolder, IconFolderOpen } from '@tabler/icons-react'
import { cn } from 'cn'

import { itemClass, popupClass } from '@/components/composer-settings-menu'
import { InputGroupButton } from '@/components/ui/input-group'
import { defineMessages, useMessages } from '@/lib/i18n'
import { setProjectCollapsed, useProjects } from '@/lib/projects'
import { moveThread, setPendingProject, usePendingProject, useThreads } from '@/lib/threads'

const messages = defineMessages({
  vi: {
    choose: 'Chọn dự án',
    projectNamed: (name: string) => `Dự án: ${name}`,
    addToProject: 'Thêm vào dự án',
    project: 'Dự án',
    none: 'Không thuộc dự án',
  },
  en: {
    choose: 'Choose project',
    projectNamed: (name: string) => `Project: ${name}`,
    addToProject: 'Add to project',
    project: 'Project',
    none: 'No project',
  },
})

const NONE = '__none__'

// Picks the project for this chat: before the first message it sets the pending
// project used when the thread is created, afterwards it moves the thread.
export function ComposerProjectPicker({ threadId }: { threadId: string }) {
  const t = useMessages(messages)
  const projects = useProjects()
  const thread = useThreads().find((t) => t.id === threadId)
  const pending = usePendingProject(threadId)

  const raw = thread ? (thread.projectId ?? null) : pending
  const current = projects.find((p) => p.id === raw)
  if (projects.length === 0) return null

  function select(value: string) {
    const projectId = value === NONE ? null : value
    if (thread) moveThread(threadId, projectId)
    else setPendingProject(threadId, projectId)
    if (projectId) setProjectCollapsed(projectId, false)
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        render={<InputGroupButton type="button" size="xs" />}
        aria-label={t.choose}
        title={current ? t.projectNamed(current.name) : t.addToProject}
        className={cn(
          'max-w-40 gap-1 text-muted-foreground data-popup-open:bg-muted data-popup-open:text-foreground',
          current && 'text-foreground',
        )}
      >
        {current ? <IconFolderOpen /> : <IconFolder />}
        <span className="truncate">{current ? current.name : t.project}</span>
        <IconChevronDown className="opacity-60" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner side="top" align="end" sideOffset={6} collisionPadding={8} className="z-50">
          <Menu.Popup className={cn(popupClass, 'max-h-80 overflow-y-auto')}>
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t.project}</div>
            <Menu.RadioGroup value={current?.id ?? NONE} onValueChange={(value: string) => select(value)}>
              {[{ id: NONE, name: t.none }, ...projects].map((p) => (
                <Menu.RadioItem key={p.id} value={p.id} className={itemClass}>
                  <span className="flex size-4 items-center justify-center">
                    <Menu.RadioItemIndicator>
                      <IconCheck />
                    </Menu.RadioItemIndicator>
                  </span>
                  <span className={cn('flex-1 truncate', p.id === NONE && 'text-muted-foreground')}>
                    {p.name}
                  </span>
                </Menu.RadioItem>
              ))}
            </Menu.RadioGroup>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  )
}
