import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Mono, Inter } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import "./globals.css";
import "./home.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Mono only for things read character by character: imprints, NDC codes, strengths.
const atkinsonMono = Atkinson_Hyperlegible_Mono({
  variable: "--font-atkinson-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://getsecondlook.vercel.app"),
  title: {
    default: "Second Look — is this the right pill?",
    template: "%s · Second Look",
  },
  description:
    "Take a photo of your pharmacy label and one pill. Second Look checks the pill against the FDA record for your medicine.",
  openGraph: { title: "Second Look: is this the right pill?", description: "AI reads the photos. Code compares the pill with real FDA records.", type: "website", images: [{url:"/social-card.png", width:1200, height:630, alt:"Is this the right pill? An FDA-record pill drawing beside Second Look’s amber bottle mark."}] },
  twitter: { card:"summary_large_image", title:"Second Look: is this the right pill?", description:"AI reads. FDA records. Code decides.", images:["/social-card.png"] },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${atkinsonMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-ink px-5 py-3 text-label focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
