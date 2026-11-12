import type { SegmentedBottle } from './segment';
/** Synthetic 1200px scenes: 24px-long pills lose the imprint; 48px and 120px scenes are not coached. */
export const MIN_PILL_FRAME_FRACTION = .025;
export function captureCoaching(segmented: Pick<SegmentedBottle, 'image' | 'features' | 'clumps'>) {
  const sizes = segmented.features.map(f => f.length).sort((a,b) => a-b);
  const workingLongEdge = Math.min(1200, Math.max(segmented.image.width, segmented.image.height));
  const median = sizes[Math.floor(sizes.length / 2)] ?? Infinity;
  const tips: string[] = [];
  if (median / workingLongEdge < MIN_PILL_FRAME_FRACTION) tips.push('Move closer — the pills should fill most of the photo.');
  // Phase 11c: no "spread them out" pre-check. People pour piles; the pile reader handles touching pills.
  return tips;
}
