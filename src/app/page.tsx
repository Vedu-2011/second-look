import { Camera, ScanText, Database, CircleCheck, CircleHelp, Eye, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ButtonLink } from "@/components/button";
import { PillDrawing } from "@/components/pill-drawing";
import { ResultView } from "@/components/result-view";
import { VerdictField } from "@/components/verdict-field";
import { REAL_DEMO, SAMPLE_RESULTS } from "@/lib/sample-results";
import { drugGroup } from "@/lib/fda/rxnav";
import type { Product } from "@/lib/fda/types";
const softgel=REAL_DEMO.products['63981-598'];
const advil=REAL_DEMO.products['0573-0169'];
const tylenol=REAL_DEMO.products['50580-937'];
const mismatch=SAMPLE_RESULTS.find(s=>s.scenario.id==="mismatch")!.result;
const maker=SAMPLE_RESULTS.find(s=>s.scenario.id==="different-maker")!.result;
function Draw({pill,scale=15}:{pill:Product;scale?:number}) { return <PillDrawing shapeCode={pill.shapeCode??""} colorCodes={pill.colorCodes} sizeMm={pill.sizeMm??12} imprintSides={pill.imprintRaw.split(";")} score={pill.scored?2:1} pxPerMm={scale}/>; }
async function VersionCount() {
  await connection();
  const group=await drugGroup("310965").catch(()=>null);
  return <><strong className="version-number">{group ? group.products.length.toLocaleString("en-US") : "Many"}</strong><p>versions of ibuprofen 200 mg,<br/>from every maker.</p></>;
}
export default function Home() {
  return <div className="home-page">
    <section className="home-hero">
      <div className="hero-copy"><h1>Is this the<br className="sm:hidden"/> right pill?</h1><p>Snap the label and one pill. Get the answer, with the FDA&apos;s proof, in about 10 seconds.</p><div className="home-actions"><ButtonLink href="/check">Check a pill</ButtonLink><ButtonLink href="/samples/match?live=1" variant="secondary">Try a sample</ButtonLink></div><Link href="/type" className="home-text-link">No camera? Type what&apos;s on your pill <span aria-hidden>›</span></Link></div>
      <div className="hero-object"><div className="floating-pill float-one" aria-hidden><Draw pill={softgel} scale={18}/></div><div className="floating-pill float-two" aria-hidden><Draw pill={tylenol} scale={14}/></div><div className="floating-pill float-three" aria-hidden><Draw pill={advil} scale={13}/></div>
        <figure className="phone"><div className="phone-island" aria-hidden/><div className="phone-status" aria-hidden><span>9:41</span><span>● ▰</span></div><div className="phone-app-name">Second Look <span>Here is your result</span></div><div className="phone-screen" aria-hidden inert><div className="phone-canvas"><ResultView result={mismatch}/></div></div><figcaption className="phone-caption">Real FDA-record example · typed pill details</figcaption><div className="phone-home-bar" aria-hidden/></figure>
      </div>
    </section>
    <section className="home-band stat-band"><div className="home-container"><h2><span>51.5 million</span> pharmacy dispensing errors a year in the US.</h2><a href="https://pubmed.ncbi.nlm.nih.gov/12688437/" className="home-text-link">Flynn et al., 2003 <span aria-hidden>›</span></a><p>A refill that looks different can change more than your routine. Color changes were linked to <strong>34%</strong> higher odds of stopping heart medicine; shape changes, <strong>66%</strong>. <a href="https://pubmed.ncbi.nlm.nih.gov/25023248/" className="home-text-link">Kesselheim et al., 2014 <span aria-hidden>›</span></a></p></div></section>
    <section className="home-section home-container"><h2 className="section-title">AI reads.<br/>Code decides.</h2><ol className="home-flow">{[{Icon:Camera,title:"Photograph",body:"Your pharmacy label and one pill."},{Icon:ScanText,title:"Read",body:"Claude reads the visible text and appearance."},{Icon:Database,title:"Check",body:"Compare with every maker’s FDA record."},{Icon:CircleCheck,title:"Answer",body:"A clear result, with the record behind it."}].map(({Icon,title,body},i)=><li key={title}><div className="flow-symbol"><Icon aria-hidden strokeWidth={1.6}/>{i<3&&<ArrowRight className="flow-arrow" aria-hidden/>}</div><h3>{title}</h3><p>{body}</p></li>)}</ol><p className="flow-guard">The AI reads the photos. Plain code makes the decision. Explanations are checked against the facts.</p></section>
    <section className="home-band"><div className="home-container home-section"><h2 className="section-title">See the difference.<br/>Know what it means.</h2><div className="home-bento">
      <article className="bento-tile bento-compare"><h3>The FDA&apos;s picture,<br/>next to yours.</h3><p>Imprint, color and shape.<br/>The details that make a difference.</p><div className="bento-pills"><figure><Draw pill={softgel}/><figcaption>FDA record</figcaption></figure><figure><Draw pill={tylenol}/><figcaption>Pill details supplied</figcaption></figure></div><Link href="/samples/mismatch" className="home-text-link">Explore this recorded example <span aria-hidden>›</span></Link></article>
      <article className="bento-tile bento-versions"><Database aria-hidden size={36} strokeWidth={1.5}/><h3>Every maker.<br/>Every version.</h3><Suspense fallback={<p className="version-number">Every one.</p>}><VersionCount/></Suspense><Link href="/sources" className="home-text-link">Live record counts <span aria-hidden>›</span></Link></article>
      <article className="bento-tile bento-same"><h3>Same medicine,<br/>new look.</h3><VerdictField verdict={maker.verdict} compact instruction={`Same medicine and strength. Sold by ${maker.matchingListings?.sellers.length ?? "several"} companies.`}/><p>Refills can change appearance. The FDA record helps explain why.</p></article>
      <article className="bento-tile bento-unsure"><CircleHelp aria-hidden size={42} strokeWidth={1.5}/><h3>“Can&apos;t tell”<br/>beats guessing.</h3><p>If the photo or the records aren&apos;t clear, we say so. Your pharmacist is the next step.</p></article>
      <article className="bento-tile bento-eyes"><Eye aria-hidden size={42} strokeWidth={1.5}/><h3>Built for<br/>older eyes.</h3><p>Big type. Clear words. Distinctive imprint characters.</p><span className="accessibility-note">Lighthouse accessibility: 100</span></article>
    </div></div></section>
    <section className="home-section home-container home-tested"><h2 className="section-title">Tested on 150 photos<br/>it had never seen.</h2><div className="tested-numbers"><div><strong>83 of 88</strong><p>right when it answered</p></div><div><strong>4 vs 9</strong><p>false alarms versus asking AI directly</p></div></div><Link href="/research" className="home-text-link">Read the research <span aria-hidden>›</span></Link></section>
    <section className="home-band home-section home-final"><h2 className="section-title">Take a second look.</h2><p>A little clarity before you take it.</p><div className="home-actions"><ButtonLink href="/check">Check a pill</ButtonLink><ButtonLink href="/samples/match?live=1" variant="secondary">Try a sample</ButtonLink></div></section>
  </div>;
}
