export { cn } from "cn"

/** A readable message from a thrown value, unwrapping Zod issue lists sent back by server functions. */
export function errorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  try {
    const issues = JSON.parse(message) as Array<{ message?: string }>
    if (Array.isArray(issues) && issues[0]?.message) return issues[0].message
  } catch {}
  return message
}
