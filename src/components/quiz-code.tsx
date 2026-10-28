import { Streamdown } from 'streamdown'
import { code as codePlugin } from '@streamdown/code'

const STREAMDOWN_PLUGINS = { code: codePlugin }

/** The snippet a quiz question asks about, highlighted like a code block in a reply. */
export function QuizCode({ code }: { code: { language?: string; source?: string } | undefined }) {
  const source = code?.source?.replace(/\n+$/, '')
  if (!source) return null
  // Longer than any run of backticks in the code, so the code cannot close its own fence.
  const fence = '`'.repeat(Math.max(3, ...[...source.matchAll(/`+/g)].map(([ticks]) => ticks.length + 1)))
  const language = code?.language?.trim().toLowerCase().replace(/[^\w+#-]/g, '') ?? ''
  return (
    <div className="text-sm font-normal">
      <Streamdown plugins={STREAMDOWN_PLUGINS}>{`${fence}${language}\n${source}\n${fence}`}</Streamdown>
    </div>
  )
}
