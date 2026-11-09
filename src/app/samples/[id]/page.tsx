import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ResultView } from "@/components/result-view";
import { SAMPLE_RESULTS } from "@/lib/sample-results";

export const metadata: Metadata = { title: "Sample bottle" };

export function generateStaticParams() {
  return SAMPLE_RESULTS.map(({ scenario }) => ({ id: scenario.id }));
}

// The back link is the shared shell; the sample itself is read from the URL inside Suspense (cacheComponents).
export default function SamplePage({ params }: PageProps<"/samples/[id]">) {
  return (
    <div className="mx-auto w-full max-w-[52rem] px-5 pt-8 sm:px-8 sm:pt-12">
      <Link
        href="/samples"
        className="inline-flex min-h-12 items-center gap-2 rounded-full text-base font-semibold text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All sample bottles
      </Link>
      <Suspense fallback={<div className="mt-2 h-96 rounded-[var(--radius-photo)] bg-foil" aria-hidden />}>
        <Sample params={params} />
      </Suspense>
    </div>
  );
}

async function Sample({ params }: Pick<PageProps<"/samples/[id]">, "params">) {
  const { id } = await params;
  const sample = SAMPLE_RESULTS.find(({ scenario }) => scenario.id === id);
  if (!sample) notFound();

  return (
    <>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.025em] text-ink">{sample.scenario.title}</h1>
      <p className="mt-3 text-lg text-pretty text-ink-soft">
        A sample bottle with a made-up patient. The pill and the FDA records are real.
      </p>
      <div className="mt-8">
        <ResultView result={sample.result} />
      </div>
    </>
  );
}
