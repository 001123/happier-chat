import * as React from 'react'
import { startTransition, ViewTransition } from 'react'
import { clientTools, fetchServerSentEvents, parsePartialJSON, useChat } from '@tanstack/ai-react'
import type { UIMessage } from '@tanstack/ai-react'
import { useHotkey } from '@tanstack/react-hotkeys'
import { useQueryClient } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { Popover } from '@base-ui/react/popover'
import { defaultEmojiDataResolver, EmojiPicker } from 'frimousse'
import type { EmojiDataResolver } from 'frimousse'
import { cn } from 'cn'
import {
  IconAlertTriangle,
  IconArrowUp,
  IconBug,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconCircleX,
  IconCopy,
  IconLayoutSidebarRight,
  IconLoader2,
  IconMoodPlus,
  IconPencil,
  IconPlus,
  IconRotate,
  IconSearch,
  IconSparkles,
  IconSquare,
  IconTool,
  IconVolume,
} from '@tabler/icons-react'
import { Streamdown } from 'streamdown'
import { code } from '@streamdown/code'
import { peleMermaid } from '@/lib/pele-mermaid'

import { useAguiLog } from '@/components/agui-inspector'
import { TurnInfoButton, useChatStats } from '@/components/chat-stats'
import type { RunStat } from '@/components/chat-stats'
import { DebugDrawer } from '@/components/debug-panel'
import type { DebugTab } from '@/components/debug-panel'
import { Logo } from '@/components/logo'
import { PrintEditor } from '@/components/print-editor'
import { UtilitiesPanel } from '@/components/utilities-panel'
import { applyTheme } from '@/components/theme-toggle'
import { WeatherCard, WeatherCardSkeleton, parseWeather } from '@/components/weather-card'
import { MapCard, MapCardSkeleton, parseMapLocation } from '@/components/map-card'
import { WordCard, parseWordImages } from '@/components/word-card'
import { GenerativeUI } from '@/components/generative-ui'
import { ConversationMinimap } from '@/components/conversation-minimap'
import { ComposerTools } from '@/components/composer-tools'
import { ChatViewSkeleton, greeting, shellCopy, takeFallbackInput } from '@/components/chat-view-skeleton'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from '@/components/ui/input-group'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Message, MessageContent } from '@/components/ui/message'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  useMessageScroller,
} from '@/components/ui/message-scroller'
import { SidebarTrigger } from '@/components/ui/sidebar'
import {
  Trace,
  TraceCollapsible,
  TraceCollapsibleContent,
  TraceCollapsibleTrigger,
  TraceDescription,
  TraceIcon,
  TraceLine,
  TraceTitle,
} from '@/components/ui/trace'
import { resolveReplyLanguages, useChatSettings } from '@/lib/chat-settings'
import { defineMessages, useLocale, useMessages } from '@/lib/i18n'
import { CodeModeCard } from '@/components/code-mode-card'
import type { CodeModeEvent } from '@/components/code-mode-card'
import { runnableCodeRenderers } from '@/components/runnable-code-block'
import { ModeStarter, useChatMode } from '@/components/chat-modes'
import { readDisplaySettings } from '@/lib/display-settings'
import { useActiveModel } from '@/lib/provider-store'
import { useSpeechSettings } from '@/lib/speech-settings'
import { segmentsFromElement, useSpeaker } from '@/lib/use-speaker'
import type { SpeakerStatus } from '@/lib/use-speaker'
import { toggleReaction, useReactions } from '@/lib/reactions'
import { hasThread, setThreadBusy, upsertThread, usePendingProject, useThread, useThreadsSynced } from '@/lib/threads'
import { SHORTCUTS } from '@/lib/shortcuts'
import { clearThread } from '@/server/threads.functions'
import { useProjects } from '@/lib/projects'
import {
  fetchPageDef,
  getWeatherDef,
  learnWordDef,
  reactionEmojis,
  reactToMessageDef,
  roleplayTurnDef,
  sendEmailDef,
  setThemeDef,
  showMapDef,
  showQuizDef,
  webSearchDef,
} from '@/lib/tools'
import type { QuizInput, RoleplayInput } from '@/lib/tools'
import { QuizCard, QuizCardSkeleton } from '@/components/quiz-card'
import { ROLEPLAY_VOICES, RoleplayCard, RoleplayCardSkeleton } from '@/components/roleplay-card'
import { renderUiDef, splitInlinePatches } from '@/lib/generative-ui'

const tools = clientTools(
  setThemeDef.client(({ theme }) => {
    applyTheme(theme)
    return { applied: true }
  }),
  getWeatherDef,
  sendEmailDef,
  reactToMessageDef,
  webSearchDef,
  fetchPageDef,
  showMapDef,
  learnWordDef,
  showQuizDef,
  roleplayTurnDef,
  renderUiDef,
)

const STREAMDOWN_PLUGINS = { code, mermaid: peleMermaid, renderers: runnableCodeRenderers }

const ReplyMarkdown = React.memo(function ReplyMarkdown({
  text,
  streaming,
}: {
  text: string
  streaming: boolean
}) {
  return (
    <Streamdown animated isAnimating={streaming} plugins={STREAMDOWN_PLUGINS}>
      {text}
    </Streamdown>
  )
})

function subscribeOnline(listener: () => void) {
  window.addEventListener('online', listener)
  window.addEventListener('offline', listener)
  return () => {
    window.removeEventListener('online', listener)
    window.removeEventListener('offline', listener)
  }
}

function useOnline() {
  return React.useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
}

function isNetworkError(error: Error) {
  return /failed to fetch|networkerror|network|load failed|stream/i.test(error.message)
}

const copy = defineMessages({
  vi: {
    offlineError: 'Mất kết nối mạng. Khi có mạng lại, câu trả lời sẽ được thử lại.',
    rateLimited: 'Đang gửi quá nhanh, đợi một lát rồi thử lại.',
    overloaded: 'Máy chủ AI đang quá tải, thử lại sau ít phút.',
    forbidden: 'Máy chủ từ chối yêu cầu (API key/quyền truy cập).',
    unreachable: 'Không kết nối được tới máy chủ.',
    genericError: 'Có lỗi khi tạo câu trả lời.',
    quotes: [
      { text: 'Có công mài sắt, có ngày nên kim.' },
      { text: 'Nước chảy đá mòn.' },
      { text: 'Kiến tha lâu cũng đầy tổ.' },
      { text: 'Đi một ngày đàng, học một sàng khôn.' },
      { text: 'Muốn biết phải hỏi, muốn giỏi phải học.' },
      { text: 'Học thầy không tày học bạn.' },
      { text: 'Thua keo này, bày keo khác.' },
      { text: 'Một cây làm chẳng nên non, ba cây chụm lại nên hòn núi cao.' },
      { text: 'Ăn quả nhớ kẻ trồng cây.' },
      { text: 'Chậm mà chắc.' },
    ] as ReadonlyArray<{ text: string; author?: string }>,
    tools: {
      get_weather: 'Tra thời tiết',
      set_theme: 'Đổi giao diện',
      send_email: 'Gửi email',
      web_search: 'Tìm trên web',
      fetch_page: 'Đọc trang',
      show_map: 'Xem bản đồ',
      learn_word: 'Học từ vựng',
      show_quiz: 'Tạo quiz',
      roleplay_turn: 'Nhập vai',
      render_ui: 'Dựng giao diện',
      execute_typescript: 'Chạy code',
    } as Record<string, string>,
    newChat: 'Cuộc trò chuyện',
    utilities: 'Tiện ích',
    assistantReacted: 'Trợ lý đã thả cảm xúc',
    removeReaction: 'Bỏ cảm xúc',
    stepLimit: 'Đã đạt giới hạn bước, trợ lý trả lời với thông tin đã có.',
    nextSuggestions: 'Gợi ý tiếp theo',
    stop: 'Dừng',
    send: 'Gửi',
    answering: 'Đang trả lời',
    retry: 'Thử lại',
    details: 'Chi tiết',
    edit: 'Sửa',
    editQuestion: 'Sửa câu hỏi',
    cancel: 'Huỷ',
    copied: 'Đã sao chép',
    copy: 'Sao chép',
    readAloud: 'Đọc to',
    stopReading: 'Dừng đọc',
    react: 'Thả cảm xúc',
    emojiNotFound: 'Không tìm thấy emoji',
    searchEmoji: 'Tìm emoji…',
    moreEmoji: 'Chọn emoji khác',
    thinking: 'Đang suy nghĩ',
    thought: 'Đã suy nghĩ',
    sourceCount: (n: number) => `${n} nguồn`,
    approvalBefore: 'Trợ lý muốn chạy ',
    approvalAfter: '. Cho phép?',
    allow: 'Cho phép',
    deny: 'Từ chối',
  },
  en: {
    offlineError: 'Network connection lost. The reply will be retried once you are back online.',
    rateLimited: 'Sending too fast, wait a moment and try again.',
    overloaded: 'The AI server is overloaded, try again in a few minutes.',
    forbidden: 'The server rejected the request (API key/permissions).',
    unreachable: 'Could not connect to the server.',
    genericError: 'Something went wrong while generating the reply.',
    quotes: [
      { text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
      { text: 'Premature optimization is the root of all evil.', author: 'Donald Knuth' },
      { text: 'Make it work, make it right, make it fast.', author: 'Kent Beck' },
      { text: 'The best way to predict the future is to invent it.', author: 'Alan Kay' },
      { text: 'Any sufficiently advanced technology is indistinguishable from magic.', author: 'Arthur C. Clarke' },
      { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
      { text: 'Well begun is half done.' },
      { text: 'Slow and steady wins the race.' },
    ] as ReadonlyArray<{ text: string; author?: string }>,
    tools: {
      get_weather: 'Check weather',
      set_theme: 'Change theme',
      send_email: 'Send email',
      web_search: 'Search the web',
      fetch_page: 'Read page',
      show_map: 'Show map',
      learn_word: 'Learn word',
      show_quiz: 'Build quiz',
      roleplay_turn: 'Role-play',
      render_ui: 'Build interface',
      execute_typescript: 'Run code',
    } as Record<string, string>,
    newChat: 'New chat',
    utilities: 'Utilities',
    assistantReacted: 'Assistant reacted',
    removeReaction: 'Remove reaction',
    stepLimit: 'Step limit reached, the assistant replied with the information it had.',
    nextSuggestions: 'Suggested follow-ups',
    stop: 'Stop',
    send: 'Send',
    answering: 'Replying',
    retry: 'Retry',
    details: 'Details',
    edit: 'Edit',
    editQuestion: 'Edit question',
    cancel: 'Cancel',
    copied: 'Copied',
    copy: 'Copy',
    readAloud: 'Read aloud',
    stopReading: 'Stop reading',
    react: 'Add reaction',
    emojiNotFound: 'No emoji found',
    searchEmoji: 'Search emoji…',
    moreEmoji: 'More emoji',
    thinking: 'Thinking',
    thought: 'Thought',
    sourceCount: (n: number) => `${n} ${n === 1 ? 'source' : 'sources'}`,
    approvalBefore: 'The assistant wants to run ',
    approvalAfter: '. Allow?',
    allow: 'Allow',
    deny: 'Deny',
  },
})

type Copy = (typeof copy)['vi']

function describeError(error: Error, online: boolean, t: Copy) {
  const text = error.message
  if (!online) return t.offlineError
  if (/429|rate.?limit/i.test(text)) return t.rateLimited
  if (/529|503|overload/i.test(text)) return t.overloaded
  if (/401|403|api.?key|auth/i.test(text)) return t.forbidden
  if (isNetworkError(error)) return t.unreachable
  return t.genericError
}

type WebSource = { url: string; title: string }

function messageSources(message: UIMessage) {
  const read: Array<WebSource> = []
  const found: Array<WebSource> = []
  for (const part of message.parts) {
    if (part.type !== 'tool-call') continue
    const output = part.output ?? findResult(message, part.id)
    const value = typeof output === 'string' ? safeJson(output) : output
    if (part.name === 'fetch_page' && value?.url) read.push({ url: value.url, title: value.title || value.url })
    if (part.name === 'web_search' && Array.isArray(value?.results)) found.push(...value.results.slice(0, 4))
  }
  const byUrl = new Map((read.length ? read : found).map((s) => [s.url, s]))
  return [...byUrl.values()]
}

function turnSources(messages: ReadonlyArray<UIMessage>, index: number) {
  if (messages[index + 1]?.role === 'assistant') return []
  const byUrl = new Map<string, WebSource>()
  for (let i = index; i >= 0 && messages[i]!.role === 'assistant'; i--) {
    for (const source of messageSources(messages[i]!)) if (!byUrl.has(source.url)) byUrl.set(source.url, source)
  }
  return [...byUrl.values()]
}

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}


function speechContent(message: UIMessage) {
  const root = document.querySelector<HTMLElement>(`[data-reply-id="${CSS.escape(message.id)}"]`)
  const segments = root ? segmentsFromElement(root) : []
  return segments.length > 0 ? segments : getText(message)
}

function getText(message: UIMessage) {
  return message.parts
    .map((part) => (part.type === 'text' ? part.content : ''))
    .join('')
}

function botReaction(messages: ReadonlyArray<UIMessage>, index: number) {
  // The reaction can come from any model turn of the reply, not only the first one.
  const part = replyRun(messages, index + 1)
    .flatMap((m) => m.parts)
    .find((p) => p.type === 'tool-call' && p.name === 'react_to_message')
  if (part?.type !== 'tool-call') return undefined
  const emoji = (part.input as { emoji?: string } | undefined)?.emoji
  return reactionEmojis.find((e) => e === emoji)
}

type ReactionMeta = { emoji: string; messageId: string }

function reactionMeta(message: UIMessage) {
  return message.metadata?.reaction as ReactionMeta | undefined
}

/** Run stats saved on an assistant message, so its turn info outlives the page session. */
function persistedRuns(message: UIMessage) {
  return message.metadata?.runs as Array<RunStat> | undefined
}

export function ChatView({ threadId }: { threadId: string }) {
  const t = useMessages(copy)
  const shellT = useMessages(shellCopy)
  const { user } = useRouteContext({ from: '/_app' })
  const agui = useAguiLog()
  const [utilitiesOpen, setUtilitiesOpen] = React.useState(() => readDisplaySettings().rightSidebarOpen)
  const [debugOpen, setDebugOpen] = React.useState(false)
  const [debugTab, setDebugTab] = React.useState<DebugTab>('stats')
  const messagesRef = React.useRef<HTMLDivElement>(null)
  const [printSource, setPrintSource] = React.useState<HTMLElement | null>(null)
  const [progress, setProgress] = React.useState<Record<string, string>>({})
  const [codeEvents, setCodeEvents] = React.useState<Record<string, Array<CodeModeEvent>>>({})

  const chatSettings = useChatSettings()
  const { showThinking, showTools, showSuggestions, effort, customInstructions } = chatSettings
  const replyLanguages = resolveReplyLanguages(chatSettings, useLocale())
  const activeModel = useActiveModel()
  const model = activeModel?.key
  const stats = useChatStats(model, effort)
  const thread = useThread(threadId)
  const pendingProjectId = usePendingProject(threadId)
  const projectId = thread ? (thread.projectId ?? null) : pendingProjectId
  const project = useProjects().find((p) => p.id === projectId)
  const projectName = project?.name
  const projectInstructions = project?.instructions
  const mode = useChatMode(threadId)
  const forwardedProps = React.useMemo(
    () => ({ effort, model, customInstructions, projectName, projectInstructions, replyLanguages, mode }),
    // Joined so a fresh array from resolveReplyLanguages() each render doesn't recreate the props.
    [effort, model, customInstructions, projectName, projectInstructions, replyLanguages.join(), mode],
  )

  const runIdRef = React.useRef<string | null>(null)
  const { messages, sendMessage, setMessages, reload, isLoading, stop, error, interrupts } = useChat<typeof tools>({
    threadId,
    forwardedProps,
    // The transcript lives on the server (GET /api/chat?threadId=), so a thread opens on any device.
    persistence: true,
    connection: fetchServerSentEvents('/api/chat'),
    tools,
    onChunk: (chunk) => {
      if (chunk.type === 'RUN_STARTED') runIdRef.current = chunk.runId
      if (chunk.type === 'RUN_FINISHED' || chunk.type === 'RUN_ERROR') runIdRef.current = null
      agui.push(chunk)
      stats.push(chunk)
    },
    onCustomEvent: (name, data, { toolCallId }) => {
      if (!toolCallId) return
      if (name.startsWith('code_mode:')) {
        setCodeEvents((events) => ({
          ...events,
          [toolCallId]: [...(events[toolCallId] ?? []), { name, data: (data ?? {}) as CodeModeEvent['data'] }],
        }))
        return
      }
      if (name === 'word:progress') {
        const { label } = data as { label: string }
        setProgress((p) => ({ ...p, [toolCallId]: label }))
      }
      if (name !== 'weather:progress') return
      const { step, total, label } = data as { step: number; total: number; label: string }
      setProgress((p) => ({ ...p, [toolCallId]: `${label} (${step}/${total})` }))
    },
  })
  function stopRun() {
    const runId = runIdRef.current
    runIdRef.current = null
    stop()
    if (runId) {
      void fetch(`/api/chat?runId=${encodeURIComponent(runId)}`, { method: 'DELETE', keepalive: true }).catch(() => {})
    }
  }

  const lastAssistantId = messages.filter((m) => m.role === 'assistant').at(-1)?.id
  const { runs: statRuns, attach: attachRuns } = stats
  React.useEffect(() => {
    if (lastAssistantId) attachRuns(lastAssistantId)
  }, [statRuns, lastAssistantId, attachRuns])

  // Copy each turn's finished runs into its message metadata so the turn info survives a reload.
  React.useEffect(() => {
    if (isLoading) return
    const byMessage = new Map<string, Array<RunStat>>()
    for (const r of statRuns) {
      if (r.messageId && r.finishedAt) byMessage.set(r.messageId, [...(byMessage.get(r.messageId) ?? []), r])
    }
    const stale = (m: UIMessage) => {
      const runs = byMessage.get(m.id)
      return runs !== undefined && persistedRuns(m)?.at(-1)?.runId !== runs.at(-1)?.runId
    }
    if (!messages.some(stale)) return
    setMessages(messages.map((m) => (stale(m) ? { ...m, metadata: { ...m.metadata, runs: byMessage.get(m.id) } } : m)))
  }, [statRuns, messages, isLoading, setMessages])

  const online = useOnline()
  const wasOnline = React.useRef(online)
  React.useEffect(() => {
    const reconnected = !wasOnline.current && online
    wasOnline.current = online
    if (reconnected && error && !isLoading && isNetworkError(error)) void reload()
  }, [online, error, isLoading, reload])

  React.useEffect(() => {
    setThreadBusy(threadId, isLoading)
    return () => setThreadBusy(threadId, false)
  }, [threadId, isLoading])

  const [loadingSince, setLoadingSince] = React.useState<number | null>(null)
  React.useEffect(() => setLoadingSince(isLoading ? Date.now() : null), [isLoading])

  const title = thread?.title
  const reactions = useReactions(threadId)
  const speaker = useSpeaker()
  const { autoRead } = useSpeechSettings()

  const wasLoading = React.useRef(isLoading)
  React.useEffect(() => {
    const finished = wasLoading.current && !isLoading
    wasLoading.current = isLoading
    const last = messages.at(-1)
    if (!finished || !autoRead || error || last?.role !== 'assistant') return
    const turn = last.parts.find((p) => p.type === 'tool-call' && p.name === 'roleplay_turn')
    const roleplay = turn?.type === 'tool-call' ? (turn.input as RoleplayInput | undefined) : undefined
    if (roleplay?.line) {
      speaker.speak(`${turn!.id}:line`, roleplay.line, { voice: ROLEPLAY_VOICES[roleplay.character.voice], pitch: 0 })
      return
    }
    speaker.speak(last.id, speechContent(last))
  }, [isLoading, autoRead, error, messages, speaker.speak])

  function react(message: UIMessage, emoji: string) {
    const added = reactions[message.id] !== emoji
    toggleReaction(threadId, message.id, emoji)
    if (!added) return
    const excerpt = getText(message).replace(/\s+/g, ' ').slice(0, 200)
    void sendMessage({
      content: `[Reaction] The user just reacted with ${emoji} to your reply: "${excerpt}". Respond very briefly (1 sentence), naturally matching that emotion, and do not react back with a reaction.`,
      metadata: { reaction: { emoji, messageId: message.id } satisfies ReactionMeta },
    })
  }
  const suggestions = useFollowUpSuggestions({
    threadId,
    model,
    messages,
    isLoading,
    failed: Boolean(error),
    enabled: showSuggestions,
  })

  useHotkey(
    'Escape',
    () => {
      // Esc also closes menus and dialogs; leave the key to them when one is open.
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return
      stopRun()
    },
    {
      enabled: isLoading || interrupts.length > 0,
      preventDefault: false,
      stopPropagation: false,
      meta: { name: 'Stop generating' },
    },
  )
  const focusComposer = () => document.querySelector<HTMLTextAreaElement>('textarea[data-composer]')?.focus()
  useHotkey(SHORTCUTS.focusComposer, focusComposer, { meta: { name: 'Focus message box' } })
  useHotkey(SHORTCUTS.focusComposerAlt, focusComposer, { meta: { name: 'Focus message box' } })

  const [editingId, setEditingId] = React.useState<string | null>(null)
  async function editMessage(index: number, text: string) {
    setEditingId(null)
    if (isLoading || interrupts.length > 0) stopRun()
    setMessages(messages.slice(0, index))
    // The server keeps a stored message the new transcript does not mention, so an edited first message
    // would leave the old conversation behind it.
    if (index === 0) await clearThread({ data: { id: threadId } }).catch(() => {})
    void sendMessage(text)
  }

  const questions = React.useMemo(
    () =>
      messages
        .filter((m) => m.role === 'user' && !reactionMeta(m))
        .map((m) => ({ id: m.id, text: getText(m).replace(/\s+/g, ' ').trim() })),
    [messages],
  )
  const messageIds = React.useMemo(() => messages.map((m) => m.id), [messages])

  const threadsSynced = useThreadsSynced()
  const [sent, setStarted] = React.useState(() => hasThread(threadId))
  // A thread known to the server (opened by link on another device) or already holding messages has started.
  const started = sent || Boolean(thread) || messages.length > 0

  const firstUserText = messages.find((m) => m.role === 'user')
  const messageCount = messages.length
  React.useEffect(() => {
    if (!firstUserText) return
    upsertThread(threadId, getText(firstUserText).slice(0, 60) || t.newChat)
  }, [threadId, firstUserText, messageCount])

  const composer = (
    <Composer
      threadId={threadId}
      busy={isLoading}
      offline={!online}
      runs={stats.runs}
      turns={messages.filter((m) => m.role === 'user').length}
      messageCount={messages.length}
      started={started}
      onSend={(text) => {
        startTransition(() => setStarted(true))
        void sendMessage(text)
      }}
      onStop={stopRun}
    />
  )

  const debugButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Debug"
      title="Debug"
      aria-pressed={debugOpen}
      onClick={() => setDebugOpen((o) => !o)}
    >
      <IconBug />
    </Button>
  )

  const utilitiesButton = (
    <Button
      variant="ghost"
      size="icon-sm"
      className="ml-auto"
      aria-label={t.utilities}
      title={t.utilities}
      aria-pressed={utilitiesOpen}
      onClick={() => setUtilitiesOpen((o) => !o)}
    >
      <IconLayoutSidebarRight />
    </Button>
  )

  return (
    <div className="flex">
      <div className="min-w-0 flex-1">{renderMain()}</div>
      <UtilitiesPanel
        open={utilitiesOpen}
        onPrint={started && messages.length > 0 ? () => setPrintSource(messagesRef.current) : undefined}
        onClose={() => setUtilitiesOpen(false)}
      />
      <DebugDrawer
        open={debugOpen}
        onOpenChange={setDebugOpen}
        tab={debugTab}
        onTabChange={setDebugTab}
        entries={agui.entries}
        runs={stats.runs}
        turns={messages.filter((m) => m.role === 'user').length}
        messageCount={messages.length}
        onClearEvents={agui.clear}
      />
      {printSource && (
        <PrintEditor source={printSource} title={title} onClose={() => setPrintSource(null)} />
      )}
    </div>
  )

  function renderMain() {
  // The thread list arrives with the page; until it is applied, a deep-linked chat cannot tell new from existing.
  if (!started && !threadsSynced) return <ChatViewSkeleton threadId={threadId} />

  if (!started) {
    return (
      <div className="flex h-dvh flex-col">
        <header className="flex h-12 items-center px-3">
          <SidebarTrigger />
          {debugButton}
          {utilitiesButton}
        </header>
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-4 pb-[12vh]">
          <ViewTransition exit="vt-greeting-exit">
            <h1 className="flex items-center justify-center gap-3 font-serif text-4xl font-light text-foreground">
              <Logo className="size-8" />
              {greeting(shellT, user.name)}
            </h1>
          </ViewTransition>
          <div className="flex flex-col gap-6">
            <ViewTransition name="composer">{composer}</ViewTransition>
            <ModeStarter
              threadId={threadId}
              onSend={(text) => {
                startTransition(() => setStarted(true))
                void sendMessage(text)
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <MessageScrollerProvider autoScroll>
      <ScrollToEndOnNewMessage count={messages.length} />
      <div className="flex h-dvh flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 px-3">
          <SidebarTrigger />
          {debugButton}
          <span className="truncate text-sm font-medium">{title}</span>
          {utilitiesButton}
        </header>

        <div className="min-h-0 flex-1">
          <ViewTransition enter="vt-messages-enter">
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent
                  ref={messagesRef}
                  aria-busy={isLoading}
                  className="mx-auto w-full max-w-4xl gap-6 px-6 pt-4 pb-10"
                >
                  {messages.map((message, index) => {
                    if (message.role === 'user' && reactionMeta(message)) return null

                    if (message.role === 'user') {
                      const reaction = botReaction(messages, index)
                      return (
                        <MessageScrollerItem
                          key={message.id}
                          messageId={message.id}
                        >
                          <Message align="end">
                            <MessageContent>
                              {editingId === message.id ? (
                                <UserMessageEditor
                                  initialText={getText(message)}
                                  onCancel={() => setEditingId(null)}
                                  onSubmit={(text) => editMessage(index, text)}
                                />
                              ) : (
                              <div className="group/user flex w-full items-center justify-end gap-2">
                                <div data-print-exclude className="flex shrink-0 items-center transition-opacity pointer-fine:opacity-0 group-hover/user:opacity-100 focus-within:opacity-100">
                                  <EditButton onClick={() => setEditingId(message.id)} />
                                  <CopyButton text={getText(message)} />
                                </div>
                                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md border border-border bg-user-bubble px-4 py-2.5 text-chat leading-relaxed shadow-xs">
                                  {getText(message)}
                                </div>
                              </div>
                              )}
                              {reaction && (
                                <ReactionBadge
                                  emoji={reaction}
                                  label={t.assistantReacted}
                                  className="-mt-3 mr-2 self-end"
                                />
                              )}
                            </MessageContent>
                          </Message>
                        </MessageScrollerItem>
                      )
                    }

                    const streaming = isLoading && message === messages.at(-1)
                    const inline = splitInlinePatches(getText(message))
                    // One reply can span several messages (one per model turn): show a single answer, so a
                    // lead-in written next to a tool call disappears once a later turn has replied.
                    const reply = hasLaterReply(messages, index) ? '' : inline.text
                    const reaction = reactions[message.id]
                    // The first message of the reply shows the thinking and tool traces of all its turns.
                    const run = messages[index - 1]?.role === 'assistant' ? [] : replyRun(messages, index)
                    const runLast = run.at(-1)
                    const runThinking = isLoading && runLast === messages.at(-1) && !getText(runLast!).trim()

                    return (
                      <MessageScrollerItem
                        key={message.id}
                        messageId={message.id}
                        // Later turns of the same reply sit at the in-message gap, not the between-messages one.
                        className={cn(
                          'has-[[data-slot=message-content]:empty]:hidden',
                          messages[index - 1]?.role === 'assistant' && '-mt-3',
                        )}
                      >
                        <Message>
                          <MessageContent className="gap-3">
                            {showThinking && run.some((m) => m.parts.some((p) => p.type === 'thinking')) && (
                              <Trace>
                                {run.flatMap((m) =>
                                  m.parts.map((part, index) =>
                                    part.type === 'thinking' ? (
                                      <ReasoningRow
                                        key={`${m.id}:${index}`}
                                        text={part.content}
                                        running={runThinking && m === runLast}
                                      />
                                    ) : null,
                                  ),
                                )}
                              </Trace>
                            )}
                            {showTools && run.some((m) => m.parts.some((p) => p.type === 'tool-call' && p.name !== 'react_to_message')) && (
                              <Trace>
                                {run.flatMap((m) =>
                                  m.parts.map((part) =>
                                    part.type === 'tool-call' && part.name === 'execute_typescript' ? (
                                      <CodeModeCard
                                        key={part.id}
                                        state={part.state}
                                        input={part.input}
                                        arguments={part.arguments}
                                        output={part.output ?? findResult(m, part.id)}
                                        events={codeEvents[part.id] ?? []}
                                      />
                                    ) : part.type === 'tool-call' && part.name !== 'react_to_message' ? (
                                      <ToolCallRow
                                        key={part.id}
                                        name={part.name}
                                        state={part.state}
                                        input={part.input ?? part.arguments}
                                        output={part.output ?? findResult(m, part.id)}
                                        progress={progress[part.id]}
                                      />
                                    ) : null,
                                  ),
                                )}
                              </Trace>
                            )}
                            {message.parts.map((part) => {
                              if (part.type !== 'tool-call' || part.name !== 'get_weather') return null
                              const weather = parseWeather(part.output ?? findResult(message, part.id))
                              if (weather) return <WeatherCard key={part.id} weather={weather} />
                              if (part.state === 'error' || part.output !== undefined || findResult(message, part.id) !== undefined) return null
                              const city = (part.input as { city?: string } | undefined)?.city
                              return (
                                <WeatherCardSkeleton
                                  key={part.id}
                                  city={city}
                                  progress={progress[part.id]}
                                />
                              )
                            })}
                            {message.parts.map((part) => {
                              if (part.type !== 'tool-call' || part.name !== 'show_map') return null
                              const result = part.output ?? findResult(message, part.id)
                              const location = parseMapLocation(result)
                              if (location) return <MapCard key={part.id} location={location} />
                              if (part.state === 'error' || result !== undefined) return null
                              const query = (part.input as { query?: string } | undefined)?.query
                              return <MapCardSkeleton key={part.id} query={query} />
                            })}
                            {message.parts.map((part) => {
                              if (part.type !== 'tool-call' || part.name !== 'learn_word') return null
                              const input = part.input ?? (part.arguments ? parsePartialJSON(part.arguments) : undefined)
                              if (!input?.word) return null
                              const result = part.output ?? findResult(message, part.id)
                              return (
                                <WordCard
                                  key={part.id}
                                  id={part.id}
                                  input={input}
                                  images={parseWordImages(result)}
                                  imagesLoading={result === undefined && part.state !== 'error'}
                                  speaker={speaker}
                                />
                              )
                            })}
                            {message.parts.map((part) => {
                              if (part.type !== 'tool-call' || part.name !== 'show_quiz') return null
                              if (part.input === undefined) {
                                return part.state === 'error' ? null : <QuizCardSkeleton key={part.id} />
                              }
                              // A quiz the server rejected is replaced by the model's corrected call.
                              const quizResult = part.output ?? findResult(message, part.id)
                              const quizOutput = typeof quizResult === 'string' ? safeJson(quizResult) : quizResult
                              if (quizOutput?.shown === false) return null
                              return (
                                <QuizCard
                                  key={part.id}
                                  id={part.id}
                                  input={part.input as QuizInput}
                                  onAsk={(content) => void sendMessage(content)}
                                />
                              )
                            })}
                            {message.parts.map((part) => {
                              if (part.type !== 'tool-call' || part.name !== 'roleplay_turn') return null
                              const input = part.input ?? (part.arguments ? parsePartialJSON(part.arguments) : undefined)
                              if (!input?.character) return part.state === 'error' ? null : <RoleplayCardSkeleton key={part.id} />
                              return (
                                <RoleplayCard
                                  key={part.id}
                                  id={part.id}
                                  input={input as Partial<RoleplayInput>}
                                  active={!isLoading && message === messages.at(-1)}
                                  speaker={speaker}
                                  onReply={(content) => void sendMessage(content)}
                                />
                              )
                            })}
                            {message.parts.map((part) => {
                              if (part.type !== 'tool-call' || part.name !== 'render_ui') return null
                              const input = part.input ?? (part.arguments ? parsePartialJSON(part.arguments) : undefined)
                              const patches = (input as { patches?: unknown } | undefined)?.patches
                              if (!Array.isArray(patches)) return null
                              return (
                                <GenerativeUI
                                  key={part.id}
                                  patches={patches}
                                  streaming={part.input === undefined && part.state !== 'error'}
                                  onAsk={(content) => void sendMessage(content)}
                                />
                              )
                            })}
                            {inline.patches.length > 0 && (
                              <GenerativeUI
                                patches={inline.patches}
                                streaming={streaming}
                                onAsk={(content) => void sendMessage(content)}
                              />
                            )}
                            {reply && (
                              <div className={cn('group/reply flex items-center gap-2', !streaming && reaction && 'mb-5')}>
                                <div className="relative min-w-0 max-w-[85%]">
                                  <div
                                    data-reply-id={message.id}
                                    className="rounded-2xl rounded-bl-md border border-border bg-card px-4 py-3 font-serif text-reply leading-[1.7] text-card-foreground shadow-xs">
                                    <ReplyMarkdown text={reply} streaming={streaming} />
                                  </div>
                                  {!streaming && reaction && (
                                    <ReactionBadge
                                      emoji={reaction}
                                      label={t.removeReaction}
                                      onClick={() => react(message, reaction)}
                                      className="absolute -bottom-3.5 left-3"
                                    />
                                  )}
                                </div>
                                {!streaming && (
                                  <div data-print-exclude className="flex shrink-0 items-center gap-0.5 transition-opacity pointer-fine:opacity-0 group-hover/reply:opacity-100 focus-within:opacity-100 has-data-popup-open:opacity-100 has-[[aria-pressed=true]]:opacity-100">
                                    <ReactionPicker
                                      selected={reaction}
                                      onSelect={(emoji) => react(message, emoji)}
                                    />
                                    <CopyButton text={reply} />
                                    <SpeakButton
                                      status={speaker.activeId === message.id ? speaker.status : 'idle'}
                                      onClick={() =>
                                        speaker.activeId === message.id
                                          ? speaker.stop()
                                          : speaker.speak(message.id, speechContent(message))
                                      }
                                    />
                                    {!isLoading && !error && message === messages.at(-1) && (
                                      <RetryButton onClick={() => void reload()} />
                                    )}
                                    <TurnInfoButton runs={persistedRuns(message) ?? stats.runs} messageId={message.id} />
                                  </div>
                                )}
                              </div>
                            )}
                            {message.metadata?.stepLimit === true && (
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <IconAlertTriangle className="size-3.5" />
                                {t.stepLimit}
                              </p>
                            )}
                            <SourceList sources={turnSources(messages, index)} />
                            {streaming && message.parts.at(-1)?.type !== 'text' && (
                              <PendingIndicator since={loadingSince} />
                            )}
                            {!streaming && !reply && !isLoading && !error && message === messages.at(-1) && (
                              <RetryButton onClick={() => void reload()} />
                            )}
                            {!isLoading && !error && suggestions?.messageId === message.id && (
                              <SuggestionList items={suggestions.items} onPick={(text) => void sendMessage(text)} />
                            )}
                          </MessageContent>
                        </Message>
                      </MessageScrollerItem>
                    )
                  })}
                  {isLoading && messages.at(-1)?.role === 'user' && <PendingIndicator since={loadingSince} />}
                  {interrupts.map((interrupt) =>
                    interrupt.kind === 'tool-approval' ? (
                      <ApprovalCard
                        key={interrupt.id}
                        toolName={interrupt.toolName}
                        args={interrupt.originalArgs}
                        onApprove={() => interrupt.resolveInterrupt(true)}
                        onDeny={() => interrupt.resolveInterrupt(false)}
                      />
                    ) : null,
                  )}
                  {error && !isLoading && (
                    <ErrorCard
                      error={error}
                      message={describeError(error, online, t)}
                      onRetry={() => void reload()}
                    />
                  )}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
              <ConversationMinimap questions={questions} messageIds={messageIds} />
            </MessageScroller>
          </ViewTransition>
        </div>

        <div className="mx-auto w-full max-w-4xl px-4 pb-4">
          <ViewTransition name="composer">{composer}</ViewTransition>
        </div>
      </div>
    </MessageScrollerProvider>
  )
  }
}

type FollowUpSuggestions = { messageId: string; items: Array<string> | null }

/** Fetches 3-5 follow-up prompts once a reply finishes streaming; `items` is null while loading. */
function useFollowUpSuggestions({
  threadId,
  model,
  messages,
  isLoading,
  failed,
  enabled,
}: {
  threadId: string
  model: string | undefined
  messages: ReadonlyArray<UIMessage>
  isLoading: boolean
  failed: boolean
  enabled: boolean
}) {
  const [suggestions, setSuggestions] = React.useState<FollowUpSuggestions | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const wasLoading = React.useRef(isLoading)
  const queryClient = useQueryClient()

  React.useEffect(() => {
    const finished = wasLoading.current && !isLoading
    wasLoading.current = isLoading
    if (isLoading) {
      abortRef.current?.abort()
      setSuggestions(null)
      return
    }
    if (!finished || !enabled || failed || !model) return
    const last = messages.at(-1)
    const question = messages.filter((m) => m.role === 'user').at(-1)
    if (last?.role !== 'assistant' || !question || reactionMeta(question)) return
    const answer = splitInlinePatches(getText(last)).text.trim()
    if (!answer) return

    const controller = new AbortController()
    abortRef.current = controller
    const messageId = last.id
    setSuggestions({ messageId, items: null })
    const queryKey = ['suggestions', threadId, messageId]
    void queryClient
      .fetchQuery({
        queryKey,
        queryFn: async ({ signal }) => {
          const res = await fetch('/api/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ threadId, model, question: getText(question), answer }),
            signal,
          })
          const { suggestions: items = [] } = (await res.json()) as { suggestions?: Array<string> }
          return items
        },
        staleTime: Infinity,
      })
      .then((items) => {
        if (!controller.signal.aborted) setSuggestions(items.length ? { messageId, items } : null)
      })
      .catch(() => {
        if (!controller.signal.aborted) setSuggestions(null)
      })
    controller.signal.addEventListener('abort', () => void queryClient.cancelQueries({ queryKey }), { once: true })
  }, [isLoading, enabled, failed, model, messages, threadId])

  React.useEffect(() => () => abortRef.current?.abort(), [])

  return enabled ? suggestions : null
}

function SuggestionList({ items, onPick }: { items: Array<string> | null; onPick: (text: string) => void }) {
  const t = useMessages(copy)
  return (
    <div data-print-exclude className="flex max-w-[85%] flex-col items-start gap-2 animate-in fade-in duration-150">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <IconSparkles className="size-3.5" />
        {t.nextSuggestions}
      </span>
      <div className="flex flex-wrap gap-2" aria-busy={items === null}>
        {items === null
          ? [40, 56, 48].map((w) => (
              <span key={w} className="h-8 animate-pulse rounded-full bg-muted" style={{ width: `${w * 4}px` }} />
            ))
          : items.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onPick(item)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-sm text-card-foreground shadow-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {item}
              </button>
            ))}
      </div>
    </div>
  )
}

function ScrollToEndOnNewMessage({ count }: { count: number }) {
  const { scrollToEnd } = useMessageScroller()
  const prev = React.useRef(count)
  React.useEffect(() => {
    if (count > prev.current) scrollToEnd({ behavior: 'smooth' })
    prev.current = count
  }, [count, scrollToEnd])
  return null
}

/** Brain outline that fills up from the bottom, one step per effort level. */
function Composer({
  threadId,
  busy,
  offline,
  runs,
  turns,
  messageCount,
  started,
  onSend,
  onStop,
}: {
  threadId: string
  busy: boolean
  runs: Array<RunStat>
  turns: number
  messageCount: number
  started: boolean
  offline: boolean
  onSend: (text: string) => void
  onStop: () => void
}) {
  const t = useMessages(copy)
  const shellT = useMessages(shellCopy)
  const [input, setInput] = React.useState(takeFallbackInput)
  const formRef = React.useRef<HTMLFormElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  React.useEffect(() => {
    // Start focused, with the caret after any text typed into the server-rendered composer.
    const el = textareaRef.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  const canSend = input.trim().length > 0 && !busy && !offline

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSend) return
    onSend(input.trim())
    setInput('')
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="w-full">
      <InputGroup className="h-auto rounded-2xl border-ring bg-card shadow-[0_0.25rem_1.25rem_rgba(0,0,0,0.04)] ring-3 ring-ring/50 dark:bg-card">
        <InputGroupTextarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          ref={textareaRef}
          aria-label={shellT.messageLabel}
          className="min-h-14 px-4 pt-4 text-chat"
          data-composer
          autoFocus
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              formRef.current?.requestSubmit()
            }
          }}
        />
        <InputGroupAddon align="block-end" className="px-3 pb-3">
          <ComposerTools threadId={threadId} offline={offline} runs={runs} turns={turns} messageCount={messageCount} started={started} />
          {busy ? (
            <InputGroupButton
              type="button"
              variant="default"
              size="icon-sm"
              className="rounded-lg"
              onClick={onStop}
            >
              <IconSquare className="fill-current" />
              <span className="sr-only">{t.stop}</span>
            </InputGroupButton>
          ) : (
            <InputGroupButton
              type="submit"
              variant="default"
              size="icon-sm"
              disabled={offline}
              className="rounded-lg"
            >
              <IconArrowUp />
              <span className="sr-only">{t.send}</span>
            </InputGroupButton>
          )}
        </InputGroupAddon>
      </InputGroup>
    </form>
  )
}

function formatElapsed(ms: number) {
  const total = Math.floor(ms / 1000)
  if (total < 60) return `${total}s`
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

const QUOTE_INTERVAL = 8000

function PendingIndicator({ since }: { since: number | null }) {
  const t = useMessages(copy)
  const [now, setNow] = React.useState(() => Date.now())
  const [start] = React.useState(() => Date.now())
  const [seed] = React.useState(() => Math.floor(Math.random() * t.quotes.length))
  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  const step = Math.floor((now - start) / QUOTE_INTERVAL)
  const quote = t.quotes[(seed + step) % t.quotes.length]
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Logo className="size-6 shrink-0 animate-spin [animation-duration:3s] motion-reduce:animate-none" />
      <span className="sr-only">{t.answering}</span>
      {since !== null && (
        <span aria-hidden className="shrink-0 tabular-nums">
          {formatElapsed(Math.max(0, now - since))}
        </span>
      )}
      {quote && (
        <span
          key={step}
          aria-hidden
          className="min-w-0 truncate italic animate-in fade-in duration-200 motion-reduce:animate-none"
        >
          <span className="mr-1.5 not-italic opacity-50">·</span>
          {quote.text}
          {quote.author && <span className="not-italic opacity-70"> — {quote.author}</span>}
        </span>
      )}
    </div>
  )
}

function RetryButton({ onClick }: { onClick: () => void }) {
  const t = useMessages(copy)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            data-print-exclude
            variant="ghost"
            size="icon-sm"
            aria-label={t.retry}
            className="text-muted-foreground hover:text-foreground"
            onClick={onClick}
          />
        }
      >
        <IconRotate />
      </TooltipTrigger>
      <TooltipContent>{t.retry}</TooltipContent>
    </Tooltip>
  )
}

function ErrorCard({
  error,
  message,
  onRetry,
}: {
  error: Error
  message: string
  onRetry: () => void
}) {
  const t = useMessages(copy)
  return (
    <div
      role="alert"
      data-print-exclude
      className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm animate-in fade-in duration-150"
    >
      <div className="flex items-center gap-2">
        <IconCircleX className="size-4 shrink-0 text-destructive" />
        <span className="flex-1">{message}</span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <IconRotate />
          {t.retry}
        </Button>
      </div>
      <Collapsible>
        <CollapsibleTrigger className="group/details inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          {t.details}
          <IconChevronDown className="size-3 transition-transform group-aria-expanded/details:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-2 font-mono text-xs">{error.message}</pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

function EditButton({ onClick }: { onClick: () => void }) {
  const t = useMessages(copy)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.edit}
            className="text-muted-foreground hover:text-foreground"
            onClick={onClick}
          />
        }
      >
        <IconPencil />
      </TooltipTrigger>
      <TooltipContent>{t.edit}</TooltipContent>
    </Tooltip>
  )
}

function UserMessageEditor({
  initialText,
  onCancel,
  onSubmit,
}: {
  initialText: string
  onCancel: () => void
  onSubmit: (text: string) => void
}) {
  const t = useMessages(copy)
  const [text, setText] = React.useState(initialText)
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  const trimmed = text.trim()
  const canSubmit = trimmed.length > 0 && trimmed !== initialText.trim()
  return (
    <div className="flex w-full max-w-[85%] flex-col gap-2 self-end rounded-2xl border border-border bg-user-bubble p-3 shadow-xs">
      <textarea
        ref={ref}
        value={text}
        rows={1}
        aria-label={t.editQuestion}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel()
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            if (canSubmit) onSubmit(trimmed)
          }
        }}
        className="field-sizing-content max-h-60 min-h-6 w-full resize-none bg-transparent px-1 text-chat leading-relaxed outline-none"
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button size="sm" disabled={!canSubmit} onClick={() => onSubmit(trimmed)}>
          {t.send}
        </Button>
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const t = useMessages(copy)
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])
  const label = copied ? t.copied : t.copy
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className="text-muted-foreground hover:text-foreground"
            onClick={() => void navigator.clipboard.writeText(text).then(() => setCopied(true))}
          />
        }
      >
        {copied ? <IconCheck /> : <IconCopy />}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function SpeakButton({ status, onClick }: { status: SpeakerStatus; onClick: () => void }) {
  const t = useMessages(copy)
  const label = status === 'idle' ? t.readAloud : t.stopReading
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            aria-pressed={status !== 'idle'}
            className={cn(
              'text-muted-foreground hover:text-foreground',
              status !== 'idle' && 'text-foreground',
            )}
            onClick={onClick}
          />
        }
      >
        {status === 'loading' ? (
          <IconLoader2 className="animate-spin" />
        ) : status === 'playing' ? (
          <IconSquare className="fill-current" />
        ) : (
          <IconVolume />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function ReactionBadge({
  emoji,
  label,
  className,
  onClick,
}: {
  emoji: string
  label: string
  className?: string
  onClick?: () => void
}) {
  const Comp = onClick ? 'button' : 'span'
  return (
    <Comp
      data-print-emoji
      type={onClick ? 'button' : undefined}
      aria-label={`${label}: ${emoji}`}
      title={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-7 items-center gap-1 rounded-full border bg-card px-2 text-sm shadow-xs ring-3 ring-background animate-in zoom-in-50 duration-150',
        onClick && 'hover:bg-muted',
        className,
      )}
    >
      {emoji}
    </Comp>
  )
}

const foldDiacritics = (text: string) =>
  text.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D')

// Search matches the label and tags, so add English keywords and unaccented Vietnamese ("ca phe" finds ☕).
const resolveEmojiData: EmojiDataResolver = async (locale, options) => {
  const [data, en, vi] = await Promise.all(
    [locale, 'en', 'vi'].map((l) => defaultEmojiDataResolver(l, options)),
  )
  const extra = new Map<string, Array<string>>()
  for (const source of [en, vi]) {
    for (const emoji of source.emojis) {
      const words = [emoji.label, ...emoji.tags]
      extra.set(emoji.emoji, [...(extra.get(emoji.emoji) ?? []), ...words, ...words.map(foldDiacritics)])
    }
  }
  return {
    ...data,
    emojis: data.emojis.map((emoji) => ({
      ...emoji,
      tags: [...new Set([...emoji.tags, ...(extra.get(emoji.emoji) ?? [])])],
    })),
  }
}

function ReactionPicker({
  selected,
  onSelect,
}: {
  selected?: string
  onSelect: (emoji: string) => void
}) {
  const t = useMessages(copy)
  const locale = useLocale()
  const [open, setOpen] = React.useState(false)
  const [expanded, setExpanded] = React.useState(false)
  const quick: ReadonlyArray<string> =
    selected && !reactionEmojis.some((e) => e === selected)
      ? [...reactionEmojis, selected]
      : reactionEmojis

  function select(emoji: string) {
    onSelect(emoji)
    setOpen(false)
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next, { reason }) => {
        // The full picker is larger than the quick bar, so the pointer often ends up outside it; keep it open until an explicit dismiss.
        if (!next && expanded && reason === 'trigger-hover') return
        setOpen(next)
      }}
      onOpenChangeComplete={(next) => !next && setExpanded(false)}
    >
      <Popover.Trigger
        openOnHover
        delay={200}
        closeDelay={250}
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t.react}
            className="text-muted-foreground hover:text-foreground"
          />
        }
      >
        <IconMoodPlus />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="center" sideOffset={4} collisionPadding={8} className="z-50">
          <Popover.Popup
            className={cn(
              'border bg-popover shadow-md outline-none',
              expanded
                ? 'overflow-hidden rounded-xl'
                : 'flex gap-0.5 rounded-full p-1 animate-in fade-in zoom-in-95 duration-150',
            )}
          >
            {expanded ? (
              <EmojiPicker.Root
                locale={locale}
                resolveEmojiData={resolveEmojiData}
                columns={8}
                onEmojiSelect={({ emoji }) => select(emoji)}
                className="isolate flex h-80 w-[19rem] flex-col"
              >
                <div className="relative m-2">
                  <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <EmojiPicker.Search
                    autoFocus
                    placeholder={t.searchEmoji}
                    className="h-8 w-full rounded-md border bg-background pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                </div>
                <EmojiPicker.Viewport className="relative flex-1 outline-none">
                  <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    <IconLoader2 className="size-4 animate-spin" />
                  </EmojiPicker.Loading>
                  <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                    {t.emojiNotFound}
                  </EmojiPicker.Empty>
                  <EmojiPicker.List
                    className="select-none pb-1.5"
                    components={{
                      CategoryHeader: ({ category, ...props }) => (
                        <div
                          {...props}
                          className="bg-popover px-3 pt-2.5 pb-1.5 text-xs font-medium text-muted-foreground"
                        >
                          {category.label}
                        </div>
                      ),
                      Row: ({ children, ...props }) => (
                        <div {...props} className="scroll-my-1.5 px-1.5">
                          {children}
                        </div>
                      ),
                      Emoji: ({ emoji, ...props }) => (
                        <button
                          {...props}
                          className={cn(
                            'flex size-8 items-center justify-center rounded-md text-lg',
                            emoji.isActive && 'bg-muted',
                            emoji.emoji === selected && 'ring-1 ring-ring',
                          )}
                        >
                          {emoji.emoji}
                        </button>
                      ),
                    }}
                  />
                </EmojiPicker.Viewport>
              </EmojiPicker.Root>
            ) : (
              <>
                {quick.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    aria-label={emoji}
                    aria-pressed={emoji === selected}
                    onClick={() => select(emoji)}
                    className={cn(
                      'flex size-8 items-center justify-center rounded-full text-lg transition-transform hover:scale-125 hover:bg-muted',
                      emoji === selected && 'bg-muted',
                    )}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label={t.moreEmoji}
                  title={t.moreEmoji}
                  onClick={() => setExpanded(true)}
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <IconPlus className="size-4" />
                </button>
              </>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

function ReasoningRow({ text, running }: { text: string; running: boolean }) {
  const t = useMessages(copy)
  const [open, setOpen] = React.useState<boolean>()

  return (
    <TraceCollapsible open={open ?? running} onOpenChange={setOpen}>
      <TraceCollapsibleTrigger>
        <TraceLine status={running ? 'running' : undefined}>
          <TraceIcon>
            {running ? (
              <IconLoader2 className="animate-spin" />
            ) : (
              <IconCircleCheck />
            )}
          </TraceIcon>
          <TraceTitle>{running ? t.thinking : t.thought}</TraceTitle>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent className="whitespace-pre-wrap">
        {text}
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

function SourceList({ sources }: { sources: Array<WebSource> }) {
  const t = useMessages(copy)
  if (sources.length === 0) return null
  return (
    <Collapsible className="flex flex-col items-start gap-2">
      <CollapsibleTrigger className="group/sources inline-flex items-center gap-2 rounded-full border bg-card py-1 pr-2.5 pl-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
        <span className="flex -space-x-1">
          {sources.slice(0, 3).map((source) => (
            <Favicon key={source.url} url={source.url} className="rounded-full ring-2 ring-card" />
          ))}
        </span>
        {t.sourceCount(sources.length)}
        <IconChevronDown className="size-3.5 transition-transform group-aria-expanded/sources:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-wrap gap-1.5">
        {sources.map((source) => (
          <a
            key={source.url}
            href={source.url}
            target="_blank"
            rel="noreferrer"
            title={source.url}
            className="inline-flex max-w-60 items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Favicon url={source.url} className="rounded-sm" />
            <span className="truncate">{source.title}</span>
          </a>
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

function Favicon({ url, className }: { url: string; className?: string }) {
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`}
      alt=""
      className={cn('size-3.5 shrink-0 bg-card', className)}
    />
  )
}

/** The consecutive assistant messages starting at `index`: one reply, one message per model turn. */
function replyRun(messages: ReadonlyArray<UIMessage>, index: number) {
  if (messages[index]?.role !== 'assistant') return []
  let end = index + 1
  while (messages[end]?.role === 'assistant') end++
  return messages.slice(index, end)
}

function hasLaterReply(messages: ReadonlyArray<UIMessage>, index: number) {
  return replyRun(messages, index)
    .slice(1)
    .some((m) => splitInlinePatches(getText(m)).text.trim() !== '')
}

function findResult(message: UIMessage, toolCallId: string) {
  const part = message.parts.find(
    (p) => p.type === 'tool-result' && p.toolCallId === toolCallId,
  )
  return part?.type === 'tool-result' ? part.content : undefined
}

function formatValue(value: unknown) {
  if (value === undefined || value === '') return null
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

function ToolCallRow({
  name,
  state,
  input,
  output,
  progress,
}: {
  name: string
  state: string
  input: unknown
  output: unknown
  progress?: string
}) {
  const t = useMessages(copy)
  const running = state !== 'complete' && state !== 'error' && output === undefined
  const failed = state === 'error'
  const inputText = formatValue(input)
  const outputText = formatValue(output)

  return (
    <TraceCollapsible>
      <TraceCollapsibleTrigger>
        <TraceLine status={failed ? 'error' : running ? 'running' : undefined}>
          <TraceIcon>
            {failed ? (
              <IconCircleX />
            ) : running ? (
              <IconLoader2 className="animate-spin" />
            ) : (
              <IconTool />
            )}
          </TraceIcon>
          <TraceTitle>{t.tools[name] ?? name}</TraceTitle>
          <TraceDescription className="font-mono text-xs">
            {running && progress ? progress : state}
          </TraceDescription>
        </TraceLine>
      </TraceCollapsibleTrigger>
      <TraceCollapsibleContent>
        <div className="grid gap-2 font-mono text-xs">
          {inputText && <pre className="whitespace-pre-wrap rounded-md bg-muted p-2">{inputText}</pre>}
          {outputText && <pre className="whitespace-pre-wrap rounded-md bg-muted p-2">→ {outputText}</pre>}
        </div>
      </TraceCollapsibleContent>
    </TraceCollapsible>
  )
}

function ApprovalCard({
  toolName,
  args,
  onApprove,
  onDeny,
}: {
  toolName: string
  args: unknown
  onApprove: () => void
  onDeny: () => void
}) {
  const t = useMessages(copy)
  return (
    <div data-print-exclude className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <p className="text-sm">
        {t.approvalBefore}
        <span className="font-medium">{t.tools[toolName] ?? toolName}</span>
        {t.approvalAfter}
      </p>
      <pre className="whitespace-pre-wrap rounded-md bg-muted p-2 font-mono text-xs">
        {JSON.stringify(args, null, 2)}
      </pre>
      <div className="flex gap-2">
        <Button size="sm" onClick={onApprove}>
          {t.allow}
        </Button>
        <Button size="sm" variant="outline" onClick={onDeny}>
          {t.deny}
        </Button>
      </div>
    </div>
  )
}
