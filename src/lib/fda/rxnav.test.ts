// RxNav client logic that doesn't need the network: building search terms, and refusing to guess an ambiguous NDC.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/redis", async (orig) => ({ ...(await orig<typeof import("@/lib/redis")>()), getRedis: () => null }));

const { drugTerm, lookupNdc } = await import("./rxnav");
const { clearMemoryCache } = await import("./cache");

describe("drugTerm", () => {
  it("adds 'oral tablet' for plain tablets, which RxNorm needs to find the product", () => {
    expect(drugTerm({ drugName: "Ibuprofen", strength: "200 mg", form: "tablet" })).toBe("Ibuprofen 200 mg oral tablet");
    expect(drugTerm({ drugName: "Ibuprofen", strength: "200 mg" })).toBe("Ibuprofen 200 mg oral tablet");
    expect(drugTerm({ drugName: "Amoxicillin", strength: "500 mg", form: "Capsule" })).toBe("Amoxicillin 500 mg oral capsule");
  });
  it("keeps any other form as the label says it", () => {
    expect(drugTerm({ drugName: "Ibuprofen", strength: "100 mg", form: "Chewable Tablet" })).toBe("Ibuprofen 100 mg chewable tablet");
    expect(drugTerm({ drugName: "Ibuprofen", strength: "100 mg/5 mL", form: "oral suspension" })).toBe("Ibuprofen 100 mg/5 mL oral suspension");
  });
  it("needs a name", () => {
    expect(drugTerm({ drugName: " " })).toBeNull();
  });
});

const product = (ndc9: string) => ({
  ndcPropertyList: { ndcProperty: [{ ndc9, rxcui: "310965", propertyConceptList: { propertyConcept: [{ propName: "IMPRINT_CODE", propValue: "I2" }] } }] },
});

describe("lookupNdc", () => {
  beforeEach(() => clearMemoryCache());
  afterEach(() => vi.unstubAllGlobals());

  const serve = (known: Record<string, string>) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const id = new URL(url).searchParams.get("id") ?? "";
        if (url.includes("/properties.json")) return new Response(JSON.stringify({ properties: { rxcui: "310965", name: "ibuprofen 200 MG Oral Tablet", tty: "SCD" } }));
        return new Response(JSON.stringify(known[id] ? product(known[id]) : {}));
      }),
    );

  it("finds the one real product an undashed NDC can be", async () => {
    serve({ "005730160": "0573-0160" });
    const r = await lookupNdc("0573016017");
    expect(r.ambiguous).toBe(false);
    expect(r.product?.ndc9).toBe("0573-0160");
    expect(r.product?.title).toBe("Ibuprofen 200 mg");
  });

  it("won't guess when two readings are both real products", async () => {
    serve({ "005730160": "0573-0160", "057300160": "05730-160" });
    expect(await lookupNdc("0573016017")).toEqual({ product: null, ambiguous: true });
  });

  it("says not found (not ambiguous) when nothing matches", async () => {
    serve({});
    expect(await lookupNdc("0573-0160")).toEqual({ product: null, ambiguous: false });
  });
});
