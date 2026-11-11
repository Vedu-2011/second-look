/** Distance-transform peaks, then a two-marker partition. Detection only, never drug identity. */
export const SPLIT_RULES = { peakFraction: .75, seedSeparation: 1.6, maxSaddle: .65, maxAreaRatio: 1.5, minSolidity: .94, maxAspect: 3.3 } as const;
export function splitTouching(pixels: Int32Array, sourceWidth: number): Int32Array[] | null {
  let x0=Infinity,y0=Infinity,x1=0,y1=0;
  for(const i of pixels){const x=i%sourceWidth,y=Math.floor(i/sourceWidth);x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}
  const w=x1-x0+3,h=y1-y0+3, d=new Float32Array(w*h), inside=new Uint8Array(w*h);
  for(const i of pixels){const j=(Math.floor(i/sourceWidth)-y0+1)*w+i%sourceWidth-x0+1;inside[j]=1;d[j]=1e6;}
  const diag=Math.SQRT2;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(inside[i])d[i]=Math.min(d[i],d[i-1]+1,d[i-w]+1,d[i-w-1]+diag,d[i-w+1]+diag);}
  for(let y=h-2;y>0;y--)for(let x=w-2;x>0;x--){const i=y*w+x;if(inside[i])d[i]=Math.min(d[i],d[i+1]+1,d[i+w]+1,d[i+w-1]+diag,d[i+w+1]+diag);}
  let max=0;for(const v of d)max=Math.max(max,v);
  if(max<3)return null;
  const peaks:number[]=[];
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(d[i]<max*SPLIT_RULES.peakFraction)continue;let peak=true;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(d[i+dy*w+dx]>d[i])peak=false;if(peak)peaks.push(i);}
  peaks.sort((a,b)=>d[b]-d[a]||a-b);
  const seeds:number[]=[];
  const distance=(a:number,b:number)=>Math.hypot(a%w-b%w,Math.floor(a/w)-Math.floor(b/w));
  for(const p of peaks)if(seeds.every(q=>distance(p,q)>=max*SPLIT_RULES.seedSeparation))seeds.push(p);
  if(seeds.length!==2)return null;
  const [a,b]=seeds;let saddle=Infinity;
  for(let t=.2;t<=.8;t+=.02){const x=Math.round(a%w+(b%w-a%w)*t),y=Math.round(Math.floor(a/w)+(Math.floor(b/w)-Math.floor(a/w))*t);saddle=Math.min(saddle,d[y*w+x]);}
  if(saddle>Math.min(d[a],d[b])*SPLIT_RULES.maxSaddle)return null;
  const groups:[number[],number[]]=[[],[]];
  for(const i of pixels){const j=(Math.floor(i/sourceWidth)-y0+1)*w+i%sourceWidth-x0+1;groups[distance(j,a)<=distance(j,b)?0:1].push(i);}
  if(Math.max(groups[0].length,groups[1].length)/Math.max(1,Math.min(groups[0].length,groups[1].length))>SPLIT_RULES.maxAreaRatio)return null;
  return groups.map(ps=>Int32Array.from(ps));
}
