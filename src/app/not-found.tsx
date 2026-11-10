import type { Metadata } from "next";
import { ButtonLink } from "@/components/button";
import { BrandMark } from "@/components/site-chrome";
export const metadata: Metadata = {title:"Page not found", description:"This page is missing. Start a new pill check or explore a saved sample.", robots:{index:false}};
export default function NotFound() {
  return <div className="mx-auto max-w-2xl px-5 pt-16"><BrandMark className="mb-6 h-16 w-14"/><h1 className="text-4xl font-bold">We couldn’t find that page.</h1><p className="mt-5 text-lg text-ink-soft">The link may be old or incomplete. Your next check can start here.</p><div className="mt-8 flex flex-wrap gap-3"><ButtonLink href="/check">Check a bottle</ButtonLink><ButtonLink href="/samples" variant="secondary">Try a sample</ButtonLink></div></div>;
}
