import { createFileRoute } from '@tanstack/react-router'
import {
  chat,
  chatParamsFromRequest,
  combineStrategies,
  maxIterations,
  memoryStream,
  resolveResumeRunId,
  resumeServerSentEventsResponse,
  toServerSentEventsResponse,
  untilFinishReason,
} from '@tanstack/ai'
import type { ChatMiddleware, StreamDurability } from '@tanstack/ai'
import { durableStream } from '@tanstack/ai-durable-stream'
import { reconstructChat, withPersistence } from '@tanstack/ai-persistence'
import { parse as parseMermaid } from 'pele'
import {
  fetchPageDef,
  getWeatherDef,
  learnWordDef,
  reactToMessageDef,
  sendEmailDef,
  setThemeDef,
  showMapDef,
  roleplayTurnDef,
  explainDeckDef,
  showDrawingBoardDef,
  showQuizDef,
  weatherConditions,
  webSearchDef,
} from '@/lib/tools'
import { fetchPage as fetchPageText, searchWeb } from '@/lib/web-search'
import { geocode } from '@/lib/geocode'
import { findWordImages } from '@/lib/word-images'
import { defineMessages, getLocale } from '@/lib/i18n'
import { isEffort } from '@/lib/effort'
import { parseReplyLanguages, replyLanguageInstruction } from '@/lib/reply-language'
import { CUSTOM_INSTRUCTIONS_MAX } from '@/lib/chat-settings'
import { buildSpec, renderUiDef, specIssues } from '@/lib/generative-ui'
import { EXPLAIN_STYLE_PROMPTS, MODE_PROMPTS, isExplainStyleId, isModeId } from '@/lib/modes'
import type { ExplainStyleId } from '@/lib/modes'
import { svgIssues } from '@/lib/svg-check'
import type { Visual, Weather, WeatherCondition } from '@/lib/tools'
import { parseModelKey } from '@/lib/providers'
import { chatPersistenceFor } from '@/server/chat-persistence.server'
import { createSandboxCodeMode } from '@/server/code-mode.server'
import { createUserAdapter } from '@/server/providers.server'
import { getSessionUser } from '@/server/session.server'
import { chatUsageMiddleware } from '@/server/usage.server'

const copy = defineMessages({
  vi: {
    weatherSteps: ['Tìm toạ độ', 'Gọi trạm khí tượng', 'Tổng hợp kết quả'],
    wordProgress: 'Tìm ảnh minh hoạ',
    loginRequired: 'Bạn cần đăng nhập',
    noModel: 'Chưa chọn model. Hãy thêm provider trong Cài đặt → Provider.',
    conditions: {
      sunny: 'Nắng',
      cloudy: 'Nhiều mây',
      rain: 'Mưa rào',
      storm: 'Dông',
      windy: 'Có gió',
    } as Record<WeatherCondition, string>,
  },
  en: {
    weatherSteps: ['Finding coordinates', 'Contacting weather station', 'Compiling results'],
    wordProgress: 'Finding illustrations',
    loginRequired: 'You need to sign in',
    noModel: 'No model selected. Add a provider in Settings → Provider.',
    conditions: {
      sunny: 'Sunny',
      cloudy: 'Cloudy',
      rain: 'Showers',
      storm: 'Stormy',
      windy: 'Windy',
    } as Record<WeatherCondition, string>,
  },
})

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const getWeather = getWeatherDef.server(async ({ city }, ctx) => {
  const steps = copy[getLocale()].weatherSteps
  for (const [i, label] of steps.entries()) {
    ctx?.emitCustomEvent('weather:progress', { step: i + 1, total: steps.length, label })
    await sleep(400)
  }
  return fakeWeather(city)
})

function fakeWeather(city: string): Weather {
  let seed = [...city].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7)
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) % 1000) / 1000
  const pick = () => weatherConditions[Math.floor(rand() * weatherConditions.length)]!

  const condition = pick()
  const low = Math.round(18 + rand() * 8)
  const high = low + 5 + Math.round(rand() * 6)
  const hourly = Array.from({ length: 24 }, (_, hour) => {
    const curve =
      hour >= 5 && hour <= 14
        ? (1 - Math.cos(((hour - 5) / 9) * Math.PI)) / 2
        : (1 + Math.cos((((hour - 14 + 24) % 24) / 15) * Math.PI)) / 2
    return {
      hour,
      temperature: Math.round(low + (high - low) * curve + (rand() - 0.5)),
      condition: rand() < 0.7 ? condition : pick(),
    }
  })

  const now = new Date()
  const current = hourly[now.getHours()]!
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')
  const temps = hourly.map((h) => h.temperature)

  return {
    city,
    condition: current.condition,
    conditionLabel: copy[getLocale()].conditions[current.condition],
    temperature: current.temperature,
    feelsLike: current.temperature + Math.round(rand() * 4 - 1),
    high: Math.max(...temps),
    low: Math.min(...temps),
    humidity: Math.round(45 + rand() * 50),
    windKph: Math.round(3 + rand() * 30),
    date,
    hourly,
  }
}

const reactToMessage = reactToMessageDef.server(async () => ({ reacted: true }))

const webSearch = webSearchDef.server(({ query }, ctx) => searchWeb(query, ctx?.abortSignal))

const fetchPage = fetchPageDef.server(({ url }, ctx) => fetchPageText(url, ctx?.abortSignal))

const showMap = showMapDef.server(({ query, zoom }) => geocode(query, zoom))

const learnWord = learnWordDef.server(async ({ word, imageQueries }, ctx) => {
  ctx?.emitCustomEvent('word:progress', { label: copy[getLocale()].wordProgress })
  return { images: await findWordImages(word, imageQueries) }
})

const renderUi = renderUiDef.server(async ({ patches }) => {
  const issues = specIssues(buildSpec(patches))
  return { rendered: issues.length === 0, issues }
})

const showQuiz = showQuizDef.server(async ({ questions }) => {
  const issues = questions.flatMap((q, i) =>
    q.answer < q.options.length ? [] : [`questions/${i}: answer ${q.answer} is out of range for ${q.options.length} options.`],
  )
  return { shown: issues.length === 0, issues }
})

const roleplayTurn = roleplayTurnDef.server(async () => ({ shown: true }))

const showDrawingBoard = showDrawingBoardDef.server(async () => ({ shown: true }))

const MERMAID_BLOCK = /```mermaid[^\n]*\n([\s\S]*?)```/g
const SVG_BLOCK = /```svg[^\n]*\n([\s\S]*?)```/g

const MAX_MARK_NAMES = 3

/** What would draw a visual slide wrong: indexes past its items, a bar that is not a number, too many marks. */
function visualIssues(visual: Visual | undefined): Array<string> {
  if (!visual) return ['the visual layout needs visual']
  const { items, steps } = visual
  const issues: Array<string> = []
  if (visual.kind === 'bars' && items.some((item) => !Number.isFinite(Number(item))))
    issues.push('bars items must all be numbers; use cells for text')
  const names = new Set<string>()
  for (const [i, step] of steps.entries()) {
    const indexes = [
      ...(step.marks ?? []).map((mark) => mark.at),
      ...(step.highlight ?? []),
      ...(step.window ? [step.window.from, step.window.to] : []),
      ...(step.arrow ? [step.arrow.from, step.arrow.to] : []),
      ...(step.set ?? []).map((change) => change.at),
      ...(step.swap ?? []),
      ...(step.done ?? []),
    ]
    const outside = indexes.find((index) => index < 0 || index >= items.length)
    if (outside !== undefined) issues.push(`visual.steps/${i}: index ${outside} is outside the ${items.length} items (0-${items.length - 1})`)
    if (step.window && step.window.from > step.window.to) issues.push(`visual.steps/${i}: window.from must not be after window.to`)
    if (step.swap && step.swap[0] === step.swap[1]) issues.push(`visual.steps/${i}: swap needs two different positions`)
    for (const mark of step.marks ?? []) names.add(mark.name)
  }
  if (names.size > MAX_MARK_NAMES) issues.push(`visual uses ${names.size} mark names; use at most ${MAX_MARK_NAMES}`)
  return issues
}

// Diagrams are checked with the same parser the chat renders them with, so a broken one comes back to the model to fix.
// Each layout's own field is checked too, since the schema leaves them optional. The result records the style the
// lesson was built in, so the card can label it and offer a rebuild after the viewer switches styles.
const explainDeckFor = (style: ExplainStyleId | undefined) => explainDeckDef.server(async ({ slides }) => {
  const issues = slides.flatMap((slide, i) => {
    const at = `slides/${i} ("${slide.title}")`
    const layout = slide.layout ?? 'content'
    const problems: Array<string> = []
    if (layout === 'content' && !slide.content?.trim()) problems.push(`${at}: the content layout needs content`)
    if (layout === 'cards' && (slide.cards?.length ?? 0) < 2) problems.push(`${at}: the cards layout needs 2-4 cards`)
    if (layout === 'quiz') {
      const quiz = slide.quiz
      if (!quiz) problems.push(`${at}: the quiz layout needs quiz`)
      else if (quiz.answer < 0 || quiz.answer >= quiz.options.length)
        problems.push(`${at}: quiz.answer must be the index of one of its ${quiz.options.length} options`)
    }
    for (const [, source] of (slide.content ?? '').matchAll(MERMAID_BLOCK)) {
      try {
        parseMermaid(source!)
      } catch (error) {
        problems.push(`${at}: mermaid diagram does not parse: ${(error as Error).message}`)
      }
    }
    if (layout === 'visual') problems.push(...visualIssues(slide.visual).map((issue) => `${at}: ${issue}`))
    for (const [, source] of (slide.content ?? '').matchAll(SVG_BLOCK)) {
      for (const issue of svgIssues(source!)) problems.push(`${at}: svg drawing: ${issue}`)
    }
    return problems
  })
  return { shown: issues.length === 0, issues, ...(style && { style }) }
})

const sendEmail = sendEmailDef.server(async () => {
  await sleep(300)
  return { sent: true, messageId: `msg_${Date.now().toString(36)}` }
})

// execute_typescript: the model writes a program that calls these two tools (and nothing else) from inside the sandbox.
const codeMode = createSandboxCodeMode([webSearch, fetchPage])

const streamsUrl = process.env.DURABLE_STREAMS_URL

/**
 * Run logs are keyed by the client-sent runId, so scope them to the user: otherwise anyone signed in
 * who learns a runId could replay another account's stream or append to it.
 */
function durabilityFor(request: Request, userId: string): StreamDurability {
  if (streamsUrl) {
    return durableStream(request, { server: streamsUrl, streamPrefix: `chat-runs/${userId}` }) as unknown as StreamDurability
  }
  const runId = resolveResumeRunId(request) ?? crypto.randomUUID()
  const offset = request.headers.get('Last-Event-ID') ?? new URL(request.url).searchParams.get('offset')
  // A memory offset embeds its run id, and memoryStream rejects one that names a different run.
  return memoryStream({ runId: `${userId}:${runId}`, offset })
}

const activeRuns = new Map<string, AbortController>()
const RUN_TTL = 15 * 60_000

function trackRun(runId: string) {
  const controller = new AbortController()
  activeRuns.set(runId, controller)
  setTimeout(() => activeRuns.delete(runId), RUN_TTL).unref?.()
  return controller
}

const MAX_STEPS = 20

/**
 * On the last allowed model turn, turn tool use off and ask for a final answer, so a run that hits
 * the step cap still ends with a reply. The reply is tagged `stepLimit` in its message metadata.
 */
const finalStep: ChatMiddleware = {
  name: 'final-step',
  onConfig: (ctx, config) => {
    if (ctx.phase !== 'beforeModel' || ctx.iteration < MAX_STEPS - 1) return
    return {
      toolChoice: 'none',
      systemPrompts: [
        ...config.systemPrompts,
        'You have reached the step limit for this turn and cannot call any more tools. Answer now using what you already found, and briefly note anything you could not finish.',
      ],
    }
  },
  onChunk: (ctx, chunk) => {
    if (ctx.iteration < MAX_STEPS - 1 || chunk.type !== 'TEXT_MESSAGE_START') return
    return { ...chunk, metadata: { ...chunk.metadata, stepLimit: true } }
  },
}

const UI_ONLY_TOOLS = new Set(['render_ui', 'show_quiz', 'roleplay_turn', 'show_drawing_board', 'explain_deck', 'react_to_message'])

/**
 * A displayed UI or quiz is the reply. Without this, the model gets another turn after the card renders
 * and writes a second lead-in line under the one it already sent with the tool call.
 */
const stopAfterUi: ChatMiddleware = {
  name: 'stop-after-ui',
  onShouldContinue: (_ctx, { messages }) => {
    let i = messages.length
    while (i > 0 && messages[i - 1]!.role === 'tool') i--
    const calls = messages[i - 1]?.role === 'assistant' ? (messages[i - 1]!.toolCalls ?? []) : []
    const displayCalls = calls.filter((call) => call.function.name !== 'react_to_message')
    if (displayCalls.length === 0 || !calls.every((call) => UI_ONLY_TOOLS.has(call.function.name))) return
    const results = new Map(messages.slice(i).map((m) => [m.toolCallId, m.content]))
    const shown = displayCalls.every((call) => {
      const content: unknown = results.get(call.id)
      try {
        const output = (typeof content === 'string' ? JSON.parse(content) : content) as { rendered?: unknown; shown?: unknown } | null
        // render_ui reports spec issues with rendered: false; the model needs another turn to fix them.
        return output?.rendered === true || output?.shown === true
      } catch {
        return false
      }
    })
    if (shown) return false
  },
}

function unauthorized() {
  return Response.json({ error: copy[getLocale()].loginRequired }, { status: 401 })
}

export const Route = createFileRoute('/api/chat')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const user = getSessionUser()
        if (!user) return unauthorized()
        // Opening a thread asks for its stored transcript (?threadId=); rejoining a live run names a runId.
        const params = new URL(request.url).searchParams
        if (params.has('threadId') && !params.has('runId')) {
          // The stores only see this user's rows, so a thread id that belongs to someone else reads as empty.
          return reconstructChat(chatPersistenceFor(user.id), request, { authorize: () => true })
        }
        return resumeServerSentEventsResponse({ adapter: durabilityFor(request, user.id) })
      },
      DELETE: ({ request }) => {
        const user = getSessionUser()
        if (!user) return unauthorized()
        const runId = new URL(request.url).searchParams.get('runId')
        if (runId) {
          const key = `${user.id}:${runId}`
          activeRuns.get(key)?.abort()
          activeRuns.delete(key)
        }
        return new Response(null, { status: 204 })
      },
      POST: async ({ request }) => {
        const user = getSessionUser()
        if (!user) return unauthorized()
        const { messages, threadId, runId, parentRunId, resume, forwardedProps } =
          await chatParamsFromRequest(request)
        const effort = isEffort(forwardedProps.effort) ? forwardedProps.effort : 'high'
        const text = (value: unknown, max = CUSTOM_INSTRUCTIONS_MAX) =>
          typeof value === 'string' ? value.trim().slice(0, max) : ''
        const customInstructions = text(forwardedProps.customInstructions)
        const projectName = text(forwardedProps.projectName, 200)
        const projectInstructions = text(forwardedProps.projectInstructions)
        const replyLanguages = parseReplyLanguages(forwardedProps.replyLanguages)
        const mode = isModeId(forwardedProps.mode) ? forwardedProps.mode : null
        const explainStyle =
          mode === 'explain' && isExplainStyleId(forwardedProps.explainStyle) ? forwardedProps.explainStyle : undefined
        const selected = typeof forwardedProps.model === 'string' ? parseModelKey(forwardedProps.model) : null
        if (!selected) return Response.json({ error: copy[getLocale()].noModel }, { status: 400 })
        let resolved: ReturnType<typeof createUserAdapter>
        try {
          resolved = createUserAdapter(user.id, selected.providerId, selected.modelId, threadId)
        } catch (error) {
          return Response.json({ error: (error as Error).message }, { status: 400 })
        }
        const durability = durabilityFor(request, user.id)
        const fresh = durability.resumeFrom() === null
        const abortController = fresh && runId ? trackRun(`${user.id}:${runId}`) : new AbortController()

        const stream = chat({
          adapter: resolved.adapter,
          systemPrompts: [
            `You are a friendly assistant. Keep replies concise. ${replyLanguageInstruction(replyLanguages)}`,
            'Use get_weather when asked about the weather, show_map when the user wants to see a map or location of a place (the map is already shown in the interface, so do not paste a link), set_theme when asked to switch the interface between light and dark, send_email when asked to send an email, and web_search when you need new information or are unsure. Then use fetch_page to read the 1-2 most relevant pages before answering. Cite your sources.',
            'When the user wants to learn or look up an English word (e.g. "help me learn the word lit"), call learn_word right away with the exact IPA, the Vietnamese meaning, 5 example sentences, and 3 image search keywords. The card already shows the IPA, video, example sentences, and images, so do not repeat them; reply with only 1-2 sentences of memory tips.',
            'For any multiple-choice practice or quiz (grammar, vocabulary, reading, trivia...), call show_quiz instead of render_ui: give every option a one-sentence explanation of why it is right or wrong, and a hint that does not give the answer away. The card grades answers itself, so never reveal the answers in the text.',
            'When the user wants to draw something for you to guess (Pictionary, "tôi vẽ bạn đoán") or to show you a sketch, call show_drawing_board instead of asking them to describe it. When a drawing arrives, make one confident guess with a short reason from what you see, and ask if it is right; the user gets 3 guesses. After a wrong guess, give your next guess, and when they want to add details call show_drawing_board again. Once it is right or the 3 guesses are used, celebrate or ask for the answer, then offer another round.',
            'Use render_ui when the answer fits a visual format (comparisons, metrics, tables, schedules, checklists, multi-part content that needs Tabs/Accordion) or when the user needs to choose or fill in information (Choice, Select, Slider, Checkbox, Input). Weather and maps already have their own cards via get_weather/show_map, so do not rebuild them with render_ui. If render_ui returns issues, call it again with the corrected spec. Never write UI patches/JSON in the text reply.',
            'The chat can render Mermaid diagrams: when a diagram, flowchart, or timeline is needed, write it in a ```mermaid block (one statement per line; only wrap node or edge labels in double quotes in flowcharts when they contain special characters, and never wrap the message text of a sequenceDiagram). The chat column is narrow (~640px): prefer `flowchart TB`, keep labels short (under ~6 words, with details in the text), and keep each level to at most 4 nodes. Split large diagrams into several small ones instead of telling the user to paste them into another tool.',
            'Use execute_typescript when an answer needs exact computation or data processing (arithmetic, dates, unit conversion, sorting, filtering, aggregating or reformatting many values) or when you would otherwise call web_search/fetch_page many times in a row and combine the results: write one short program instead of working it out in your head. Skip it for simple questions. Return the final value from the program and tell the user the result in plain language.',
            codeMode.systemPrompt,
            'From time to time, use react_to_message to react to the user\'s messages with an emoji when it fits, like a friend texting.',
            ...(mode ? [MODE_PROMPTS[mode]] : []),
            ...(explainStyle ? [EXPLAIN_STYLE_PROMPTS[explainStyle]] : []),
            ...(customInstructions
              ? [`The user has provided custom instructions. Follow them unless they conflict with the rules above:\n<custom_instructions>\n${customInstructions}\n</custom_instructions>`]
              : []),
            ...(projectInstructions
              ? [`This conversation belongs to the project "${projectName || 'Untitled'}". Follow the project instructions below; they take precedence over the user's general custom instructions but not over the rules above:\n<project_instructions>\n${projectInstructions}\n</project_instructions>`]
              : []),
          ],
          messages,
          threadId,
          runId,
          parentRunId,
          resume,
          tools: [getWeather, setThemeDef, sendEmail, reactToMessage, webSearch, fetchPage, showMap, learnWord, showQuiz, roleplayTurn, showDrawingBoard, explainDeckFor(explainStyle), renderUi, ...codeMode.tools],
          // Only the Messages API makes max_tokens mandatory; Gemini and Ollama fall back to the model's own output limit.
          modelOptions: resolved.api === 'anthropic' ? { max_tokens: 16000 } : {},
          reasoning: effort,
          // The default cap of 5 model turns ends research runs (search + several fetch_page calls)
          // right after a tool call, before the model gets to write a reply. finalStep forces one.
          agentLoopStrategy: combineStrategies([maxIterations(MAX_STEPS), untilFinishReason(['length'])]),
          middleware: [
            finalStep,
            stopAfterUi,
            withPersistence(chatPersistenceFor(user.id)),
            chatUsageMiddleware(user.id, resolved.catalogProvider),
          ],
          abortController,
        })

        return toServerSentEventsResponse(stream, { abortController, durability: { adapter: durability } })
      },
    },
  },
})
