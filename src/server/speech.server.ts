import { decrypt, encrypt } from './crypto.server'
import { getDb } from './db.server'
import { keyHint } from './providers.server'

/** The server's Gemini key for speech, used by everyone who has not saved their own. */
const serverGeminiKey = () => process.env.GEMINI_API_KEY_TTS_FREE?.trim() ?? ''

function userGeminiKey(userId: string) {
  const row = getDb().prepare('select gemini_key_enc from speech_keys where user_id = ?').get(userId) as
    | { gemini_key_enc: string }
    | undefined
  return row ? decrypt(row.gemini_key_enc) : ''
}

/** The Gemini key to synthesize speech with for this user: their own, else the server's, else empty. */
export function geminiSpeechKey(userId: string) {
  return userGeminiKey(userId) || serverGeminiKey()
}

/** What the voice settings show: never the key itself, only a hint and where it comes from. */
export function speechKeyView(userId: string) {
  const own = userGeminiKey(userId)
  if (own) return { source: 'user' as const, keyHint: keyHint(own) }
  return { source: serverGeminiKey() ? ('server' as const) : ('none' as const), keyHint: '' }
}

/** Saves the user's own key, or with null removes it so the server's key is used again. */
export function saveGeminiSpeechKey(userId: string, apiKey: string | null) {
  const db = getDb()
  if (!apiKey) db.prepare('delete from speech_keys where user_id = ?').run(userId)
  else {
    db.prepare(
      'insert into speech_keys (user_id, gemini_key_enc, updated_at) values (?, ?, ?) on conflict(user_id) do update set gemini_key_enc = excluded.gemini_key_enc, updated_at = excluded.updated_at',
    ).run(userId, encrypt(apiKey), Date.now())
  }
  return speechKeyView(userId)
}
