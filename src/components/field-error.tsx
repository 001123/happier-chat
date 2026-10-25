import { firstError } from '@/lib/form'

export function FieldError({ errors }: { errors: ReadonlyArray<unknown> }) {
  const message = firstError(errors)
  return message ? (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null
}
