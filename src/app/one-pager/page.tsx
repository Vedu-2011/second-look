/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import { QRCodeSVG } from "qrcode.react";
import { BrandMark } from "@/components/site-chrome";
import { PillDrawing } from "@/components/pill-drawing";
import { IBUPROFEN_I2_OVAL as example } from "@/lib/fda/fixtures";
import "./print.css";

export const metadata: Metadata = { title:"One-page project description", description:"Second Look: the problem, FDA-backed checker, frozen NIH results and limits on one printable page.", robots:{index:false,follow:false} };
const app="https://getsecondlook.vercel.app";
// Snapshot of the deduplicated count from the live app at export time.
const ibuprofenVersions = 507;
const outcomes = [
  ["Right when it gave an answer", "83 of 88", "83 of 94"],
  ["False alarms on the right pill", "4", "9"],
  ["Wrong pills called fine", "1", "2"],
  ["Said \"can't tell\"", "212 of 300", "206 of 300"],
];
export default function OnePager() {
  return <>
    <div className="one-pager-tools"><a href="/second-look-one-pager.pdf">Download the one-page PDF</a><p>Print at 100%, US Letter, headers and footers off.</p></div>
    <article className="one-pager">
      <header className="sheet-heading"><BrandMark/><div><h1>Second Look</h1><p>Is the pill in your bottle the medicine on your label?</p></div></header>
      <p className="sheet-pitch">Take a photo of the pharmacy label and one pill. Second Look reads both, checks the pill against every FDA record for that medicine, and shows you the proof in about 10 seconds.</p>

      <div className="sheet-story">
        <section className="sheet-problem">
          <h2>Why it matters</h2>
          <ul>
            <li>US pharmacies make an estimated <strong>51.5 million dispensing errors a year</strong>.<sup><a href="#flynn">[1]</a></sup></li>
            <li>When a refill suddenly looks different, people are more likely to stop taking it: <strong>34% higher odds</strong> after a color change, <strong>66%</strong> after a shape change.<sup><a href="#kesselheim">[2]</a></sup></li>
            <li>Second Look is for the people who catch these mix-ups at the kitchen table: older adults and the family members who manage their medicines.</li>
          </ul>
        </section>
        <section className="sheet-how">
          <h2>AI reads. Code decides.</h2>
          <ol>{["Label photo", "Pill photo", "AI reads", "FDA records", "Code decides"].map((step, i) => (
            <li key={step}><span>{step}</span>{i < 4 && <b aria-hidden>→</b>}</li>
          ))}</ol>
          <p>Claude reads the label and the letters stamped on the pill. Then plain code, not the AI, compares the imprint, color and shape with every maker&apos;s FDA record for that medicine and picks the answer: Matches, Same medicine from another maker, Doesn&apos;t match, or Can&apos;t tell. Every answer links to the FDA record it used.</p>
        </section>
      </div>

      <figure className="sheet-result">
        <img src="/one-pager-result.png" alt="Doesn't match: the FDA's orange I2 ibuprofen drawing next to the white L484 pill drawing." />
        <figcaption>The wrong pill, caught: the FDA&apos;s picture of what should be in the bottle, next to what is.</figcaption>
      </figure>

      <p className="sheet-data"><strong>Real records:</strong> FDA DailyMed · NLM RxNorm ({ibuprofenVersions} versions of ibuprofen 200 mg, from every maker) · NIH Pill Image dataset. Demo patient labels are made up; the pills and the records are real.</p>

      <section className="sheet-research">
        <h2>Tested on photos it had never seen</h2>
        <p>We tested Second Look on 150 real NIH phone photos (75 products, 300 label–photo pairs) that we never tuned on, and compared it with simply asking the AI &quot;is this the right pill?&quot;</p>
        <table aria-label="Frozen one-view holdout results">
          <thead><tr><td></td><th scope="col">Second Look</th><th scope="col">Asking the AI directly</th></tr></thead>
          <tbody>{outcomes.map(([label, secondLook, directAI]) => (
            <tr key={label}><th scope="row">{label}</th><td>{secondLook}</td><td>{directAI}</td></tr>
          ))}</tbody>
        </table>
        <p>These 2016 photos show one side of a single pill, so both methods often couldn&apos;t tell. The test also found a real safety bug: a one-character look-alike imprint could slip through. We fixed it and published the before and after.</p>
        <p>Full method and every result: <a href={app + "/research"}>getsecondlook.vercel.app/research</a></p>
      </section>

      <footer className="sheet-bottom">
        <div>
          <p className="sheet-safety">Second Look helps you spot a possible mix-up. It doesn&apos;t replace your pharmacist. If it says Doesn&apos;t match or Can&apos;t tell, don&apos;t take the pill until you&apos;ve talked to your pharmacist.</p>
          <p className="sheet-links"><a href={app}>getsecondlook.vercel.app</a> · <a href="https://github.com/Vedu-2011/second-look">github.com/Vedu-2011/second-look</a></p>
        </div>
        <figure><QRCodeSVG value={app} size={84} marginSize={4} level="M" fgColor="#17202B" bgColor="#FAFBFC" title="Open Second Look"/><figcaption>Try the app</figcaption></figure>
      </footer>
      <div className="sheet-citations">
        <p id="flynn">[1] Flynn EA et al. J Am Pharm Assoc. 2003;43:191-200. <a href="https://pubmed.ncbi.nlm.nih.gov/12688437/">PMID 12688437</a>.</p>
        <p id="kesselheim">[2] Kesselheim AS et al. Ann Intern Med. 2014;161:96-103. <a href="https://pubmed.ncbi.nlm.nih.gov/25023248/">PMID 25023248</a>. Dataset: Yaniv et al., <a href="https://pubmed.ncbi.nlm.nih.gov/29854569/">PMID 29854569</a>.</p>
      </div>
    </article>
    <aside className="social-export" aria-hidden="true"><div className="social-copy"><div className="social-brand"><BrandMark/>Second Look</div><p>Is this the<br/>right pill?</p><span>AI reads. FDA records. Code decides.</span><small>getsecondlook.vercel.app</small></div><div className="social-pill"><PillDrawing shapeCode={example.shapeCode} colorCodes={example.colorCodes} sizeMm={example.sizeMm} imprintSides={example.imprintSides} score={example.score} pxPerMm={22}/><span>FDA record → drawn pill</span></div></aside>
  </>;
}
