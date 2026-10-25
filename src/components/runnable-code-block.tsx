import * as React from 'react'
import { matchesKeyboardEvent } from '@tanstack/react-hotkeys'
import { IconArrowBackUp, IconCheck, IconLoader2, IconPencil, IconPlayerPlay, IconX } from '@tabler/icons-react'
import {
  CodeBlock,
  CodeBlockContainer,
  CodeBlockCopyButton,
  CodeBlockDownloadButton,
  CodeBlockHeader,
} from 'streamdown'
import type { CustomRenderer, CustomRendererProps } from 'streamdown'

import { defineMessages, useMessages } from '@/lib/i18n'
import { runJavaScript } from '@/lib/js-sandbox'
import type { SandboxResponse } from '@/lib/js-sandbox'
import { isPythonLoaded, runPython } from '@/lib/python-sandbox'
import { cn } from '@/lib/utils'

const messages = defineMessages({
  vi: {
    run: 'Chạy code',
    edit: 'Sửa code',
    doneEditing: 'Xong',
    reset: 'Khôi phục code gốc',
    editorHint: 'Tab để thụt lề · ⌘/Ctrl+Enter để chạy · Esc để xong',
    output: 'Kết quả',
    clear: 'Đóng kết quả',
    running: 'Đang chạy…',
    loading: 'Đang tải runtime lần đầu…',
    empty: (print: string) => `Không có output. Thêm ${print} để in kết quả.`,
    returned: 'Giá trị trả về',
  },
  en: {
    run: 'Run code',
    edit: 'Edit code',
    doneEditing: 'Done',
    reset: 'Restore original code',
    editorHint: 'Tab to indent · ⌘/Ctrl+Enter to run · Esc when done',
    output: 'Output',
    clear: 'Close output',
    running: 'Running…',
    loading: 'Loading the runtime for the first time…',
    empty: (print: string) => `No output. Add ${print} to print results.`,
    returned: 'Returned value',
  },
})

type Runner = {
  engine: string
  /** Statement suggested when a run prints nothing, e.g. `print(...)`. */
  printHint: string
  indent: string
  run: (code: string) => Promise<SandboxResponse>
  isLoaded?: () => boolean
}

const ACTION_BUTTON =
  'cursor-pointer p-1 text-muted-foreground transition-all hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50'

function RunnableCodeBlock({ code, language, isIncomplete, runner }: CustomRendererProps & { runner: Runner }) {
  const t = useMessages(messages)
  const [running, setRunning] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [result, setResult] = React.useState<SandboxResponse | null>(null)
  const [draft, setDraft] = React.useState<string | null>(null)
  const [editing, setEditing] = React.useState(false)
  const editorRef = React.useRef<HTMLTextAreaElement>(null)
  const current = draft ?? code
  const modified = draft !== null && draft !== code
  const runLabel = `${t.run} (${runner.engine})`

  const run = async () => {
    if (running) return
    setRunning(true)
    setLoading(!(runner.isLoaded?.() ?? true))
    try {
      setResult(await runner.run(current))
    } finally {
      setRunning(false)
    }
  }

  const startEditing = () => {
    setDraft(current)
    setEditing(true)
    requestAnimationFrame(() => editorRef.current?.focus())
  }

  const onEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const editor = event.currentTarget
    if (matchesKeyboardEvent(event.nativeEvent, 'Mod+Enter')) {
      event.preventDefault()
      void run()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setEditing(false)
    } else if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault()
      // execCommand keeps the native undo stack, unlike setting the value directly.
      document.execCommand('insertText', false, runner.indent)
    } else if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
      const lineStart = editor.value.lastIndexOf('\n', editor.selectionStart - 1) + 1
      const indent = /^[ \t]*/.exec(editor.value.slice(lineStart, editor.selectionStart))![0]
      if (!indent) return
      event.preventDefault()
      document.execCommand('insertText', false, `\n${indent}`)
    }
  }

  const actions = (
    <>
      {modified && (
        <button
          type="button"
          aria-label={t.reset}
          title={t.reset}
          onClick={() => setDraft(null)}
          className={ACTION_BUTTON}>
          <IconArrowBackUp aria-hidden size={14} />
        </button>
      )}
      <button
        type="button"
        aria-label={editing ? t.doneEditing : t.edit}
        aria-pressed={editing}
        title={editing ? t.doneEditing : t.edit}
        disabled={isIncomplete}
        onClick={editing ? () => setEditing(false) : startEditing}
        className={cn(ACTION_BUTTON, editing && 'text-foreground')}>
        {editing ? <IconCheck aria-hidden size={14} /> : <IconPencil aria-hidden size={14} />}
      </button>
      <button
        type="button"
        aria-label={runLabel}
        title={runLabel}
        disabled={isIncomplete || running}
        onClick={run}
        className={ACTION_BUTTON}>
        {running ? (
          <IconLoader2 aria-hidden size={14} className="animate-spin" />
        ) : (
          <IconPlayerPlay aria-hidden size={14} />
        )}
      </button>
      <CodeBlockDownloadButton code={current} language={language} />
      <CodeBlockCopyButton code={current} />
    </>
  )

  return (
    <div className="my-4" data-streamdown="runnable-code-block">
      {editing ? (
        <CodeBlockContainer className="my-0" language={language}>
          <CodeBlockHeader language={language} />
          <div className="pointer-events-none absolute top-2 right-2 z-10 flex items-center">
            <div className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-md border border-sidebar bg-sidebar/80 px-1.5 py-1">
              {actions}
            </div>
          </div>
          <textarea
            ref={editorRef}
            value={current}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onEditorKeyDown}
            aria-label={t.edit}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            rows={Math.max(3, current.split('\n').length)}
            className="field-sizing-content w-full resize-none rounded-md border border-border bg-background p-4 font-mono text-sm leading-relaxed outline-none [tab-size:4] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <p className="px-1 text-muted-foreground text-xs">{t.editorHint}</p>
        </CodeBlockContainer>
      ) : (
        <CodeBlock className="my-0" code={current} language={language} isIncomplete={isIncomplete}>
          {actions}
        </CodeBlock>
      )}
      {(running || result) && (
        <div className="mt-2 rounded-xl border border-border bg-sidebar p-2" aria-live="polite">
          <div className="flex h-8 items-center justify-between px-1 text-muted-foreground text-xs">
            <span>
              {t.output}
              {result && !running && ` · ${Math.round(result.durationMs)} ms`}
            </span>
            {result && !running && (
              <button
                type="button"
                aria-label={t.clear}
                title={t.clear}
                onClick={() => setResult(null)}
                className="cursor-pointer p-1 transition-all hover:text-foreground"
              >
                <IconX aria-hidden size={14} />
              </button>
            )}
          </div>
          <pre className="max-h-80 overflow-auto rounded-md border border-border bg-background p-4 font-mono text-sm whitespace-pre-wrap">
            {running ? (
              <span className="text-muted-foreground">{loading ? t.loading : t.running}</span>
            ) : result ? (
              <SandboxOutput result={result} emptyLabel={t.empty(runner.printHint)} returnedLabel={t.returned} />
            ) : null}
          </pre>
        </div>
      )}
    </div>
  )
}

function SandboxOutput({
  result,
  emptyLabel,
  returnedLabel,
}: {
  result: SandboxResponse
  emptyLabel: string
  returnedLabel: string
}) {
  const hasOutput = result.logs.length > 0 || result.value !== undefined || result.error
  if (!hasOutput) return <span className="text-muted-foreground">{emptyLabel}</span>
  return (
    <>
      {result.logs.map((log, index) => (
        <div
          key={index}
          className={cn(log.level === 'error' && 'text-destructive', log.level === 'warn' && 'text-amber-500')}
        >
          {log.text}
        </div>
      ))}
      {result.value !== undefined && (
        <div className="text-muted-foreground">
          {'← '}
          <span className="sr-only">{returnedLabel}: </span>
          {result.value}
        </div>
      )}
      {result.error && <div className="text-destructive">{result.error}</div>}
    </>
  )
}

function createRunnableRenderer(language: string[], runner: Runner): CustomRenderer {
  return { language, component: (props) => <RunnableCodeBlock {...props} runner={runner} /> }
}

export const runnableCodeRenderers = [
  createRunnableRenderer(['js', 'javascript', 'mjs', 'cjs'], {
    engine: 'QuickJS WASM',
    printHint: 'console.log(...)',
    indent: '  ',
    run: runJavaScript,
  }),
  createRunnableRenderer(['python', 'py', 'python3'], {
    engine: 'Pyodide WASM',
    printHint: 'print(...)',
    indent: '    ',
    run: runPython,
    isLoaded: isPythonLoaded,
  }),
]
