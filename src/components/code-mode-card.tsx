import { parsePartialJSON } from '@tanstack/ai-react'
import { IconCircleX, IconCode, IconLoader2 } from '@tabler/icons-react'

import {
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace'
import { defineMessages, useMessages } from '@/lib/i18n'

/** A `code_mode:*` custom event the server emitted while a program ran. */
export type CodeModeEvent = { name: string; data: Record<string, unknown> }

type CodeModeOutput = {
  success?: boolean
  result?: unknown
  logs?: Array<string>
  error?: { message?: string; name?: string }
}

const copy = defineMessages({
  vi: {
    title: 'Chạy code',
    running: 'đang chạy…',
    done: (ms: number | null) => (ms === null ? 'xong' : `xong · ${ms} ms`),
    failed: 'lỗi',
    code: 'Code',
    calls: 'Lệnh gọi',
    logs: 'Console',
    result: 'Kết quả',
    error: 'Lỗi',
  },
  en: {
    title: 'Run code',
    running: 'running…',
    done: (ms: number | null) => (ms === null ? 'done' : `done · ${ms} ms`),
    failed: 'failed',
    code: 'Code',
    calls: 'Calls',
    logs: 'Console',
    result: 'Result',
    error: 'Error',
  },
})

function parseOutput(output: unknown): CodeModeOutput | null {
  if (typeof output === 'string') {
    try {
      return JSON.parse(output) as CodeModeOutput
    } catch {
      return null
    }
  }
  return output && typeof output === 'object' ? (output as CodeModeOutput) : null
}

const text = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2))

/** One `execute_typescript` call: the program the model wrote, what it did while running, and what it returned. */
export function CodeModeCard({
  state,
  input,
  arguments: rawArguments,
  output,
  events,
}: {
  state: string
  input: unknown
  arguments?: string
  output: unknown
  events: ReadonlyArray<CodeModeEvent>
}) {
  const t = useMessages(copy)
  const parsed = parseOutput(output)
  const failed = state === 'error' || parsed?.success === false
  const running = !failed && parsed === null && !events.some((e) => e.name === 'code_mode:execution_finished')

  // The arguments are still streaming in until the call is complete, so read them leniently.
  const args = (input ?? (rawArguments ? parsePartialJSON(rawArguments) : undefined)) as { typescriptCode?: string } | undefined
  const code = args?.typescriptCode

  const finished = events.find((e) => e.name === 'code_mode:execution_finished')
  const durationMs = typeof finished?.data.durationMs === 'number' ? finished.data.durationMs : null

  // Live events carry the console output of this session; after a reload only the stored result remains.
  const logs = events.filter((e) => e.name === 'code_mode:console').map((e) => text(e.data.message))
  const shownLogs = logs.length > 0 ? logs : (parsed?.logs ?? [])
  // Each external call is followed by its result or error; pair them by function name in arrival order.
  const calls: Array<{ label: string; status: string }> = []
  for (const event of events) {
    if (event.name === 'code_mode:external_call') {
      calls.push({ label: `${text(event.data.function)}(${text(event.data.args)})`, status: '…' })
      continue
    }
    if (event.name !== 'code_mode:external_result' && event.name !== 'code_mode:external_error') continue
    const pending = [...calls].reverse().find((call) => call.status === '…' && call.label.startsWith(`${text(event.data.function)}(`))
    if (pending) pending.status = event.name === 'code_mode:external_error' ? `✕ ${text(event.data.error)}` : `${text(event.data.duration)} ms`
  }

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine status={failed ? 'error' : running ? 'running' : undefined}>
          <TraceIcon>{failed ? <IconCircleX /> : running ? <IconLoader2 className="animate-spin" /> : <IconCode />}</TraceIcon>
          <TraceTitle>{t.title}</TraceTitle>
          <TraceDescription className="font-mono text-xs">{failed ? t.failed : running ? t.running : t.done(durationMs)}</TraceDescription>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <div className="grid gap-2 font-mono text-xs">
          {code && <Block label={t.code}>{code}</Block>}
          {calls.length > 0 && <Block label={t.calls}>{calls.map((call) => `${call.label} · ${call.status}`).join('\n')}</Block>}
          {shownLogs.length > 0 && <Block label={t.logs}>{shownLogs.join('\n')}</Block>}
          {parsed?.success && parsed.result !== undefined && <Block label={t.result}>{text(parsed.result)}</Block>}
          {parsed?.error?.message && (
            <Block label={t.error} destructive>
              {parsed.error.message}
            </Block>
          )}
        </div>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

function Block({ label, children, destructive }: { label: string; children: string; destructive?: boolean }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground">{label}</span>
      <pre className={`max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 ${destructive ? 'text-destructive' : ''}`}>{children}</pre>
    </div>
  )
}
