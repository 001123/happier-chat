import * as React from 'react'
import type { CustomRenderer, CustomRendererProps } from 'streamdown'

import { Skeleton } from '@/components/ui/skeleton'
import { markDrawable } from '@/lib/draw-in'
import { defineMessages, useMessages } from '@/lib/i18n'
import { sanitizeSvg } from '@/lib/sanitize-svg'

const messages = defineMessages({
  vi: { broken: 'Không vẽ được hình này.' },
  en: { broken: 'This drawing could not be shown.' },
})

// The shapes inside a build step that draw in as the narration reaches it.
const DRAWN = '[data-build] :is(path, line, polyline, polygon, circle, ellipse, rect)'

/**
 * A lesson slide's ```svg drawing. It is sanitized in the browser, so the server and the first render show a
 * placeholder, and so does a drawing still streaming. Its <g data-say> groups become build steps, which the lesson
 * reveals and draws in as the narrator says their words.
 */
function SlideSvg({ code, isIncomplete }: CustomRendererProps) {
  const t = useMessages(messages)
  const id = `svg${React.useId().replace(/[^\w-]/g, '')}`
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const markup = React.useMemo(() => (mounted && !isIncomplete ? sanitizeSvg(code, id) : null), [mounted, isIncomplete, code, id])
  const ref = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    ref.current?.querySelectorAll(DRAWN).forEach(markDrawable)
  }, [markup])

  if (markup === null) return <Skeleton className="my-2 aspect-video w-full rounded-xl" />
  if (!markup) {
    return (
      <p className="my-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {t.broken}
      </p>
    )
  }
  return (
    <div
      ref={ref}
      className="slide-svg my-2 flex justify-center [&_svg]:h-auto [&_svg]:max-h-[22rem] [&_svg]:w-full"
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  )
}

export const svgRenderer: CustomRenderer = { language: 'svg', component: SlideSvg }
