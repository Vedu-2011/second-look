import type { Metadata } from "next";
import { Suspense } from "react";
import { demoLabels, type LabelParams } from "@/lib/demo-labels";
import "./print.css";

export const metadata: Metadata = { title: "Print demo labels", robots: { index: false, follow: false } };

export default function LabelsPage({ searchParams }: { searchParams: Promise<LabelParams> }) {
  return <Suspense fallback={<p>Preparing labels…</p>}><Labels searchParams={searchParams} /></Suspense>;
}

async function Labels({ searchParams }: { searchParams: Promise<LabelParams> }) {
  const labels = demoLabels(await searchParams);
  return <div className="label-workspace mx-auto max-w-4xl px-5 pt-10">
    <div className="print-help mb-8 max-w-2xl"><h1 className="text-4xl font-bold">Print demo labels</h1><p className="mt-4 text-lg text-ink-soft">Print at 100% scale on US Letter paper, with browser headers and footers off. Each label is 3.5 × 2 inches.</p><p className="mt-3 text-base text-ink-soft">Change fields in the address: <code>?ndc=70010-065&amp;mfr=Granules</code>. Use <code>match.ndc</code>, <code>different-maker.ndc</code>, or <code>mismatch.ndc</code> to edit just one label. Other fields: pharmacy, patient, rx, drug, strength, form, directions, qty, date, initials.</p></div>
    <div className="label-sheet">{labels.map(l => <section className="label-item" key={l.id} aria-label={l.scenario}>
      <div className="label-pharmacy">{l.pharmacy}</div><div className="label-rx">Rx # {l.rx} <span>Filled {l.date}</span></div>
      <div className="label-patient">{l.patient}</div><div className="label-drug">{l.drug} {l.strength} {l.form}</div>
      <div className="label-directions">{l.directions}</div>
      <div className="label-details"><span>Qty: {l.qty}</span><span>Pharmacist: {l.initials}</span></div><div>NDC: <strong>{l.ndc}</strong> · Mfr: {l.mfr}</div>
      <div className="label-disclaimer">Sample label for a demo — not a real prescription</div>
    </section>)}</div>
  </div>;
}
