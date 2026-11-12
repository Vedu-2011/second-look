import type { SegmentedBottle } from './segment';
import type { NormalizedBox } from './types';

/** Fixed on drawn far/close/pile/speck controls, before auditing real photographs. Not identity thresholds. */
export const COACHING_RULES = {
  maxObjectLength: .04,
  maxForegroundShare: .015,
  maxFrameSpan: .65,
  minRelativeArea: .3,
  minWorkingLength: 12,
  minWorkingArea: 64,
} as const;
type Input = Pick<SegmentedBottle, 'image' | 'features' | 'clumps'> & Partial<Pick<SegmentedBottle, 'boxes'>>;

export function coachingFacts(segmented: Input) {
  const {width,height}=segmented.image, longEdge=Math.max(width,height);
  const scale=Math.min(1,1200/longEdge), workingLongEdge=longEdge*scale, workingArea=width*height*scale*scale;
  const objects: {length:number;area:number;box?:NormalizedBox}[] = [
    ...segmented.features.map((f,i)=>({length:f.length/workingLongEdge,area:f.area,box:segmented.boxes?.[i]})),
    // A padded region box overestimates foreground: conservative when deciding whether it is safe to move closer.
    ...segmented.clumps.map(c=>({length:Math.hypot(c.box.width*width,c.box.height*height)/longEdge,area:c.box.width*c.box.height,box:c.box})),
  ].filter(o=>Number.isFinite(o.length)&&Number.isFinite(o.area)&&o.length*workingLongEdge>=COACHING_RULES.minWorkingLength&&o.area*workingArea>=COACHING_RULES.minWorkingArea);
  const topAreas=objects.map(o=>o.area).sort((a,b)=>b-a).slice(0,3);
  const typical=topAreas[Math.floor(topAreas.length/2)]??0;
  const kept=objects.filter(o=>o.area>=typical*COACHING_RULES.minRelativeArea);
  const largestLengths=kept.map(o=>o.length).sort((a,b)=>b-a).slice(0,3);
  const foregroundShare=Math.min(1,kept.reduce((n,o)=>n+o.area,0));
  const boxes=kept.flatMap(o=>o.box?[o.box]:[]);
  const frameSpan=boxes.length?Math.max(
    (Math.max(...boxes.map(b=>b.x+b.width))-Math.min(...boxes.map(b=>b.x)))*width/longEdge,
    (Math.max(...boxes.map(b=>b.y+b.height))-Math.min(...boxes.map(b=>b.y)))*height/longEdge,
  ):0;
  const moveCloser=kept.length>0&&largestLengths.every(n=>n<COACHING_RULES.maxObjectLength)&&foregroundShare<COACHING_RULES.maxForegroundShare&&frameSpan<COACHING_RULES.maxFrameSpan;
  return {objects:kept.length,ignored:segmented.features.length+segmented.clumps.length-kept.length,largestLengths,foregroundShare,frameSpan,moveCloser};
}
export function captureCoaching(segmented: Input) {
  return coachingFacts(segmented).moveCloser?['Move closer — the pills should fill most of the photo.']:[];
}
