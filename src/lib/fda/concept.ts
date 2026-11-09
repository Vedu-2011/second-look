// Turning RxNorm concept names into words people use. Pure.

/** RxNorm name → plain title: "ibuprofen 200 MG Oral Tablet [Advil]" → { title: "Ibuprofen 200 mg", brand: "Advil" } */
export function describeConcept(name: string | undefined | null) {
  if (!name) return { title: undefined, brand: undefined, form: undefined };
  const brand = name.match(/\[([^\]]+)\]\s*$/)?.[1];
  const base = name.replace(/\s*\[[^\]]+\]\s*$/, "");
  const form = /capsule/i.test(base) ? "capsule" : /tablet/i.test(base) ? "tablet" : undefined;
  const title = base
    .replace(
      /\s+(?:\d+\s*HR\s+)?(?:Extended Release|Delayed Release|Oral|Chewable|Disintegrating|Sublingual|Effervescent|Buccal|Enteric Coated|Film Coated|Vaginal|Rectal|Tablet|Capsule)\b.*$/i,
      "",
    )
    .replace(/\bMG\b/g, "mg")
    .replace(/\bMCG\b/g, "mcg")
    .replace(/\bML\b/g, "mL")
    .trim();
  return { title: title ? title[0].toUpperCase() + title.slice(1) : undefined, brand, form };
}

/** How we name a product to people: "Advil (ibuprofen 200 mg)" for brands, "Ibuprofen 200 mg" for generics. */
export function productName(p: { title?: string; brand?: string } | null | undefined, fallback = "your medicine") {
  if (!p?.title) return p?.brand ?? fallback;
  if (!p.brand) return p.title;
  return `${p.brand} (${p.title[0].toLowerCase()}${p.title.slice(1)})`;
}
