/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { QRCodeSVG } from "qrcode.react";
import { BrandMark } from "@/components/site-chrome";
import { PillDrawing } from "@/components/pill-drawing";
import "./print.css";

export const metadata: Metadata = { title:"One-page project description", description:"Second Look: the problem, FDA-backed checker, frozen NIH results and limits on one printable page.", robots:{index:false,follow:false} };
const app="https://getsecondlook.vercel.app";
export default function OnePager() {
  return <>
    <div className="one-pager-tools"><a href="/second-look-one-pager.pdf">Download the one-page PDF</a><p>Print at 100%, US Letter, headers and footers off.</p></div>
    <article className="one-pager">
      <header className="sheet-heading"><BrandMark/><div><h1>Second Look</h1><p>Is the pill in your bottle the medicine on your label?</p></div></header>
      <p className="sheet-pitch">Photograph the label and one pill. AI reads what is visible; code compares it with real FDA records and shows the evidence.</p>
      <section className="sheet-problem"><h2>Why take a second look?</h2><p>Flynn et al. estimated <strong>51.5 million US pharmacy dispensing errors a year</strong> in 2003.[1] A refill’s changed color was associated with <strong>34% higher odds</strong> of stopping heart medicine; changed shape, <strong>66%</strong>.[2] These are addressable problems, not errors this app has proven it prevents.</p></section>
      <section className="sheet-how"><h2>AI reads. Code decides.</h2><ol>{["Label photo","Pill photo","AI reads","FDA records","Code decides"].map((s,i)=><li key={s}><span>{s}</span>{i<4&&<b aria-hidden>→</b>}</li>)}</ol><p>Compare imprint, color and shape across manufacturers of the same medicine and strength. A second view can help. Size is reference only. When the evidence is unclear, say “can’t tell”.</p></section>
      <section className="sheet-images"><figure><img src="/one-pager-result.png" alt="A recorded FDA example showing the checker’s mismatch verdict"/><figcaption>A result with a clear next step</figcaption></figure><figure><img src="/one-pager-pill.png" alt="The app’s orange oval I2 pill drawing from an FDA record"/><figcaption>FDA appearance, drawn from real fields</figcaption></figure></section>
      <section className="sheet-data"><h2>Real records, visible sources</h2><p><strong>FDA DailyMed:</strong> product label and publication date. <strong>NLM RxNorm:</strong> medicine, strength and other manufacturers. <strong>NIH pill-image archive:</strong> research photos. Every result links to its records. Demo patient labels are fictional.</p></section>
      <section className="sheet-research"><h2>A frozen test, not a safety claim</h2><p><strong>150 NIH photos · 75 new products · 300 label–photo pairs.</strong> On the frozen one-view test, Second Look passed <strong>1/150 wrong pills</strong>; direct AI passed 2/150. When it answered, it was correct <strong>83/88</strong> times versus 83/94. False alarms: <strong>4 versus 9</strong>. It could not tell on <strong>212/300 pairs (70.6%)</strong>; direct AI, 206/300 (68.6%). The coverage goal was not met.</p><p>We <strong>found and fixed a safety bug</strong>: a short, look-alike imprint could pass. Cached post-fix results are separate and post-hoc, not a fresh test. These public 2016-era photos, known label codes and correlated views are not clinical validation. Full protocol and results: <a href={app+"/research"}>getsecondlook.vercel.app/research</a>.</p></section>
      <footer className="sheet-bottom"><div><p className="sheet-safety">Not medical advice. Does not establish authenticity or replace your pharmacist. For a mismatch or uncertainty, don’t take the pill until you check with your pharmacist.</p><p className="sheet-links"><a href={app}>getsecondlook.vercel.app</a><br/><a href="https://github.com/Vedu-2011/second-look">github.com/Vedu-2011/second-look</a></p></div><figure><QRCodeSVG value={app} size={90} marginSize={4} level="M" fgColor="#17202B" bgColor="#FAFBFC" title="Open Second Look"/><figcaption>Try the app</figcaption></figure></footer>
      <div className="sheet-citations"><p>[1] Flynn EA et al. J Am Pharm Assoc. 2003;43:191–200. Historical estimate, not a current count. <a href="https://pubmed.ncbi.nlm.nih.gov/12688437/">PMID 12688437</a>.</p><p>[2] Kesselheim AS et al. Ann Intern Med. 2014;161:96–103. Association, not causation. <a href="https://pubmed.ncbi.nlm.nih.gov/25023248/">PMID 25023248</a>. Dataset: Yaniv et al., <a href="https://pubmed.ncbi.nlm.nih.gov/29854569/">PMID 29854569</a>.</p></div>
    </article>
    <aside className="social-export" aria-hidden="true"><div className="social-copy"><div className="social-brand"><BrandMark/>Second Look</div><p>Is this the<br/>right pill?</p><span>AI reads. FDA records. Code decides.</span><small>getsecondlook.vercel.app</small></div><div className="social-pill"><PillDrawing shapeCode="C48345" colorCodes={["C48331"]} sizeMm={14} imprintSides={["I2"]} pxPerMm={22}/><span>FDA record → drawn pill</span></div></aside>
  </>;
}
