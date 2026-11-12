// Fetching from the free NLM/FDA APIs: 8 s timeout, one retry, and errors a person can read.

export type FdaErrorCode = "timeout" | "network" | "bad_response";

export class FdaError extends Error {
  constructor(
    public code: FdaErrorCode,
    message: string,
    public url: string,
  ) {
    super(message);
    this.name = "FdaError";
  }
}

const FRIENDLY: Record<FdaErrorCode, string> = {
  timeout: "The FDA database took too long to answer. Please try again in a moment.",
  network: "We couldn't reach the FDA database. Check your connection and try again.",
  bad_response: "The FDA database sent back something we couldn't read. Please try again in a moment.",
};

export function friendlyFdaMessage(err: unknown) {
  return err instanceof FdaError ? FRIENDLY[err.code] : "Something went wrong on our side checking this pill. Please try again.";
}

// Bound requests (including JSON body reads), not whole recursive drug-group operations: no nested-lock deadlock.
export const FDA_MAX_CONCURRENT = 4;
let active = 0;
const waiting: Array<() => void> = [];
async function withSlot<T>(work: () => Promise<T>): Promise<T> {
  if (active >= FDA_MAX_CONCURRENT) await new Promise<void>(resolve => waiting.push(resolve));
  else active++;
  try { return await work(); }
  finally { const next = waiting.shift(); if (next) next(); else active--; }
}
class RetryableFdaError extends FdaError {
  constructor(code: FdaErrorCode, message: string, url: string, public retryAfterMs = 0) { super(code, message, url); }
}
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const retryAfter = (res: Response) => {
  const value = res.headers.get("retry-after");
  if (!value) return 0;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds * 1000) : Math.max(0, Date.parse(value) - Date.now()) || 0;
};

export async function fetchJson(
  url: string,
  { timeoutMs = 8000, retries = 1, fetchImpl = fetch, sleepImpl = sleep }: { timeoutMs?: number; retries?: number; fetchImpl?: typeof fetch; sleepImpl?: (ms: number) => Promise<void> } = {},
): Promise<unknown> {
  let last: FdaError | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await withSlot(async () => {
        let res: Response;
        try {
          res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
        } catch (err) {
          const name = (err as { name?: string })?.name;
          throw new RetryableFdaError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network", String(err), url);
        }
        if (res.status >= 500 || res.status === 429) {
          // Release the slot before waiting; cancel unneeded response bodies so they don't hold sockets open.
          await res.body?.cancel().catch(() => {});
          throw new RetryableFdaError("bad_response", `HTTP ${res.status}`, url, retryAfter(res));
        }
        if (!res.ok) {
          await res.body?.cancel().catch(() => {});
          throw new FdaError("bad_response", `HTTP ${res.status}`, url);
        }
        try { return await res.json(); }
        catch { throw new FdaError("bad_response", "Invalid JSON", url); }
      });
    } catch (err) {
      if (!(err instanceof RetryableFdaError)) throw err;
      last = err;
      if (attempt < retries) {
        const delay = Math.max(250 * 2 ** attempt, err.retryAfterMs);
        // A longer server cooldown belongs to a later user attempt; never retry earlier than Retry-After.
        if (delay > 2000) throw err;
        await sleepImpl(delay);
      }
    }
  }
  throw last ?? new FdaError("network", "Unknown error", url);
}
