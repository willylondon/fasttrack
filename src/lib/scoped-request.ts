export const REQUEST_TIMEOUT_MS = 15_000;

export type RequestScope = { account: string; generation: number };
export type PendingScopedRequest<T> = RequestScope & { promise: Promise<T>; startedAt: number };
export type ScopedRequestSlot<T> = { current: PendingScopedRequest<T> | null };

/** Share only an unfinished request in one component's account/mutation scope.
 * No completed results are cached, and a new account or mutation never reuses
 * the old request. Forced refreshes and aged mobile requests also start fresh.
 * Consumers must still reject stale or aborted responses before applying.
 */
export function coalesceScopedRequest<T>(
  slot: ScopedRequestSlot<T>,
  scope: RequestScope,
  load: () => Promise<T>,
  options?: { forceFresh?: boolean },
): Promise<T> {
  const current = slot.current;
  if (!options?.forceFresh && current?.account === scope.account && current.generation === scope.generation &&
      Date.now() - current.startedAt < REQUEST_TIMEOUT_MS) {
    return current.promise;
  }

  const pending: PendingScopedRequest<T> = {
    ...scope,
    startedAt: Date.now(),
    promise: Promise.resolve().then(load),
  };
  pending.promise = pending.promise.finally(() => {
    // An old account/generation finishing must not clear a newer request.
    if (slot.current === pending) slot.current = null;
  });
  slot.current = pending;
  return pending.promise;
}

/** A suspended mobile fetch must not keep all future resumes waiting forever. */
export async function withRequestTimeout<T>(load: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Dashboard refresh timed out. Try again when your connection returns."));
    }, REQUEST_TIMEOUT_MS);
  });
  try {
    // Racing also releases the slot if a nonconforming transport ignores abort.
    return await Promise.race([Promise.resolve().then(() => load(controller.signal)), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
