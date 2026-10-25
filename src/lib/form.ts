/** The first validation message of a TanStack Form field; Standard Schema errors arrive as issue objects. */
export function firstError(errors: ReadonlyArray<unknown>) {
  const error = errors[0]
  if (!error) return undefined
  return typeof error === 'string' ? error : (error as { message?: string }).message
}
