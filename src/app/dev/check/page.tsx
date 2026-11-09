import type { Metadata } from "next";
import { DevCheckForm } from "./dev-check-form";

// Internal: type what a label and a pill say, get the real FDA-backed result. Not linked from the nav.
export const metadata: Metadata = { title: "Dev check", robots: { index: false, follow: false } };

export default function DevCheckPage() {
  return (
    <div className="mx-auto w-full max-w-[52rem] px-5 pt-10 sm:px-8 sm:pt-14">
      <h1 className="text-4xl font-bold tracking-[-0.025em] text-ink">Dev check</h1>
      <p className="mt-3 text-lg text-pretty text-ink-soft">
        Type what&apos;s printed on a label and a pill. The verdict comes from live FDA data (RxNorm and DailyMed),
        exactly as the photo check will use it.
      </p>
      <div className="mt-10">
        <DevCheckForm />
      </div>
    </div>
  );
}
