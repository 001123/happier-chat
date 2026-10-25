// Chats, projects and chat settings live in localStorage, which every account on this browser shares.
// They are tagged with the user who wrote them and wiped when a different user signs in or on logout.
// Device preferences (theme, display, colors, speech) are left alone.

const OWNER_KEY = 'data-owner'
const ACCOUNT_KEYS = ['chat-threads', 'chat-projects', 'chat-reactions', 'chat-settings', 'chat-threads-sort', 'chat-archived-open']
// localStoragePersistence() default key prefix for chat transcripts.
const ACCOUNT_PREFIXES = ['tanstack-ai:']

export function clearAccountData() {
  // Mirror of chat-settings, see COMPOSER_COOKIE.
  document.cookie = 'chat_composer=; path=/; max-age=0'
  for (const key of Object.keys(localStorage)) {
    if (key === OWNER_KEY || ACCOUNT_KEYS.includes(key) || ACCOUNT_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      localStorage.removeItem(key)
    }
  }
}

/**
 * Marks the stored data as belonging to `userId`. Returns true when it belonged to someone else and was wiped;
 * the caller must then reload, since the stores keep in-memory caches of what they read.
 */
export function claimAccountData(userId: string) {
  const owner = localStorage.getItem(OWNER_KEY)
  if (owner === userId) return false
  const foreign = owner !== null
  if (foreign) clearAccountData()
  localStorage.setItem(OWNER_KEY, userId)
  return foreign
}
