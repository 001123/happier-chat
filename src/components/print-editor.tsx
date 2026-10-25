import * as React from 'react'
import { createPortal } from 'react-dom'
import { useHotkey, useKeyHold } from '@tanstack/react-hotkeys'
import { cn } from 'cn'
import { IconArrowBackUp, IconEraser, IconPencil, IconPrinter, IconRotate, IconX } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { defineMessages, useMessages } from '@/lib/i18n'

const messages = defineMessages({
  vi: {
    dialog: 'Chỉnh sửa trước khi in',
    mode: 'Chế độ',
    erase: 'Xoá',
    edit: 'Sửa chữ',
    eraseHint: 'Bấm để xoá phần tử · Shift+bấm xoá cả tin nhắn',
    editHint: 'Gõ trực tiếp vào nội dung',
    undo: 'Hoàn tác',
    reset: 'Khôi phục',
    print: 'In',
    close: 'Đóng',
    settings: 'Cài đặt in',
    options: {
      paper: {
        label: 'Tối ưu cho giấy',
        description: 'Bảng màu trắng đen tiết kiệm mực, bỏ đổ bóng, nội dung trải hết khổ giấy.',
      },
      background: {
        label: 'In nền',
        description: 'Giữ màu nền của bong bóng chat, code block, bảng.',
      },
      hideEmoji: {
        label: 'Bỏ emoji',
        description: 'Ẩn emoji trong nội dung và cảm xúc đã thả.',
      },
    },
  },
  en: {
    dialog: 'Edit before printing',
    mode: 'Mode',
    erase: 'Erase',
    edit: 'Edit text',
    eraseHint: 'Click to remove an element · Shift+click to remove the whole message',
    editHint: 'Type directly in the content',
    undo: 'Undo',
    reset: 'Reset',
    print: 'Print',
    close: 'Close',
    settings: 'Print settings',
    options: {
      paper: {
        label: 'Optimize for paper',
        description: 'Ink-saving black and white palette, no shadows, content fills the page.',
      },
      background: {
        label: 'Print backgrounds',
        description: 'Keep background colors of chat bubbles, code blocks and tables.',
      },
      hideEmoji: {
        label: 'Hide emoji',
        description: 'Hide emoji in the content and in reactions.',
      },
    },
  },
})

type Mode = 'edit' | 'erase'

type PrintOptions = { hideEmoji: boolean; background: boolean; paper: boolean }

const OPTIONS_KEY = 'print-options'
const DEFAULT_OPTIONS: PrintOptions = { hideEmoji: false, background: true, paper: true }

const optionKeys = ['paper', 'background', 'hideEmoji'] as const satisfies ReadonlyArray<keyof PrintOptions>

function readOptions(): PrintOptions {
  try {
    return { ...DEFAULT_OPTIONS, ...JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? 'null') }
  } catch {
    return DEFAULT_OPTIONS
  }
}

const EMOJI = /(?:\p{Regional_Indicator}{2}|\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier}|\u200D\p{Extended_Pictographic})*)\uFE0F?/gu

function wrapEmoji(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Array<Text> = []
  while (walker.nextNode()) {
    const node = walker.currentNode as Text
    if (node.parentElement?.closest('[data-emoji], [data-print-emoji], pre, code')) continue
    EMOJI.lastIndex = 0
    if (EMOJI.test(node.data)) nodes.push(node)
  }
  for (const node of nodes) {
    const fragment = document.createDocumentFragment()
    let last = 0
    for (const match of node.data.matchAll(EMOJI)) {
      fragment.append(node.data.slice(last, match.index))
      const span = document.createElement('span')
      span.dataset.emoji = ''
      span.textContent = match[0]
      fragment.append(span)
      last = match.index + match[0].length
    }
    fragment.append(node.data.slice(last))
    node.replaceWith(fragment)
  }
}

const EXCLUDE = '[data-print-exclude], [data-streamdown="code-block-actions"], [data-streamdown="mermaid-block-actions"]'

function snapshot(source: HTMLElement, title?: string) {
  const clone = source.cloneNode(true) as HTMLElement
  clone.querySelectorAll(EXCLUDE).forEach((el) => el.remove())
  clone.querySelectorAll<HTMLElement>('[data-slot="message-scroller-item"]').forEach((el) => {
    el.style.contentVisibility = 'visible'
  })
  clone.removeAttribute('aria-busy')
  clone.classList.remove('min-h-full')
  if (title) {
    const heading = document.createElement('h1')
    heading.className = 'font-serif text-2xl font-medium'
    heading.textContent = title
    clone.prepend(heading)
  }
  wrapEmoji(clone)
  return clone.outerHTML
}

export function PrintEditor({
  source,
  title,
  onClose,
}: {
  source: HTMLElement
  title?: string
  onClose: () => void
}) {
  const t = useMessages(messages)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const initial = React.useMemo(() => snapshot(source, title), [source, title])
  const [mode, setMode] = React.useState<Mode>('erase')
  const [options, setOptions] = React.useState(readOptions)
  const history = React.useRef<Array<string>>([])
  const [canUndo, setCanUndo] = React.useState(false)
  const lastTyping = React.useRef(0)
  const hovered = React.useRef<HTMLElement | null>(null)
  const shift = React.useRef(false)

  React.useLayoutEffect(() => {
    if (contentRef.current) contentRef.current.innerHTML = initial
  }, [initial])

  function remember() {
    const root = contentRef.current
    if (!root) return
    clearHover()
    history.current.push(root.innerHTML)
    setCanUndo(true)
  }

  function undo() {
    const root = contentRef.current
    const prev = history.current.pop()
    if (!root || prev === undefined) return
    clearHover()
    root.innerHTML = prev
    setCanUndo(history.current.length > 0)
  }

  function reset() {
    remember()
    if (contentRef.current) contentRef.current.innerHTML = initial
  }

  function clearHover() {
    hovered.current?.removeAttribute('data-print-hover')
    hovered.current = null
  }

  function targetOf(el: HTMLElement | null) {
    const root = contentRef.current
    if (!root || !el || el === root || !root.contains(el)) return null
    if (!shift.current) return el
    return el.closest<HTMLElement>('[data-slot="message-scroller-item"]') ?? el
  }

  function highlight(el: HTMLElement | null) {
    const target = mode === 'erase' ? targetOf(el) : null
    if (target === hovered.current) return
    clearHover()
    target?.setAttribute('data-print-hover', '')
    hovered.current = target
  }

  const lastPointer = React.useRef<HTMLElement | null>(null)

  useHotkey('Escape', onClose)
  useHotkey('Mod+Z', undo)
  useHotkey('Mod+P', print)
  // Holding Shift widens the erase target to the whole block under the pointer.
  const shiftHeld = useKeyHold('Shift')
  React.useEffect(() => {
    shift.current = shiftHeld
    highlight(lastPointer.current)
  }, [shiftHeld])

  React.useEffect(() => {
    if (mode !== 'erase') clearHover()
  }, [mode])

  React.useEffect(() => {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options))
    if (options.hideEmoji && contentRef.current) wrapEmoji(contentRef.current)
  }, [options])

  function print() {
    clearHover()
    window.print()
  }

  return createPortal(
    <div
      data-print-editor
      role="dialog"
      aria-modal="true"
      aria-label={t.dialog}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      <header className="flex h-12 shrink-0 items-center gap-1 border-b px-3 print:hidden">
        <span className="mr-2 text-sm font-medium">{t.dialog}</span>
        <div role="radiogroup" aria-label={t.mode} className="flex items-center gap-1 rounded-lg bg-muted p-0.5">
          {(
            [
              { id: 'erase', label: t.erase, icon: IconEraser },
              { id: 'edit', label: t.edit, icon: IconPencil },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={mode === id}
              onClick={() => setMode(id)}
              className={cn(
                'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground [&_svg]:size-3.5',
                mode === id && 'bg-background font-medium text-foreground shadow-xs',
              )}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
        <span className="ml-2 hidden text-xs text-muted-foreground md:inline">
          {mode === 'erase'
            ? t.eraseHint
            : t.editHint}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo}>
            <IconArrowBackUp />
            {t.undo}
          </Button>
          <Button variant="ghost" size="sm" onClick={reset}>
            <IconRotate />
            {t.reset}
          </Button>
          <Button size="sm" onClick={print}>
            <IconPrinter />
            {t.print}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label={t.close}>
            <IconX />
          </Button>
        </div>
      </header>
      <div className="flex min-h-0 flex-1">
        <div
          data-print-scroll
          className={cn('min-h-0 flex-1 overflow-y-auto', options.paper && 'bg-muted/60 py-8')}
        >
          <div
            ref={contentRef}
            data-print-content
            data-paper={options.paper || undefined}
            data-no-background={!options.background || undefined}
            data-hide-emoji={options.hideEmoji || undefined}
            contentEditable={mode === 'edit'}
            suppressContentEditableWarning
            spellCheck={false}
            data-mode={mode}
            className={cn('outline-none', mode === 'erase' && 'cursor-pointer')}
            onBeforeInput={() => {
              const now = Date.now()
              if (now - lastTyping.current > 1000) remember()
              lastTyping.current = now
            }}
            onPointerMove={(event) => {
              lastPointer.current = event.target as HTMLElement
              highlight(lastPointer.current)
            }}
            onPointerLeave={() => {
              lastPointer.current = null
              clearHover()
            }}
            onClickCapture={(event) => {
              if (mode !== 'erase') {
                if ((event.target as HTMLElement).closest('a')) event.preventDefault()
                return
              }
              event.preventDefault()
              event.stopPropagation()
              const target = targetOf(event.target as HTMLElement)
              if (!target) return
              remember()
              target.remove()
            }}
          />
        </div>
        <aside className="flex w-72 shrink-0 flex-col gap-1 overflow-y-auto border-l bg-sidebar p-3 print:hidden">
          <h2 className="px-1 pb-1 text-xs font-medium text-muted-foreground">{t.settings}</h2>
          {optionKeys.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer items-start justify-between gap-3 rounded-lg p-2 hover:bg-muted"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{t.options[key].label}</span>
                <span className="text-xs text-muted-foreground">{t.options[key].description}</span>
              </span>
              <Switch
                className="mt-0.5"
                checked={options[key]}
                onCheckedChange={(checked) => setOptions((o) => ({ ...o, [key]: checked }))}
              />
            </label>
          ))}
        </aside>
      </div>
    </div>,
    document.body,
  )
}
