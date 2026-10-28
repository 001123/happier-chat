import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export const weatherConditions = ['sunny', 'cloudy', 'rain', 'storm', 'windy'] as const
export type WeatherCondition = (typeof weatherConditions)[number]

export const weatherSchema = z.object({
  city: z.string(),
  condition: z.enum(weatherConditions),
  conditionLabel: z.string(),
  temperature: z.number(),
  feelsLike: z.number(),
  high: z.number(),
  low: z.number(),
  humidity: z.number(),
  windKph: z.number(),
  date: z.string(),
  hourly: z.array(
    z.object({
      hour: z.number().int().min(0).max(23),
      temperature: z.number(),
      condition: z.enum(weatherConditions),
    }),
  ),
})
export type Weather = z.infer<typeof weatherSchema>

export const getWeatherDef = toolDefinition({
  name: 'get_weather',
  description: 'Get the current weather for a city',
  inputSchema: z.object({
    city: z.string().meta({ description: 'City name' }),
  }),
  outputSchema: weatherSchema,
})

export const setThemeDef = toolDefinition({
  name: 'set_theme',
  description: 'Switch the app appearance to light or dark mode',
  inputSchema: z.object({ theme: z.enum(['light', 'dark']) }),
  outputSchema: z.object({ applied: z.boolean() }),
})

export const sendEmailDef = toolDefinition({
  name: 'send_email',
  description:
    'Send an email (simulated). The UI automatically asks the user for approval, so call the tool right away instead of asking for confirmation in text.',
  inputSchema: z.object({
    to: z.string(),
    subject: z.string(),
    body: z.string(),
  }),
  outputSchema: z.object({ sent: z.boolean(), messageId: z.string() }),
  needsApproval: true,
})

export const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '🎉'] as const
export type ReactionEmoji = (typeof reactionEmojis)[number]

export const reactToMessageDef = toolDefinition({
  name: 'react_to_message',
  description:
    "React with an emotion emoji to the user's most recent message. Only use this when the message truly evokes emotion (joy, thanks, sad news, sharing an achievement...), at most once per turn, and still reply with text as usual.",
  inputSchema: z.object({ emoji: z.enum(reactionEmojis) }),
  outputSchema: z.object({ reacted: z.boolean() }),
})

export const webResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string(),
})
export type WebResult = z.infer<typeof webResultSchema>

export const webSearchDef = toolDefinition({
  name: 'web_search',
  description:
    'Search the web and return a list of titles, URLs and snippets. Use when you need up-to-date information or are unsure. Snippets are usually short, so use fetch_page to read the most relevant page in full.',
  inputSchema: z.object({
    query: z.string().meta({ description: 'Search keywords' }),
  }),
  outputSchema: z.object({
    engine: z.string(),
    results: z.array(webResultSchema),
  }),
})

export const fetchPageDef = toolDefinition({
  name: 'fetch_page',
  description: 'Fetch a web page and return its text content (HTML removed, truncated).',
  inputSchema: z.object({
    url: z.string().meta({ description: 'http(s) URL to read' }),
  }),
  outputSchema: z.object({
    url: z.string(),
    title: z.string(),
    content: z.string(),
    truncated: z.boolean(),
  }),
})

export const mapLocationSchema = z.object({
  query: z.string(),
  name: z.string(),
  address: z.string(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  zoom: z.number().int().min(1).max(21),
})
export type MapLocation = z.infer<typeof mapLocationSchema>

export const showMapDef = toolDefinition({
  name: 'show_map',
  description:
    'Show an interactive Google Maps view of a place (city, address, restaurant, building...) directly in the chat. Use when the user wants to see a map, a location, or directions. Do not paste a Google Maps link into the answer, since the UI already displays the map.',
  inputSchema: z.object({
    query: z.string().meta({ description: 'Place name or address, as specific as possible' }),
    zoom: z
      .number()
      .int()
      .min(1)
      .max(21)
      .optional()
      .meta({ description: 'Zoom level: ~5 country, ~11 city, ~15 neighborhood, ~17 specific address' }),
  }),
  outputSchema: mapLocationSchema,
})

export const wordExampleSchema = z.object({
  en: z.string().meta({ description: 'English example sentence containing the word being learned' }),
  vi: z.string().meta({ description: 'Vietnamese translation of the sentence' }),
})

export const wordImageSchema = z.object({
  title: z.string(),
  thumbUrl: z.string(),
  pageUrl: z.string(),
})
export type WordImage = z.infer<typeof wordImageSchema>

export const learnWordInputSchema = z.object({
  word: z.string().meta({ description: 'English word to learn, in lowercase' }),
  partOfSpeech: z.string().meta({ description: 'Part of speech, e.g. "adjective", "verb (past of light)"' }),
  ipaUs: z.string().meta({ description: 'US English IPA transcription, enclosed in /.../' }),
  ipaUk: z.string().meta({ description: 'UK English IPA transcription, enclosed in /.../' }),
  meaningVi: z.string().meta({ description: 'Short meaning in Vietnamese; separate multiple meanings with "; "' }),
  examples: z
    .array(wordExampleSchema)
    .length(5)
    .meta({ description: '5 natural example sentences, varied in context and meaning' }),
  imageQueries: z
    .array(z.string())
    .length(3)
    .meta({ description: '3 short English keywords to search for illustrative images, one per meaning or context, e.g. "lit candle"' }),
})
export type LearnWordInput = z.infer<typeof learnWordInputSchema>

export const learnWordDef = toolDefinition({
  name: 'learn_word',
  description:
    'Display an English vocabulary card: IPA with a listen button, a YouGlish pronunciation video, 5 example sentences with read-aloud buttons, and 3 illustrative images. Use when the user wants to learn or look up an English word (e.g. "help me learn the word lit"). The card already shows all the content, so the text reply only needs 1-2 memory tips.',
  inputSchema: learnWordInputSchema,
  outputSchema: z.object({ images: z.array(wordImageSchema) }),
})

/** Code a quiz question asks about, shown as a highlighted block under the question instead of inline. */
const quizCodeSchema = z
  .object({
    language: z.string().meta({ description: 'Language for highlighting, e.g. js, ts, python, sql' }),
    source: z.string().meta({ description: 'The code, with real line breaks and indentation, without Markdown fences' }),
  })
  .optional()
  .meta({ description: 'Code the question is about (a snippet to trace, debug or predict the output of). Put it here, one statement per line, and keep it out of question, which then just asks about "this code".' })

export const quizInputSchema = z.object({
  title: z.string().meta({ description: 'Instruction shown above every question, in the reply language, e.g. "Fill in the blank with the present perfect:"' }),
  questions: z
    .array(
      z.object({
        question: z.string().meta({ description: 'The question; use ___ for a blank.' }),
        code: quizCodeSchema,
        options: z
          .array(
            z.object({
              text: z.string(),
              explanation: z.string().meta({ description: 'One sentence explaining why this option is right or wrong, written in the reply language from the system prompt (not the language being practised).' }),
            }),
          )
          .min(2)
          .max(4),
        answer: z.number().int().min(0).meta({ description: 'Index of the correct option.' }),
        hint: z.string().optional().meta({ description: 'Short hint that does not give the answer away, written in the reply language.' }),
      }),
    )
    .min(1)
    .max(10),
})

export type QuizInput = z.infer<typeof quizInputSchema>

export const showQuizDef = toolDefinition({
  name: 'show_quiz',
  description:
    'Display an interactive multiple-choice quiz card: one question at a time with prev/next navigation, a hint button, instant grading when the user picks an option (wrong pick in red, right answer in green, each with its explanation), and a score summary at the end. Use it for any multiple-choice practice (grammar, vocabulary, reading...). The card grades on its own, so do not reveal answers in the text reply; just introduce the quiz in one sentence. If it returns issues, call it again with the fixed quiz.',
  inputSchema: quizInputSchema,
  outputSchema: z.object({ shown: z.boolean(), issues: z.array(z.string()) }),
})

export const roleplayInputSchema = z.object({
  scenario: z.string().meta({ description: 'Short scenario name in the reply language, e.g. "Phỏng vấn xin việc"' }),
  intro: z
    .string()
    .optional()
    .meta({ description: 'First turn only: 1-2 sentences in the reply language explaining the setup and how feedback works. Omit on later turns.' }),
  character: z.object({
    name: z.string().meta({ description: 'Character name or title, e.g. "Sarah" or "Interviewer"' }),
    role: z.string().meta({ description: 'Short role in English, e.g. "HR Manager at Acme"' }),
    voice: z.enum(['female', 'male']).meta({ description: 'Voice used to read the line aloud' }),
  }),
  line: z.string().meta({ description: 'What the character says this turn, in English, plain text, 1-3 short sentences' }),
  feedback: z
    .array(
      z.object({
        original: z.string().meta({ description: "The user's phrase exactly as they wrote it" }),
        corrected: z.string().meta({ description: 'The natural, correct English version' }),
        note: z.string().meta({ description: 'One short reason, in the reply language' }),
      }),
    )
    .max(3)
    .optional()
    .meta({ description: "Corrections for the user's previous message; omit when it was already correct." }),
  suggestions: z
    .array(z.string())
    .min(2)
    .max(3)
    .meta({ description: '2-3 sample English replies the user could give, varied in level' }),
})
export type RoleplayInput = z.infer<typeof roleplayInputSchema>

export const roleplayTurnDef = toolDefinition({
  name: 'roleplay_turn',
  description:
    "Display one turn of an English role-play conversation (job interview, ordering food, travel...) as a character card: the character's line with a listen button, corrections for the user's previous message, and sample replies the user can reveal. Call it once per turn for the whole role-play. The card is the reply, so do not write any text next to it.",
  inputSchema: roleplayInputSchema,
  outputSchema: z.object({ shown: z.boolean() }),
})

export const drawingBoardInputSchema = z.object({
  prompt: z
    .string()
    .meta({ description: 'One short line in the reply language shown above the board, e.g. "Vẽ gì đó đi, tôi sẽ đoán!" or "Vẽ thêm chi tiết nhé"' }),
})
export type DrawingBoardInput = z.infer<typeof drawingBoardInputSchema>

export const showDrawingBoardDef = toolDefinition({
  name: 'show_drawing_board',
  description:
    'Display a drawing board (pen colors, sizes, eraser, undo) where the user sketches something and sends it back to you as an image. Use it when the user wants to draw for you to guess (Pictionary) or wants to show you a sketch. The board is the reply, so do not write any text next to it.',
  inputSchema: drawingBoardInputSchema,
  outputSchema: z.object({ shown: z.boolean() }),
})

const indexSchema = z.number().int().meta({ description: 'Index into items, from 0' })

export const visualSchema = z.object({
  kind: z
    .enum(['bars', 'cells'])
    .meta({ description: 'bars: numbers drawn as bars of matching height (prices, heights, values over time); cells: a row of boxes for any array or string (two pointers, sliding window, sorting, binary search).' }),
  items: z
    .array(z.string())
    .min(2)
    .max(12)
    .meta({ description: 'The values in order, as short text; numbers only for bars, e.g. ["7", "1", "5"]' }),
  steps: z
    .array(
      z.object({
        say: z.string().meta({ description: 'A few words copied exactly from this slide\'s narration; the step plays when the narrator reaches them.' }),
        marks: z
          .array(z.object({ name: z.string().meta({ description: '1-2 words: i, left, min, Mua' }), at: indexSchema }))
          .optional()
          .meta({ description: 'Named labels under items. Giving a name a new index later slides it there. At most 3 names per slide.' }),
        highlight: z.array(indexSchema).optional().meta({ description: 'Items in focus during this step; the rest dim.' }),
        window: z.object({ from: indexSchema, to: indexSchema }).optional().meta({ description: 'A bracket around items from..to during this step.' }),
        arrow: z.object({ from: indexSchema, to: indexSchema }).optional().meta({ description: 'A curved arrow between two items during this step.' }),
        set: z.array(z.object({ at: indexSchema, value: z.string() })).optional().meta({ description: 'New values for items; they stay.' }),
        swap: z.array(indexSchema).length(2).optional().meta({ description: 'Two positions whose items trade places; they stay swapped.' }),
        note: z.string().optional().meta({ description: 'A short result shown large, like "Lời: 5"; it stays until another note, "" clears it.' }),
        done: z.array(indexSchema).optional().meta({ description: 'Positions that are finished (sorted, visited); they stay.' }),
      }),
    )
    .min(1)
    .max(10)
    .meta({ description: 'What changes, in narration order. highlight, window and arrow last only for their step; marks, values, order, note and done stay until changed.' }),
})
export type Visual = z.infer<typeof visualSchema>

export const explainDeckInputSchema = z.object({
  title: z.string().meta({ description: 'Lesson title in the reply language, e.g. "React useEffect hoạt động thế nào"' }),
  slides: z
    .array(
      z.object({
        layout: z
          .enum(['content', 'title', 'cards', 'quiz', 'visual'])
          .optional()
          .meta({ description: 'How the slide is laid out: content (default, shows content), title (a big centered heading with content as a one-line subtitle), cards (shows cards), quiz (shows quiz and waits for the viewer to answer), visual (animates visual step by step with the narration).' }),
        title: z.string().meta({ description: 'Short slide heading in the reply language' }),
        content: z
          .string()
          .optional()
          .meta({ description: 'For the content layout, what the slide shows, as Markdown: a few short bullets (at most about 12 words each), one small fenced code block, a ```mermaid diagram that builds as it is narrated, a ```svg drawing whose <g data-say> groups draw in as the narration reaches them, or a small table. No paragraphs. In mermaid, write each edge on a single line with its source, arrow, optional |label| and target together. For the title layout, a one-line subtitle.' }),
        cards: z
          .array(
            z.object({
              emoji: z.string().meta({ description: 'One emoji for the idea' }),
              title: z.string().meta({ description: 'A 1-3 word name for the idea' }),
              text: z.string().meta({ description: 'One short sentence' }),
            }),
          )
          .min(2)
          .max(4)
          .optional()
          .meta({ description: 'For the cards layout: 2-4 parallel ideas shown side by side; each appears when the narration reaches it.' }),
        quiz: z
          .object({
            question: z.string(),
            code: quizCodeSchema,
            options: z.array(z.string()).min(2).max(4),
            answer: z.number().int().meta({ description: 'Index of the correct option, from 0' }),
            explanation: z
              .string()
              .meta({ description: 'Read aloud and shown once the viewer answers: 2-3 spoken sentences on why the right option is right and why the most tempting wrong one is not, plain text.' }),
          })
          .optional()
          .meta({ description: 'For the quiz layout: one multiple-choice question about what the lesson just covered.' }),
        visual: visualSchema
          .optional()
          .meta({ description: 'For the visual layout: an array or a row of values that changes as the narration goes, for algorithms and data that move step by step.' }),
        narration: z
          .string()
          .meta({ description: 'What the narrator says while this slide is shown: 2-4 spoken sentences in the reply language, plain text without markdown, code or URLs.' }),
        pointer: z
          .array(
            z.object({
              say: z.string().meta({ description: 'A few words copied exactly from this slide\'s narration; the cursor moves when the narrator reaches them.' }),
              at: z
                .string()
                .meta({ description: 'Short text copied exactly from what the slide shows (the opening words of a bullet, a code token, a table cell, or a diagram node label; never the slide heading or mermaid source) for the cursor to point at.' }),
            }),
          )
          .max(6)
          .optional()
          .meta({ description: '1-3 cues (one per bullet or card on a slide of them; up to 6 on a diagram or table, one per node or row), in narration order, that move an on-screen cursor to the thing being talked about, like a presenter pointing.' }),
      }),
    )
    .min(2)
    .max(12),
})
export type ExplainDeckInput = z.infer<typeof explainDeckInputSchema>

export const explainDeckDef = toolDefinition({
  name: 'explain_deck',
  description:
    'Display a narrated slide lesson: slides appear as they stream in, and a player reads each slide\'s narration aloud and moves to the next slide on its own (play/pause, prev/next). Use it to explain a concept, a piece of code, a file or a link step by step. The lesson is the reply, so do not write any text next to it. If it returns issues, call it again with the whole deck fixed.',
  inputSchema: explainDeckInputSchema,
  outputSchema: z.object({ shown: z.boolean(), issues: z.array(z.string()), style: z.string().optional() }),
})

/** Names the code of show_3d_scene is called with, matching what src/lib/scene-runtime.ts passes in. */
export const SCENE_PARAMS = ['THREE', 'scene', 'camera', 'renderer', 'controls', 'onFrame', 'label', 'gui', 'addons'] as const

export const sceneInputSchema = z.object({
  title: z.string().meta({ description: 'Short name of what the scene shows, in the reply language, e.g. "Hệ Mặt Trời"' }),
  code: z
    .string()
    .meta({ description: 'The body of an async function that builds the scene with the parameters described in the tool description. Plain JavaScript, no imports.' }),
})
export type SceneInput = z.infer<typeof sceneInputSchema>

export const show3dSceneDef = toolDefinition({
  name: 'show_3d_scene',
  description: [
    'Display an interactive 3D scene built with three.js (r186) in a card the user can orbit, zoom and pan, view full screen, and download as .glb, .png or a standalone .html. Use it whenever the user wants to see, build or explore something in 3D: an object, a model, a molecule, a mechanism, a math surface, a simulation.',
    'code is the body of an async function run in a sandboxed page without network access, called with: THREE (the whole three.js namespace); scene (lit by a soft studio environment map, with a transparent background over a backdrop that follows the app theme, light or dark); camera (PerspectiveCamera); renderer (WebGLRenderer, shadows enabled); controls (OrbitControls with damping); onFrame(callback) to animate, called every frame with (delta, elapsed) in seconds; label(text), which returns a CSS2DObject text tag to add to any object; gui(), which returns a lil-gui panel for sliders, toggles and color pickers; addons ({ RoundedBoxGeometry, ConvexGeometry, ParametricGeometry, BufferGeometryUtils, SimplexNoise }).',
    'Do not import anything, redeclare those names, create a renderer or scene, start an animation loop, use THREE.Clock or load files or URLs: build geometry, colors and textures (CanvasTexture, DataTexture) in code. Leave scene.background unset so the backdrop matches the theme; for a floor, use a plane with THREE.ShadowMaterial (opacity about 0.25), which only shows shadows and suits either theme. Unless the code moves the camera, the view frames everything in the scene; set userData.fit = false on large backdrops (ground, sky, star fields) to leave them out of the framing. The viewer has its own toggles for a floor grid, the labels and pausing onFrame motion, so add no GridHelper unless a grid is part of the subject.',
    'The card is the reply, so do not write any text next to it. If it returns issues, call it again with the fixed code.',
  ].join(' '),
  inputSchema: sceneInputSchema,
  outputSchema: z.object({ shown: z.boolean(), issues: z.array(z.string()) }),
})
