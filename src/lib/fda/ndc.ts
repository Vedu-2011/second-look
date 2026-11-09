// NDC (National Drug Code) parsing. Labels print NDCs in many layouts: 4-4-2, 5-3-2, 5-4-1 (10 digits with dashes),
// 5-4-2 (11 digits), with or without dashes, sometimes without the package part. RxNav accepts an 11-digit NDC or a
// 9-digit product code (5-digit labeler + 4-digit product), but NOT a bare 10-digit number, which is ambiguous.
//
// We always look products up by the 9-digit product code: every package size of the same product shares it.

export type NdcCandidate = {
  /** 5-digit labeler + 4-digit product, e.g. "005730160". What we send to RxNav. */
  productCode: string;
  /** "00573-0160" */
  display: string;
};

const pad = (s: string, n: number) => s.padStart(n, "0");

function candidate(labeler: string, product: string): NdcCandidate | null {
  if (labeler.length > 5 || product.length > 4) return null;
  const l = pad(labeler, 5);
  const p = pad(product, 4);
  return { productCode: `${l}${p}`, display: `${l}-${p}` };
}

/**
 * Every product code this input could mean, most likely first. Empty when it can't be an NDC.
 * Dashed input is unambiguous; a bare 10-digit number can mean three different products, so we try each.
 */
export function ndcCandidates(input: string | null | undefined): NdcCandidate[] {
  if (!input) return [];
  const cleaned = input.trim().replace(/^ndc[:#\s]*/i, "").replace(/[\s‐-―–—]+/g, "-");
  if (!/^[\d-]+$/.test(cleaned)) return [];
  const parts = cleaned.split("-").filter(Boolean);
  const out: (NdcCandidate | null)[] = [];

  if (parts.length === 3) {
    const [l, p, k] = parts;
    const layout = `${l.length}-${p.length}-${k.length}`;
    if (["4-4-2", "5-3-2", "5-4-1", "5-4-2"].includes(layout)) out.push(candidate(l, p));
  } else if (parts.length === 2) {
    const [l, p] = parts;
    const layout = `${l.length}-${p.length}`;
    if (["4-4", "5-3", "5-4"].includes(layout)) out.push(candidate(l, p));
  } else if (parts.length === 1) {
    const d = parts[0];
    if (d.length === 11) out.push(candidate(d.slice(0, 5), d.slice(5, 9)));
    else if (d.length === 10) {
      out.push(candidate(d.slice(0, 4), d.slice(4, 8))); // 4-4-2 (most common on OTC labels)
      out.push(candidate(d.slice(0, 5), d.slice(5, 8))); // 5-3-2
      out.push(candidate(d.slice(0, 5), d.slice(5, 9))); // 5-4-1
    } else if (d.length === 9) out.push(candidate(d.slice(0, 5), d.slice(5, 9)));
    else if (d.length === 8) {
      out.push(candidate(d.slice(0, 4), d.slice(4, 8))); // 4-4 product code
      out.push(candidate(d.slice(0, 5), d.slice(5, 8))); // 5-3
    }
  }

  const seen = new Set<string>();
  return out.filter((c): c is NdcCandidate => {
    if (!c || seen.has(c.productCode)) return false;
    seen.add(c.productCode);
    return true;
  });
}

/** RxNav's ndc9 ("0573-0160", "11673-484") → our 9-digit product code ("005730160", "116730484"). */
export function productCodeOf(ndc9: string): string | null {
  return ndcCandidates(ndc9)[0]?.productCode ?? null;
}

export function isPlausibleNdc(input: string | null | undefined) {
  return ndcCandidates(input).length > 0;
}
