import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SampleCheck } from "@/components/sample-check";
import { SAMPLES } from "@/lib/samples";

export const metadata: Metadata = { title: "Sample bottle" };

export function generateStaticParams() {
  return SAMPLES.map(({ scenario }) => ({ id: scenario.id }));
}

// The back link is the shared shell; the sample itself is read from the URL inside Suspense (cacheComponents).
export default function SamplePage({ params, searchParams }: PageProps<"/samples/[id]">) {
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
        <Sample params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Sample({ params, searchParams }: Pick<PageProps<"/samples/[id]">, "params" | "searchParams">) {
  const { id } = await params;
  const query = await searchParams;
  const sample = SAMPLES.find(({ scenario }) => scenario.id === id);
  if (!sample) notFound();

  return (
    <>
      <h1 className="mt-2 text-4xl font-bold tracking-[-0.025em] text-ink">{sample.scenario.title}</h1>
      <p className="mt-3 text-lg text-pretty text-ink-soft">
        {sample.photos ? "A real pill and a made-up patient label, checked against FDA records." : "A saved example computed from recorded FDA fields. No photos have been added for this bottle yet."}
      </p>
      <div className="mt-8">
        <SampleCheck key={sample.scenario.id} saved={sample.result} explanation={sample.explanation} photos={sample.photos} autoRun={query.live === "1"} />
      </div>
    </>
  );
}
