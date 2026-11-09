import Link from "next/link";
import { cn } from "@/lib/utils";

// A tiny amber prescription bottle: cap, body, white label.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 32" aria-hidden className={cn("h-8 w-7", className)}>
      <rect x="3" y="1.5" width="22" height="7" rx="2.5" fill="#17202B" />
      <rect x="5" y="7" width="18" height="23.5" rx="4.5" fill="#E0901E" />
      <rect x="5" y="7" width="18" height="3" fill="#000" opacity="0.12" />
      <rect x="7.5" y="13.5" width="13" height="10" rx="2" fill="#FAFBFC" />
      <rect x="9.5" y="16.5" width="7" height="1.6" rx="0.8" fill="#17202B" opacity="0.55" />
      <rect x="9.5" y="19.5" width="9" height="1.6" rx="0.8" fill="#17202B" opacity="0.3" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 pt-5 pb-2 sm:px-8 sm:pt-7">
      <Link href="/" className="-m-2 flex min-h-12 items-center gap-2.5 rounded-full p-2">
        <BrandMark />
        <span className="text-lg font-bold tracking-[-0.01em] whitespace-nowrap text-ink sm:text-xl">Second Look</span>
      </Link>
      <nav aria-label="Main" className="-mr-2 flex items-center text-base sm:mr-0 sm:gap-2">
        <Link href="/samples" className="flex min-h-12 items-center rounded-full px-2.5 font-semibold text-ink-soft hover:bg-foil hover:text-ink sm:px-4">
          Samples
        </Link>
        <Link href="/sources" className="flex min-h-12 items-center rounded-full px-2.5 font-semibold text-ink-soft hover:bg-foil hover:text-ink sm:px-4">
          Sources
        </Link>
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-foil">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="max-w-xl text-base font-semibold text-ink">
          Second Look helps you spot a possible mix-up. It doesn&apos;t replace your pharmacist.
        </p>
        <p className="text-sm text-ink-soft">
          Pill data from the FDA and the National Library of Medicine.{" "}
          <Link href="/sources" className="font-semibold text-ink underline decoration-amber decoration-2 underline-offset-4">
            Our sources
          </Link>
        </p>
      </div>
    </footer>
  );
}
