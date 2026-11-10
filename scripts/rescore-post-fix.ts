// Offline only: no model client, network or environment-file loader.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { decide, type PillReading } from "../src/lib/verdict-engine";
import { buildPairs, type ResearchImage, type Observation } from "../src/lib/research";
import { safetyMetrics } from "../src/lib/research-safety";
import type { Product } from "../src/lib/fda/types";

if (process.env.ANTHROPIC_API_KEY) throw Error("Unset ANTHROPIC_API_KEY for this offline rescore.");
const read = <T>(file: string): T => JSON.parse(readFileSync(file,"utf8"));
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
type Cohort = {seed:number; images:(ResearchImage & {sha256:string})[]; products:Record<string,{product:Product;products:Product[]}>};
type Cache = Record<string,{reading:PillReading}>;
const immutable = ["cohort.json","holdout-cohort.json","readings-claude-sonnet-5-5.json","holdout-readings.json","cost.json","holdout-cost.json","development-results.json","holdout-results.json","holdout-pairs.csv","holdout-freeze.json"];
const inputHashes = Object.fromEntries(immutable.map(f=>[f,hash("research/out/"+f)]));
const codeFiles = ["src/lib/match/imprint.ts", "src/lib/verdict-engine.ts", "src/lib/pill-views.ts", "scripts/rescore-post-fix.ts"];
for (const [name,cohortFile,cacheFile,version] of [
  ["development","cohort.json","readings-claude-sonnet-5-5.json","pill-v1"],
  ["holdout","holdout-cohort.json","holdout-readings.json","pill-v2"],
]) {
  const cohort = read<Cohort>("research/out/"+cohortFile);
  const cache = read<Cache>("research/out/"+cacheFile);
  const rows:Record<string,Observation[]> = {"Sonnet, one view":[],"Sonnet, two views":[]};
  for (const pair of buildPairs(cohort.images,cohort.seed)) {
    const image=cohort.images.find(i=>i.file===pair.image)!;
    const mate=cohort.images.find(i=>i.ndc===image.ndc && i.file!==image.file)!;
    const a=cache[version+":"+image.sha256]?.reading, b=cache[version+":"+mate.sha256]?.reading;
    if (!a || !b) throw Error("Missing cached reading: "+image.file);
    const expected=cohort.products[pair.labelNdc];
    const data={labelProduct:expected.product,sameDrugProducts:expected.products};
    rows["Sonnet, one view"].push({...pair,verdict:decide({ndc:pair.labelNdc},a,data).verdict});
    rows["Sonnet, two views"].push({...pair,verdict:decide({ndc:pair.labelNdc},[a,b],data).verdict});
  }
  const metrics=Object.fromEntries(Object.entries(rows).map(([m,r])=>[m,safetyMetrics(r)]));
  const result={label:"After two fixes (post-hoc — this holdout is no longer untouched)",cohort:name,images:cohort.images.length,pairs:cohort.images.length*2,readingVersion:version,modelCalls:0,totalUsd:0,commit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),sourceHashes:Object.fromEntries(codeFiles.map(f=>[f,hash(f)])),inputHashes,metrics,rows};
  writeFileSync("research/out/post-fix-"+name+".json",JSON.stringify(result,null,2)+"\n");
  console.log(name,JSON.stringify(metrics));
}
for (const f of immutable) if(inputHashes[f]!==hash("research/out/"+f)) throw Error("Immutable input changed: "+f);
console.log("Zero model calls; immutable input and cost hashes unchanged.");
