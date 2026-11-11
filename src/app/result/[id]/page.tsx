import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ResultView } from "@/components/result-view";
import { BottleResultView } from "@/components/bottle-result";
import { getBottleResult, getResult } from "@/lib/result-store";

export const metadata: Metadata = { title: "Shared check result" };
export const instant = false;

export default async function ResultPage({ params }: PageProps<"/result/[id]">) {
  await connection();
  const { id } = await params;
  const bottle = await getBottleResult(id);
  if (bottle) return <div className="mx-auto w-full max-w-[52rem] px-5 pt-8 sm:px-8 sm:pt-12"><h1 className="mb-6 text-3xl font-bold">Shared whole-bottle photo check</h1><BottleResultView result={bottle.result} /></div>;
  const stored = await getResult(id);
  if (!stored) notFound();
  return <div className="mx-auto w-full max-w-[52rem] px-5 pt-8 sm:px-8 sm:pt-12"><p className="text-sm font-semibold text-ink-soft">Shared Second Look result</p><h1 className="mt-2 text-4xl font-bold tracking-[-0.025em] text-ink">A saved check</h1><p className="mt-3 text-lg text-ink-soft">Photos are not stored. This page keeps the FDA-backed reading and verdict for seven days.</p><div className="mt-8"><ResultView result={stored.result} explanation={stored.explanation} /></div></div>;
}
