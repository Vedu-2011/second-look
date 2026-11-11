import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
const css=readFileSync(new URL("../app/globals.css",import.meta.url),"utf8");
const luminance=(hex:string)=>{
  const [r,g,b]=hex.replace("#","").match(/.{2}/g)!.map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return r*.2126+g*.7152+b*.0722;
};
const contrast=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
const palettes=[
  ["match","#1f7a3a","#f2fbf4","#e3f6e8"],
  ["same","#0e6f80","#eef9fb","#ddf2f6"],
  ["mismatch","#c9241a","#fff4f3","#ffe3e0"],
  ["unsure","#3a3a3c","#f7f7f8","#ececef"],
];
describe("v2 contrast at both gradient endpoints",()=>{
  for(const [name,text,...backgrounds] of palettes) for(const bg of backgrounds) {
    it(`${name} title on ${bg} passes AA for normal text`,()=>{
      expect(css).toContain(text); expect(css).toContain(bg);
      expect(contrast(text,bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name} instruction on ${bg} passes AA`,()=>expect(contrast("#1d1d1f",bg)).toBeGreaterThanOrEqual(4.5));
  }
  it.each(["#ff9500","#f58b00"])("uses dark button text on orange %s",bg=>expect(contrast("#1d1d1f",bg)).toBeGreaterThanOrEqual(4.5));
  it("does not claim white text passes on vivid orange",()=>expect(contrast("#ffffff","#ff9500")).toBeLessThan(4.5));
  it.each(["#ffffff","#f5f5f7"])("secondary text on %s passes AA",bg=>expect(contrast("#6e6e73",bg)).toBeGreaterThanOrEqual(4.5));
  it.each(["#ffffff","#f5f5f7"])("deep-blue links on %s pass AA",bg=>expect(contrast("#0066cc",bg)).toBeGreaterThanOrEqual(4.5));
});
