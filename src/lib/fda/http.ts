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
  return err instanceof FdaError ? FRIENDLY[err.code] : "Something went wrong looking up FDA records. Please try again.";
}

export async function fetchJson(
  url: string,
  { timeoutMs = 8000, retries = 1, fetchImpl = fetch }: { timeoutMs?: number; retries?: number; fetchImpl?: typeof fetch } = {},
): Promise<unknown> {
  let last: FdaError | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    let res: Response;
    try {
      res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), headers: { accept: "application/json" } });
    } catch (err) {
      const name = (err as { name?: string })?.name;
      const code = name === "TimeoutError" || name === "AbortError" ? "timeout" : "network";
      last = new FdaError(code, String(err), url);
      continue; // timeouts and dropped connections get one retry
    }
    if (res.status >= 500 || res.status === 429) {
      last = new FdaError("bad_response", `HTTP ${res.status}`, url);
      continue; // server trouble gets one retry
    }
    if (!res.ok) throw new FdaError("bad_response", `HTTP ${res.status}`, url);
    try {
      return await res.json();
    } catch {
      throw new FdaError("bad_response", "Invalid JSON", url);
    }
  }
  throw last ?? new FdaError("network", "Unknown error", url);
}
