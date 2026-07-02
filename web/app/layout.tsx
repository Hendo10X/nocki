import type { Metadata } from "next";
import { JetBrains_Mono, Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";
import { RootProvider } from "fumadocs-ui/provider/next";
import "./globals.css";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const body = Hanken_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const SITE = "https://github.com/Hendo10X/nocki";

export const metadata: Metadata = {
  metadataBase: new URL("https://nocki.dev"),
  title: {
    default: "nocki — your development environment should start itself",
    template: "%s · nocki",
  },
  description:
    "A local development process orchestrator. Describe your services once; nocki handles boot ordering, health checks, supervision, crash recovery, and unified logs — all in your terminal.",
  keywords: ["process manager", "orchestrator", "local development", "cli", "bun", "devtools"],
  openGraph: {
    title: "nocki — your development environment should start itself",
    description:
      "Boot ordering, health checks, supervision, and unified logs for multi-service local development. One file, one command.",
    url: SITE,
    siteName: "nocki",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "nocki",
    description: "Your development environment should start itself.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${mono.variable} ${display.variable} ${body.variable}`}>
      <body className="font-sans">
        <RootProvider theme={{ enabled: false }}>{children}</RootProvider>
      </body>
    </html>
  );
}
