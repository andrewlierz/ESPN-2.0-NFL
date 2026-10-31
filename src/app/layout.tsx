import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Header } from "@/components/Header";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Every page shows the live score strip, so render on demand.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} – ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: "Live NFL scores, standings, team and player pages, plus advanced stats: pressures, snap counts, Next Gen Stats, EPA and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-page text-ink">
        <Header />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
        <footer className="border-t border-line bg-card">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted">
            <span>
              Data:{" "}
              <a className="underline hover:text-ink" href="https://github.com/nflverse" target="_blank" rel="noreferrer">
                nflverse
              </a>{" "}
              (play-by-play derived stats, PFR charting, Next Gen Stats, snap counts). Live scores & headlines via ESPN&apos;s public API when available.
            </span>
            <Link href="/glossary" className="underline hover:text-ink">
              Stat glossary
            </Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
