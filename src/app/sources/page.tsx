import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { drugGroup } from "@/lib/fda/rxnav";

export const metadata: Metadata = { title: "Data sources" };

async function LiveCounts() {
  await connection();
  const drugs = [{ id: "310965", name: "Ibuprofen 200 mg" }, { id: "198440", name: "Acetaminophen 500 mg" }];
  const groups = await Promise.all(drugs.map(async drug => ({ ...drug, group: await drugGroup(drug.id).catch(() => null) })));
  return <section className="mt-7 rounded-[var(--radius-photo)] bg-foil p-5 sm:p-7" aria-label="Live FDA record counts"><h2 className="text-xl font-bold">The records behind a check</h2><ul className="mt-3 space-y-3">{groups.map(({ id, name, group }) => <li key={id} className="text-lg"><strong>{name}:</strong> {group ? `${group.products.length.toLocaleString("en-US")} products from every maker (${group.products.filter(p => p.active).length.toLocaleString("en-US")} active).` : "We couldn't load the current count. Try again later."}</li>)}</ul><p className="mt-4 text-sm text-ink-soft">Last checked: {new Date().toISOString().replace("T", " ").slice(0, 16)} UTC. Duplicate package sizes count once. FDA responses may be cached for up to 24 hours; counts include discontinued products.</p></section>;
}

const SOURCES = [
  {
    name: "FDA DailyMed",
    by: "U.S. Food and Drug Administration, hosted by the National Library of Medicine",
    what: "The official drug labels that drug companies file with the FDA. Each label lists what the pill looks like: the letters and numbers stamped on it, its color, shape and size in millimetres.",
    use: "Every result links to the exact DailyMed label we compared your pill with, and shows the date that label was published.",
    links: [{ label: "dailymed.nlm.nih.gov", href: "https://dailymed.nlm.nih.gov/dailymed/" }],
  },
  {
    name: "NLM RxNorm (RxNav)",
    by: "National Library of Medicine",
    what: "A standard vocabulary for US medicines, with codes that tie products from different companies to the same drug and strength.",
    use: "We look up the product on your label, then every other product with the same medicine and strength. That's how we can tell you a pill that looks different is still the same medicine.",
    links: [{ label: "RxNav", href: "https://lhncbc.nlm.nih.gov/RxNav/" }],
  },
  {
    name: "NIH Pill Image Recognition dataset",
    by: "National Library of Medicine, from its 2016 Pill Image Recognition Challenge",
    what: "Photos of real prescription pills, from clean reference shots to everyday consumer-quality pictures, each labelled with what the pill is.",
    use: "We use it to test how well Second Look reads pills from photos. It isn't used during your check.",
    links: [
      { label: "The dataset", href: "https://data.lhncbc.nlm.nih.gov/public/Pills/index.html" },
      { label: "The challenge report (Yaniv et al., 2016)", href: "https://pubmed.ncbi.nlm.nih.gov/29854569/" },
    ],
  },
];

export default function SourcesPage() {
  return (
    <div className="mx-auto w-full max-w-[45rem] px-5 pt-10 sm:px-8 sm:pt-14">
      <h1 className="text-4xl font-bold tracking-[-0.025em] text-ink">Where our data comes from</h1>
      <p className="mt-4 text-lg text-pretty text-ink-soft">
        Second Look doesn&apos;t guess what a pill should look like. It checks the public records the FDA and the
        National Library of Medicine keep for every medicine sold in the US. All of it is free and open.
      </p>
      <Suspense fallback={<p className="mt-7 rounded-[var(--radius-photo)] bg-foil p-5 text-lg">Loading FDA record counts…</p>}><LiveCounts /></Suspense>

      <ol className="mt-10 flex flex-col gap-5">
        {SOURCES.map((s, i) => (
          <li key={s.name} className="rounded-[var(--radius-photo)] bg-white p-6 shadow-[var(--shadow-soft)] sm:p-8">
            <p className="text-sm font-semibold text-ink-soft">{i + 1}</p>
            <h2 className="text-2xl font-bold tracking-[-0.01em] text-ink">{s.name}</h2>
            <p className="mt-1 text-base text-ink-soft">{s.by}</p>
            <dl className="mt-5 flex flex-col gap-4">
              <div>
                <dt className="text-base font-bold text-ink">What it is</dt>
                <dd className="mt-1 text-lg text-pretty text-ink">{s.what}</dd>
              </div>
              <div className="rounded-[var(--radius-row)] bg-foil p-4">
                <dt className="text-base font-bold text-ink">What we use it for</dt>
                <dd className="mt-1 text-lg text-pretty text-ink">{s.use}</dd>
              </div>
            </dl>
            <ul className="mt-5 flex flex-wrap gap-2">
              {s.links.map((l) => (
                <li key={l.href}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-h-12 items-center gap-1.5 rounded-full bg-foil px-4 text-base font-semibold text-ink hover:bg-foil-deep"
                  >
                    {l.label}
                    <ArrowUpRight className="size-4 text-ink-soft" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <p className="mt-8 text-base text-pretty text-ink-soft">
        Second Look only reads your photos to make the comparison. We don&apos;t keep your photos, and we never read
        or store the patient name on your label. Demo sample photos are intentionally public.
      </p>
    </div>
  );
}
