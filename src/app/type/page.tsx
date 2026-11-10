import type { Metadata } from "next";
import { TypeForm } from "./type-form";

export const metadata: Metadata = { title: "Type what's on your pill" };
export default function TypePage() {
  return <div className="mx-auto max-w-[52rem] px-5 pt-10 sm:px-8 sm:pt-14"><h1 className="max-w-xl text-4xl font-bold tracking-tight">Type what&apos;s on your pill</h1><p className="mt-4 max-w-2xl text-lg text-ink-soft">Have the bottle and one pill in front of you. Copy the label and the letters exactly as you see them. We&apos;ll compare them with FDA records.</p><div className="mt-8"><TypeForm /></div></div>;
}
