import { colorsFromCodes, compareFdaColors, normalizeColor } from "@/lib/match/color";
import { tokenizeImprint } from "@/lib/match/imprint";
import { compareShapes, normalizeShape, shapeFromCode } from "@/lib/match/shape";
import { COLOR_MIN_CONFIDENCE, SHAPE_MIN_CONFIDENCE, IMPRINT_MIN_CONFIDENCE } from "@/lib/verdict-engine";
import { describeDifferences, differencesFrom, FLOORS, oddOnesOut, referenceOf, toleranceOf } from "./lookalike";
import { PILE_COUNT_MIN_CONFIDENCE } from "./pile";
import type { BottleClump, BottleDecision, BottlePill } from "./types";

/** Never ask anyone to flip more than this many pills; past it, a fresh pour is easier. */
export const MAX_FLIP_ASKS = 3;
const CONFIRMED = new Set(["MATCH", "SAME_MEDICINE_DIFFERENT_MAKER"]);
export const isConfirmed = (p: BottlePill) => CONFIRMED.has(p.result.verdict) && !p.carried &&
  p.result.pill.imprintConfidence >= IMPRINT_MIN_CONFIDENCE && p.result.pill.pillVisible !== false && !p.result.pill.multiplePills &&
  p.result.pill.colorConfidence >= COLOR_MIN_CONFIDENCE && p.result.pill.colors.some(c => normalizeColor(c)) &&
  p.result.pill.shapeConfidence >= SHAPE_MIN_CONFIDENCE && Boolean(normalizeShape(p.result.pill.shape));
/** Extra bottle safety gate; leaves the historically benchmarked single-pill engine alone. */
function requireBottleEvidence(p: BottlePill): BottlePill {
  if (!CONFIRMED.has(p.result.verdict) || isConfirmed(p)) return p;
  return { ...p, result: { ...p.result, verdict: "UNSURE", matchedProduct: null, identifiedAs: null,
    reasons: [p.carried ? "This reading is from the first photo. Position alone cannot confirm the pill in this photo." : "We need a clear imprint, color and shape before confirming this pill in a bottle."] } };
}

/** The engine still owns every pill verdict. Appearance alone can only add a bottle warning. */
export function appearanceWarning({ result }: BottlePill): string | undefined {
  if (result.verdict !== "UNSURE" || !result.labelProduct || result.pill.pillVisible === false || result.pill.multiplePills) return;
  const p = result.pill, expected = result.labelProduct;
  const colors = p.colors.map(normalizeColor).filter((c): c is NonNullable<typeof c> => Boolean(c));
  const expectedColors = colorsFromCodes(expected.colorCodes), expectedShape = shapeFromCode(expected.shapeCode), shape = normalizeShape(p.shape);
  const colorDiffers = p.colorConfidence >= COLOR_MIN_CONFIDENCE && compareFdaColors(expected, colors) === "different";
  const shapeDiffers = p.shapeConfidence >= SHAPE_MIN_CONFIDENCE && compareShapes(expectedShape, shape) === "different";
  if (!colorDiffers && !shapeDiffers) return;
  const found = [p.colorConfidence >= COLOR_MIN_CONFIDENCE ? colors.join(" / ") : "", p.shapeConfidence >= SHAPE_MIN_CONFIDENCE ? shape : ""].filter(Boolean).join(" ");
  const label = [expectedColors.join(" / "), expectedShape].filter(Boolean).join(" ");
  return `${found || "Appearance"} vs ${label || "the label's FDA record"}`;
}

/** A blank face we could see, on a medicine whose FDA record has writing. Not a reading problem: it's face-down. */
const blankFace = ({ result }: BottlePill) =>
  result.verdict === "UNSURE" && result.pill.pillVisible !== false && !result.pill.multiplePills &&
  !tokenizeImprint(result.pill.imprintSides).length && Boolean(result.labelProduct?.imprintRaw && tokenizeImprint([result.labelProduct.imprintRaw]).length);

/**
 * Adds the photo-only facts to each pill: odd one out (any verdict) and face-down look-alikes. FDA data doesn't say
 * which face carries the writing (";" can mean "other side" or "next line"), so any record with an imprint may have
 * a blank face. A face-down pill must also look like the imprint-confirmed pills in this photo. It is never confirmed.
 */
export function annotatePills(pills: readonly BottlePill[]): BottlePill[] {
  const out = pills.map(requireBottleEvidence).map((p) => { const { odd: _odd, faceDown: _faceDown, shapeNote: _shapeNote, ...rest } = p; void _odd; void _faceDown; void _shapeNote; return { ...rest } as BottlePill; });
  const groups = oddOnesOut(out.map((p) => p.features));
  // A 2-D outline of a tilted, shiny capsule is unreliable: shape alone never flags a pill whose imprint is confirmed.
  if (groups) for (const [i, kinds] of groups.odd) {
    if (kinds.length === 1 && kinds[0] === "shape" && isConfirmed(out[i])) out[i].shapeNote = true;
    else out[i].odd = describeDifferences(kinds);
  }
  const confirmed = out.filter((p) => isConfirmed(p) && p.features && !p.odd);
  if (confirmed.length) {
    const all = out.flatMap((p) => (p.features ? [p.features] : []));
    const ref = referenceOf(confirmed.map((p) => p.features!)), tolerance = all.length >= 3 ? toleranceOf(all, ref) : FLOORS;
    for (const p of out) if (!p.odd && p.features && blankFace(p) && !differencesFrom(p.features, ref, tolerance).length) p.faceDown = true;
  }
  return out;
}

const list = (n: readonly number[]) => n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n.at(-1)}` : String(n[0]);
const pillsWord = (n: number) => (n === 1 ? "pill" : "pills");
/** What to do about circled clumps: on its own, or joined after a flip ("Flip pill 3 where it is, nudge …"). */
function nudgeText(clumps: readonly BottleClump[], joined: boolean) {
  const touching = clumps.some((c) => c.kind === "touching"), cutoff = clumps.some((c) => c.kind === "cutoff");
  if (touching && cutoff) return `${joined ? "n" : "N"}udge the circled pills apart and away from the edge`;
  if (touching) return joined ? "nudge the circled pills apart" : "Some pills are touching. Nudge the circled ones apart";
  if (clumps.every((c) => c.minor)) return joined ? "keep everything away from the edge" : "Something at the edge of the photo wasn't checked. Keep everything away from the edge";
  return joined ? "move the circled pill into the middle" : "A pill is cut off at the edge. Move the circled one into the middle";
}

/** Rough pill count for a region we couldn't read: its area over a typical pill's box. "About", never exact. */
function regionEstimate(c: BottleClump, pills: readonly BottlePill[]) {
  if (c.pile) return Math.max(0, c.pile.count - c.pile.read);
  if (c.minor) return 0;
  if (c.kind === "cutoff") return 1;
  const areas = pills.filter((p) => !p.fromPile).map((p) => p.box.width * p.box.height).sort((a, b) => a - b);
  const typical = areas[Math.floor(areas.length / 2)];
  return typical ? Math.max(2, Math.round((c.box.width * c.box.height) / typical)) : 2;
}
const pileHidden = (c: BottleClump) => Boolean(c.pile && (c.pile.mayBeHidden || c.pile.countConfidence < PILE_COUNT_MIN_CONFIDENCE || c.pile.count > c.pile.read));

export function decideBottle(pills: readonly BottlePill[], allClumps: readonly BottleClump[] = []): BottleDecision {
  pills = pills.map(requireBottleEvidence);
  // Piles we read became numbered pills; only regions nobody read stay circled ("Not read").
  const piles = allClumps.filter((c) => c.pile), clumps = allClumps.filter((c) => !c.pile);
  const mismatches = pills.filter((p) => p.result.verdict === "MISMATCH");
  const warnings = pills.filter((p) => appearanceWarning(p));
  const odd = pills.filter((p) => p.odd && p.result.verdict !== "MISMATCH");
  const matched = pills.filter(isConfirmed).length;
  const unreadable = pills.filter((p) => p.result.verdict === "UNSURE").length;
  const base = { matched, unreadable, flagged: [...new Set([...mismatches, ...odd, ...warnings].map((p) => p.number))].sort((a, b) => a - b) };
  if (mismatches.length) {
    const first = mismatches[0], name = first.result.identifiedAs?.title;
    const asks = mismatches.filter(p => !p.result.identifiedAs && !p.carried).slice(0, MAX_FLIP_ASKS).map(p => p.number);
    return { ...base, verdict: "MISMATCH", title: `Pill ${first.number} doesn't match your label.`, instruction: `${name ? `Its imprint is listed for ${name}. ` : ""}Don't take any pills from this bottle; call your pharmacy.${asks.length ? ` Flip ${pillsWord(asks.length)} ${list(asks)} only if you want to identify ${asks.length === 1 ? "it" : "them"}. The mismatch already stands.` : ""}`, asks, ...(asks.length ? { next: "flip" as const } : {}) };
  }
  // Pills we could ask to flip where they are, odd ones first: they're the most important to see.
  const oddUnread = odd.filter((p) => !isConfirmed(p)), faceDown = pills.filter((p) => p.faceDown && !p.odd);
  const otherUnread = pills.filter((p) => p.result.verdict === "UNSURE" && !p.odd && !p.faceDown);
  const needed = [...oddUnread, ...faceDown, ...otherUnread];
  const tooMany = needed.length > MAX_FLIP_ASKS;
  const asks = tooMany ? [] : needed.map((p) => p.number);
  const next: BottleDecision["next"] = tooMany ? "pour_again" : asks.length && clumps.length ? "flip_and_nudge" : asks.length ? "flip" : clumps.length ? "nudge" : undefined;
  const flipText = asks.length === 1 && oddUnread.length === 1 ? "Flip just that one" : asks.length ? `Flip ${pillsWord(asks.length)} ${list(asks)} where ${asks.length === 1 ? "it is" : "they are"}` : "";
  const toFinish = faceDown.length === needed.length && !clumps.length ? " to finish" : "";
  const ending = tooMany ? "Give the pills a gentle shake, pour them out again, and snap again."
    : flipText && clumps.length ? `${flipText}, ${nudgeText(clumps, true)}, and snap again.`
    : flipText ? `${flipText} and snap again${toFinish}.`
    : clumps.length ? `${nudgeText(clumps, false)} and snap again.` : "";
  if (odd.length) {
    const nums = odd.map((p) => p.number);
    const title = nums.length === 1 ? `Pill ${nums[0]} looks different from the others.` : `Pills ${list(nums)} look different from the others.`;
    const confirmedOdd = odd.filter(isConfirmed);
    const detail = confirmedOdd.length && !oddUnread.length
      ? `${confirmedOdd.length === 1 ? "Its imprint matches" : "Their imprints match"} your label, but ${odd.length === 1 ? `it is ${odd[0].odd}` : "they look different"} from the rest. Show ${odd.length === 1 ? "it" : "them"} to your pharmacist before taking ${odd.length === 1 ? "it" : "them"}.`
      : ending;
    return { ...base, verdict: "WARNING", title, instruction: detail, asks, next };
  }
  if (warnings.length) {
    const first = warnings[0];
    return { ...base, verdict: "WARNING", title: `Pill ${first.number} looks different from your label's medicine.`, instruction: `${appearanceWarning(first)}. Don't take it; check with your pharmacist. We couldn't confirm its identity.`, asks, next };
  }
  if (!pills.length) return { ...base, verdict: "UNSURE", title: "We couldn't check any pills yet.", instruction: `${nudgeText(clumps, false)} and snap again.`, asks, next };
  // Unread regions and possibly hidden pills: lead with what we couldn't read, never with "1 pill matches".
  const unsure = pills.filter((p) => p.result.verdict === "UNSURE").length;
  const regionUnread = allClumps.reduce((n, c) => n + regionEstimate(c, pills), 0);
  const total = pills.length + regionUnread;
  if (piles.some(pileHidden)) return { ...base, verdict: "UNSURE", title: `We could read ${matched} of about ${total} pills.`, instruction: "Some may be hidden under others — give the pile a shake and snap again.", asks: [], next: "pour_again" };
  if (regionUnread && (unsure + regionUnread) * 2 > total) return { ...base, verdict: "UNSURE", title: `We could read ${matched} of about ${total} pills.`, instruction: clumps.some((c) => c.kind === "touching") ? "Some are touching and we couldn't read them — give them a shake and snap again." : `${nudgeText(clumps, false)} and snap again.`, asks: [], next: "pour_again" };
  if (piles.length && !clumps.length && pills.length && matched === pills.length) {
    const inPile = piles.reduce((n, c) => n + c.pile!.read, 0);
    return { ...base, verdict: "LOOKS_RIGHT", title: `The ${pills.length} ${pillsWord(pills.length)} we read match your label.`, instruction: `Some pills were touching. We read ${inPile} in the pile; a pill hidden under another can't be seen. Ask your pharmacist if anything looks off.`, asks: [], next: undefined };
  }
  if (pills.length && matched === pills.length && !clumps.length && !piles.length)
    return { ...base, verdict: "MATCH", title: `All ${pills.length} ${pillsWord(pills.length)} we found match your label.`, instruction: "Check that every pill in your photo has a number. We only checked the pills we found." };
  const inferred = pills.filter(p => p.consensus && !p.carried && p.result.verdict === "UNSURE");
  if (!allClumps.length && !odd.length && !warnings.length && inferred.length && matched >= 2 && matched + inferred.length === pills.length) {
    const label = pills[0].result.label.drugName || "label's medicine";
    return { ...base, verdict: "LOOKS_RIGHT", title: `These pills look like your ${label.toLowerCase()}.`, instruction: `We read the print on ${matched} of ${pills.length}. The other ${inferred.length} look the same as those. Ask your pharmacist if anything looks off.`, asks: [], next: undefined };
  }
  const matchedText = `${matched} ${pillsWord(matched)} ${matched === 1 ? "matches" : "match"}.`;
  if (tooMany) return { ...base, verdict: "UNSURE", title: `${matchedText} ${needed.length} couldn't be read.`, instruction: ending, asks, next };
  if (faceDown.length && faceDown.length === needed.length && !clumps.length)
    return { ...base, verdict: "FACE_DOWN", title: `${matchedText} ${faceDown.length} ${faceDown.length === 1 ? "has its" : "have their"} writing face-down.`, instruction: ending, asks, next };
  const parts = [faceDown.length ? `${faceDown.length} ${faceDown.length === 1 ? "has its" : "have their"} writing face-down` : "", otherUnread.length ? `${otherUnread.length === 1 ? `pill ${otherUnread[0].number}` : `pills ${list(otherUnread.map((p) => p.number))}`} couldn't be read` : ""].filter(Boolean).join("; ");
  const title = parts ? `${matchedText} ${parts[0].toUpperCase()}${parts.slice(1)}.` : clumps.length ? `${matchedText} Some pills weren't checked.` : matchedText;
  return { ...base, verdict: "UNSURE", title, instruction: ending, asks, next };
}
