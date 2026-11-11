import type { Product } from './fda/types';
import { tokenizeImprint } from './match/imprint';

export type ListingEvidence = { products: Product[]; sellers: string[]; unknownSellerCount: number };
const lookKey = (p: Product) => [tokenizeImprint(p.imprintRaw).sort().join('|'), [...p.colorCodes].sort().join('|'), p.shapeCode ?? ''].join('::');
/** Presentation only: all FDA products sharing the selected record's complete imprint/color/shape.
 * No new candidate can influence the verdict. Sizes are intentionally not compared. */
export function listingEvidence(reference: Product | null, products: Product[], labelCode?: string): ListingEvidence | null {
  if (!reference) return null;
  const seen = new Set<string>();
  const matches = [reference, ...products].filter(p => lookKey(p) === lookKey(reference) && !seen.has(p.productCode) && Boolean(seen.add(p.productCode)));
  matches.sort((a,b) => Number(b.productCode === labelCode) - Number(a.productCode === labelCode) || Number(b.active) - Number(a.active) || (a.labeler ?? '').localeCompare(b.labeler ?? '') || a.productCode.localeCompare(b.productCode));
  const sellerKeys = new Set<string>();
  const sellers = matches.flatMap(p => {
    const name=p.labeler?.trim().replace(/\s+/g,' ');
    if(!name || sellerKeys.has(name.toLowerCase()))return [];
    sellerKeys.add(name.toLowerCase());return [name];
  });
  return {products:matches,sellers,unknownSellerCount:matches.filter(p=>!p.labeler?.trim()).length};
}
export function listingSummary(e: ListingEvidence, identified = false) {
  const count=e.products.length;
  const lead=identified ? `Listed in ${count} FDA-listed ${count===1?'version':'versions'}` : `Matches ${count} FDA-listed ${count===1?'version':'versions'}`;
  const names=e.sellers.slice(0,3).join(', ');
  const rest=e.sellers.length-3;
  return `${lead}${names ? `, sold by ${names}${rest>0?` and ${rest} others`:''}` : '; sellers not listed'}.${e.unknownSellerCount ? ' Some records do not list a seller.' : ''}`;
}
