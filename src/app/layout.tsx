import type { Metadata } from "next";
import { Anchor as Ship } from "@/ui/symbols";
import { Icon } from "@/ui";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "ShipOS — The Universal Submission Engine",
  description:
    "One URL. One Source of Truth. Every Artifact. Zero Lies. ShipOS turns a GitHub repo into a provenance-verified submission package: README, demo script, pitch deck, report, compliance pack.",
  keywords: [
    "ShipOS",
    "submission engine",
    "zero-trust",
    "provenance",
    "README generator",
    "pitch deck",
    "hackathon",
  ],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "ShipOS — The Universal Submission Engine",
    description:
      "Paste a GitHub repo. ShipOS verifies every claim against real commits and forges README, demo script, pitch deck, report and compliance pack — in one click.",
    siteName: "ShipOS",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ShipOS — The Universal Submission Engine",
    description: "One URL. One Source of Truth. Every Artifact. Zero Lies.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased"
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <div className="flex min-h-screen flex-col">
            {children}
            <footer className="mt-auto">
              <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 border-t border-outline-variant bg-surface-container-low px-4 py-5 text-center sm:flex-row sm:px-6 sm:text-left">
                <p className="flex items-center gap-2 text-body-sm text-on-surface-variant">
                  <Icon icon={Ship} size="sm" className="size-4 shrink-0 text-on-surface" />
                  <span>
                    <span className="font-semibold text-on-surface">ShipOS</span>
                    {" — Developers write code. ShipOS ships everything else. · The README is the Source of Truth."}
                  </span>
                </p>
                <p className="font-mono text-[11px] tracking-tight text-on-surface-variant">
                  Zero-Trust Provenance Engine · 10 Claws · 1,024+ Badges
                </p>
              </div>
            </footer>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
