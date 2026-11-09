import { connection, type NextRequest } from "next/server";
import { cacheStats } from "@/lib/fda/cache";
import { colorNames, shapeName } from "@/lib/fda/codes";
import { labelMeta } from "@/lib/fda/dailymed";
import { friendlyFdaMessage } from "@/lib/fda/http";
import { isPlausibleNdc } from "@/lib/fda/ndc";
import { approximateTerm, drugGroup, drugTerm, lookupNdc } from "@/lib/fda/rxnav";
import type { Product } from "@/lib/fda/types";
import { displayImprint } from "@/lib/match/imprint";

// Debug lookups: GET /api/lookup?ndc=0573-0160 or ?q=ibuprofen 200 mg tablet
function summary(p: Product) {
  return {
    ndc: p.ndc9,
    rxcui: p.rxcui,
    title: p.title ?? null,
    brand: p.brand ?? null,
    labeler: p.labeler ?? null,
    imprint: displayImprint(p.imprintRaw) || null,
    color: colorNames(p.colorCodes),
    shape: shapeName(p.shapeCode),
    sizeMm: p.sizeMm,
    scored: p.scored,
    active: p.active,
    setId: p.setId ?? null,
  };
}

export async function GET(request: NextRequest) {
  await connection();
  const ndc = request.nextUrl.searchParams.get("ndc")?.trim();
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const start = performance.now();
  const before = { ...cacheStats };
  const cache = () => ({
    memoryHits: cacheStats.memoryHits - before.memoryHits,
    redisHits: cacheStats.redisHits - before.redisHits,
    misses: cacheStats.misses - before.misses,
  });

  if (!ndc && !q) {
    return Response.json({ error: "Add ?ndc=0573-0160 or ?q=ibuprofen 200 mg tablet." }, { status: 400 });
  }
  if (ndc && !isPlausibleNdc(ndc)) {
    return Response.json(
      { error: "That doesn't look like an NDC. It's usually 10 or 11 digits, like 0573-0160-17." },
      { status: 400 },
    );
  }

  try {
    if (ndc) {
      const { product, ambiguous } = await lookupNdc(ndc);
      if (ambiguous) {
        return Response.json(
          { error: `NDC ${ndc} could be more than one product. Type it with the dashes, as printed on the label.` },
          { status: 400 },
        );
      }
      if (!product) {
        return Response.json({ error: `The FDA has no product with NDC ${ndc}.` }, { status: 404 });
      }
      const label = product.setId ? await labelMeta(product.setId).catch(() => null) : null;
      return Response.json({ product: summary(product), label, ms: Math.round(performance.now() - start), cache: cache() });
    }

    const concept = await approximateTerm(drugTerm({ drugName: q }) ?? q!);
    if (!concept) return Response.json({ error: `We couldn't find "${q}" in RxNorm.` }, { status: 404 });
    const group = await drugGroup(concept.rxcui);
    const products = group?.products ?? [];
    return Response.json({
      concept,
      generic: group?.generic ?? null,
      brands: group?.members.filter((m) => m.tty === "SBD").map((m) => m.name) ?? [],
      productCount: products.length,
      activeCount: products.filter((p) => p.active).length,
      products: products.slice(0, 40).map(summary),
      ms: Math.round(performance.now() - start),
      cache: cache(),
    });
  } catch (err) {
    return Response.json({ error: friendlyFdaMessage(err) }, { status: 502 });
  }
}
