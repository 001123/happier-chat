import type { DiagramPlugin } from 'streamdown'

const MAX_DIAGRAM_WIDTH = 640

async function renderPele(id: string, source: string) {
  const { renderAsync } = await import('pele/lazy')
  await document.fonts.ready
  const { svg } = await renderAsync(source, {
    idPrefix: id,
    fontFamily: "'Geist Variable', sans-serif",
    fontSize: 14,
    maxWidth: Math.min(MAX_DIAGRAM_WIDTH, window.innerWidth - 64),
    padding: 16,
  })
  return svg
}

export const peleMermaid: DiagramPlugin = {
  name: 'mermaid',
  type: 'diagram',
  language: 'mermaid',
  getMermaid: () => ({
    initialize() {},
    async render(id, source) {
      return { svg: await renderPele(id, source) }
    },
  }),
}

// Lesson diagrams, rendered once per source and width: a slide rendered ahead shows its diagram on its first frame.
const rendered = new Map<string, { svg?: string; error?: string; promise: Promise<string> }>()
// The source as written, without the blank lines a fence leaves around it.
const cacheKey = (source: string) => `${Math.min(MAX_DIAGRAM_WIDTH, window.innerWidth - 64)}\n${source.trim()}`

/** A diagram already rendered, or its error, without waiting; undefined while it renders or before it is asked for. */
export function renderedDiagram(source: string) {
  const entry = rendered.get(cacheKey(source))
  return entry && (entry.svg !== undefined || entry.error !== undefined) ? entry : undefined
}

/**
 * Renders a lesson diagram, or joins the render already running for it. Ids come from the source, so the same
 * diagram rendered ahead and shown later keeps its markers and gradients pointing at its own elements.
 */
export function renderDiagram(source: string) {
  const key = cacheKey(source)
  const cached = rendered.get(key)
  if (cached) return cached.promise
  source = source.trim()
  const hash = Array.from(source).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) | 0, 0)
  const entry: { svg?: string; error?: string; promise: Promise<string> } = {
    promise: renderPele(`d${Math.abs(hash).toString(36)}`, source).then(
      (svg) => (entry.svg = svg),
      (error: unknown) => {
        entry.error = error instanceof Error ? error.message : String(error)
        throw error
      },
    ),
  }
  // A failed render is not cached for good: the next ask tries again.
  entry.promise.catch(() => setTimeout(() => rendered.delete(key), 0))
  rendered.set(key, entry)
  return entry.promise
}

const MERMAID_BLOCK = /```mermaid[^\n]*\n([\s\S]*?)```/g

/** Renders the diagrams in some slide Markdown ahead of time, so they are ready when their slide shows. */
export function preloadDiagrams(markdown: string | undefined) {
  if (!markdown || typeof window === 'undefined') return
  for (const [, source] of markdown.matchAll(MERMAID_BLOCK)) renderDiagram(source!).catch(() => {})
}
