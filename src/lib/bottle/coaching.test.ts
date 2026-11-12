import {expect,it} from 'vitest';
import {captureCoaching,coachingFacts} from './coaching';
import {segmentBottle} from './segment';
import {layout,grid} from './test-scenes';
const tip='Move closer — the pills should fill most of the photo.';
it('coaches a far-away spread occupying little foreground',async()=>{
 const p=await segmentBottle(await layout(Array.from({length:6},(_,i)=>({cx:450+(i%3)*90,cy:400+Math.floor(i/3)*100,rx:12,ry:8}))));
 expect(captureCoaching(p)).toEqual([tip]);expect(coachingFacts(p).foregroundShare).toBeLessThan(.015);
});
it('never coaches a close pile even when separate detections are only specks',async()=>{
 const p=await segmentBottle(await layout([
  {cx:370,cy:400,rx:85,ry:40},{cx:490,cy:400,rx:85,ry:40},
  {cx:720,cy:600,rx:85,ry:40},{cx:840,cy:600,rx:85,ry:40},
  ...Array.from({length:8},(_,i)=>({cx:200+i*90,cy:220,rx:7,ry:7})),
 ]));
 expect(p.clumps.length).toBeGreaterThan(0);expect(captureCoaching(p)).toEqual([]);
});
it('small specks cannot pull down the size of the close pills',async()=>{
 const p=await segmentBottle(await layout([...grid(),...Array.from({length:9},(_,i)=>({cx:160+i*100,cy:80,rx:7,ry:7}))]));
 expect(captureCoaching(p)).toEqual([]);
});
it('a large touching region vetoes coaching when there are no separate pills',()=>{
 expect(captureCoaching({image:{width:1200,height:1000},features:[],clumps:[{kind:'touching',box:{x:.2,y:.2,width:.5,height:.4}}]})).toEqual([]);
});
it('a tiny touching pair can still be coached, using its foreground too',()=>{
 expect(captureCoaching({image:{width:1200,height:1000},features:[],clumps:[{kind:'touching',box:{x:.45,y:.4,width:.025,height:.02}}]})).toEqual([tip]);
});
it('a spread already spanning the frame cannot be moved closer',async()=>{
 const p=await segmentBottle(await layout([{cx:150,cy:400,rx:12,ry:8},{cx:1050,cy:400,rx:12,ry:8}]));
 expect(captureCoaching(p)).toEqual([]);expect(coachingFacts(p).frameSpan).toBeGreaterThan(.65);
});
it('even small objects are not coached when their total foreground is substantial',()=>{
 const feature={length:36,width:20,aspect:1.8,area:.001,relativeArea:1,lab:[50,0,0] as [number,number,number]};
 expect(captureCoaching({image:{width:1200,height:1000},features:Array.from({length:20},()=>feature),clumps:[]})).toEqual([]);
});
