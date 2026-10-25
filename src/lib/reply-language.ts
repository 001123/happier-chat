import { LOCALE_PROMPT_NAMES, isLocale } from '@/lib/i18n'
import type { Locale } from '@/lib/i18n'

/** Keeps the known locales from an untrusted list (e.g. `forwardedProps`), de-duplicated, in order. */
export function parseReplyLanguages(value: unknown): Array<Locale> {
  return Array.isArray(value) ? [...new Set(value.filter(isLocale))] : []
}

/**
 * The system-prompt rule for which language to reply in: one checked language is always used,
 * several mean "match the user among these", none means "match the user".
 */
export function replyLanguageInstruction(languages: ReadonlyArray<Locale>) {
  return `${replyLanguageRule(languages)} ${TOOL_TEXT_RULE}`
}

// Models tend to switch to the topic's language inside tool arguments (e.g. English quiz explanations).
const TOOL_TEXT_RULE =
  'This reply language also applies to text you put in tool calls that the user reads (titles, explanations, hints, UI labels), but not to the material being taught (e.g. the English sentences of an English quiz).'

function replyLanguageRule(languages: ReadonlyArray<Locale>) {
  const names = languages.map((l) => LOCALE_PROMPT_NAMES[l])
  if (names.length === 0) return 'Reply in the same language the user writes in.'
  if (names.length === 1) return `Always reply in ${names[0]}, whatever language the user writes in.`
  return `Reply in the language the user writes in if it is one of: ${names.join(', ')}. Otherwise reply in ${names[0]}.`
}
