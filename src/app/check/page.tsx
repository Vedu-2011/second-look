import type { Metadata } from "next";
import { CheckMode } from "./check-mode";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your pills" };

export default function CheckPage() {
  return (
    <div className="mx-auto w-full max-w-[45rem] px-5 pt-8 sm:px-8 sm:pt-12">
      <CheckMode />
      <Link href="/type" className="mt-8 inline-flex min-h-12 items-center rounded-full text-base font-semibold text-ink-soft underline decoration-amber decoration-2 underline-offset-4">No camera? Type what&apos;s on your pill</Link>
    </div>
  );
}
