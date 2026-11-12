// runCheck end to end with fetch stubbed to serve the recorded FDA responses. No network.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import labels from "@/lib/fda/__fixtures__/dailymed-labels.json";
import index from "@/lib/fda/__fixtures__/index.json";
import { SCENARIOS } from "@/lib/fda/__fixtures__/tablet-scenarios";

vi.mock("@/lib/redis", async (orig) => ({ ...(await orig<typeof import("@/lib/redis")>()), getRedis: () => null }));

const { runCheck, resolveLabelData, runResolvedCheck } = await import("@/lib/check-service");
const { clearMemoryCache } = await import("@/lib/fda/cache");

const byUrl = new Map(Object.entries(index.files).map(([name, url]) => [url, name]));

async function fixtureFetch(input: RequestInfo | URL) {
  const url = String(input);
  const name = byUrl.get(url);
  if (name) {
    const body = (await import(`@/lib/fda/__fixtures__/${name}.json`)).default;
    return new Response(JSON.stringify(body));
  }
  const setid = new URL(url).searchParams.get("setid");
  if (url.includes("/spls.json") && setid) {
    const l = (labels as Record<string, object | null>)[setid];
    return new Response(JSON.stringify({ data: l ? [l] : [] }));
  }
  return new Response(JSON.stringify({})); // brand-name lists we didn't record: no products
}

beforeAll(() => {
  clearMemoryCache();
  vi.stubGlobal("fetch", vi.fn(fixtureFetch));
});
afterAll(() => vi.unstubAllGlobals());

describe("runCheck (recorded FDA responses)", () => {
  it.each(SCENARIOS.map((s) => [s.id, s] as const))("%s gives the expected verdict", async (_id, s) => {
    const r = await runCheck(s.label, s.pill);
    expect(r.verdict).toBe(s.expect);
    for (const e of r.evidence.filter((e) => e.setId)) expect(r.labels[e.setId!]?.publishedDate).toMatch(/^\d{4}-/);
  });

  it("names the wrong pill from the guess", async () => {
    const r = await runCheck(SCENARIOS[2].label, SCENARIOS[2].pill);
    expect(r.identifiedAs?.title).toBe("Acetaminophen 500 mg");
  });
  it("shares one label resolution and every evidence lookup across fifteen concurrent pills",async()=>{
    clearMemoryCache();vi.mocked(fetch).mockClear();
    const s=SCENARIOS[0], resolved=await resolveLabelData(s.label);
    const results=await Promise.all(Array.from({length:15},()=>runResolvedCheck(s.label,s.pill,resolved)));
    expect(results.every(r=>r.verdict===s.expect)).toBe(true);
    const urls=vi.mocked(fetch).mock.calls.map(([url])=>String(url));
    expect(urls.length).toBeGreaterThan(0);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
