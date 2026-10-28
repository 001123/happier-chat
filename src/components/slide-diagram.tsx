import * as React from 'react'
import type { CustomRenderer, CustomRendererProps } from 'streamdown'

import { Skeleton } from '@/components/ui/skeleton'
import { useHydrated } from '@/lib/hydrated'
import { defineMessages, useMessages } from '@/lib/i18n'
import { renderDiagram, renderedDiagram } from '@/lib/pele-mermaid'

const messages = defineMessages({
  vi: { broken: 'Không vẽ được sơ đồ này.' },
  en: { broken: 'This diagram could not be shown.' },
})

/**
 * A lesson slide's ```mermaid diagram, drawn without the chat's code-block chrome (label, zoom and download). The
 * lesson renders its diagrams ahead (see `preloadDiagrams`), so a slide usually shows its diagram on its first
 * frame. One still rendering, or still streaming, holds its place with a placeholder about its size and fades in
 * once drawn, instead of the slide jumping from an empty box to a spinner line to the diagram.
 */
function SlideDiagram({ code, isIncomplete }: CustomRendererProps) {
  const t = useMessages(messages)
  const hydrated = useHydrated()
  const source = hydrated && !isIncomplete ? code : ''
  const ready = source ? renderedDiagram(source) : undefined
  const [result, setResult] = React.useState<{ source: string; svg?: string; error?: string } | null>(null)
  // Whether the viewer saw the placeholder: only then does the diagram fade in.
  const waited = React.useRef(false)
  React.useEffect(() => {
    if (!source || ready) return
    let cancelled = false
    renderDiagram(source).then(
      (svg) => !cancelled && setResult({ source, svg }),
      (error: unknown) => !cancelled && setResult({ source, error: error instanceof Error ? error.message : String(error) }),
    )
    return () => {
      cancelled = true
    }
  }, [source, ready])

  const shown = ready ?? (result?.source === source ? result : undefined)
  if (!shown) {
    waited.current = true
    return <Skeleton aria-hidden className="my-2 aspect-[16/7] max-h-[22rem] w-full rounded-xl" />
  }
  if (shown.svg === undefined) {
    return (
      <p className="my-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground" title={shown.error}>
        {t.broken}
      </p>
    )
  }
  return (
    <div
      className="slide-diagram my-2 flex justify-center [&_svg]:h-auto [&_svg]:max-h-[22rem] [&_svg]:max-w-full"
      data-fade-in={waited.current || undefined}
      role="img"
      dangerouslySetInnerHTML={{ __html: shown.svg }}
    />
  )
}

export const diagramRenderer: CustomRenderer = { language: 'mermaid', component: SlideDiagram }
