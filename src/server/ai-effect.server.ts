import { AIError } from '@tanstack/ai-effect'
import { Effect, Stream } from 'effect'

/** Fails with `AIError` when `run` throws, like every `@tanstack/ai-effect` call does. */
export const tryAI = <A>(run: () => A) =>
  Effect.try({
    try: run,
    catch: (cause) => new AIError({ message: cause instanceof Error ? cause.message : String(cause), cause }),
  })

/** Completes once `signal` aborts. */
const aborted = (signal: AbortSignal) =>
  Effect.callback<void>((resume) => {
    if (signal.aborted) return resume(Effect.void)
    const onAbort = () => resume(Effect.void)
    signal.addEventListener('abort', onAbort, { once: true })
    return Effect.sync(() => signal.removeEventListener('abort', onAbort))
  })

/**
 * An async iterable for TanStack AI's response helpers that ends when `signal` aborts. Ending the stream
 * aborts the provider request behind it, so a closed tab stops the generation.
 */
export const toIterable = <A, E>(stream: Stream.Stream<A, E>, signal: AbortSignal) =>
  Stream.toAsyncIterable(Stream.interruptWhen(stream, aborted(signal)))

/**
 * Runs a route program. The request's signal interrupts it, which aborts the provider request;
 * an interrupted run answers 499.
 */
export const runRoute = (program: Effect.Effect<Response>, request: Request) =>
  Effect.runPromise(program, { signal: request.signal }).catch((error: unknown) => {
    if (request.signal.aborted) return new Response(null, { status: 499 })
    throw error
  })
