import Link from "next/link";
import { ButtonLink } from "./button";
import { cn } from "@/lib/utils";
export function BrandMark({className}:{className?:string}) {
  return <svg viewBox="0 0 28 32" aria-hidden className={cn("h-8 w-7",className)}><rect x="3" y="1.5" width="22" height="7" rx="2.5" fill="#1D1D1F"/><rect x="5" y="7" width="18" height="23.5" rx="4.5" fill="#FF9500"/><rect x="8" y="14" width="12" height="10" rx="2" fill="white"/><path d="M10 17h6m-6 4h8" stroke="#1D1D1F" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}
export function SiteHeader() {
  return <header className="site-header"><div className="nav-inner"><Link href="/" className="brand-link"><BrandMark/><span>Second Look</span></Link><nav aria-label="Main"><Link href="/samples" className="nav-text">Samples</Link><Link href="/research" className="nav-text desktop-link">Research</Link><Link href="/sources" className="nav-text desktop-link">Sources</Link><ButtonLink href="/check" size="sm">Check a pill</ButtonLink></nav></div></header>;
}
export function SiteFooter() {
  return <footer className="site-footer"><div><p>Second Look helps you spot a possible mix-up.<br className="sm:hidden"/> It doesn&apos;t replace your pharmacist.</p><nav aria-label="Footer"><Link href="/sources">Sources</Link><Link href="/research">Research</Link><Link href="/type">Type a check</Link><a href="https://github.com/Vedu-2011/second-look" target="_blank" rel="noreferrer">GitHub</a></nav></div><p className="footer-data">Real FDA and National Library of Medicine records. Always check with your pharmacist.</p></footer>;
}
