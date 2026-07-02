"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AppleIcon, Download04Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { downloads, site, type OSKey } from "@/lib/site";
import { cn } from "@/lib/utils";

function LinuxGlyph({ className }: { className?: string }) {
  // hugeicons' free set has no Linux mark, so a compact penguin.
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2c-2.2 0-3.7 1.8-3.7 4.2 0 1.2.1 2.2-.5 3.3-.5.9-1.6 2-2.4 3.6-.5 1-.9 2-.6 2.8.2.6.8.9.6 1.7-.3 1-.9 1.9-.4 2.7.5.8 1.8.7 3 .7.7 0 1.2.3 2 .8.6.4 1.5.6 2.4.4.9-.2 1.5-.8 2-1.3.6-.6 1.6-.7 2.4-1.2.9-.6.9-1.6.6-2.4-.3-.7.2-1.1.4-1.8.3-.9-.2-1.9-.8-2.9-.9-1.5-1.9-2.6-2.3-3.5-.5-1.1-.4-2.1-.4-3.4C15.3 3.8 14 2 12 2Zm-1.6 4.1c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9Zm3.2 0c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9Zm-1.6 2.3c.9 0 1.9.5 1.9 1 0 .3-.5.4-1 .7-.4.2-.6.5-.9.5s-.5-.3-.9-.5c-.5-.3-1-.4-1-.7 0-.5 1-1 1.9-1Z" />
    </svg>
  );
}

function detect(): OSKey {
  if (typeof navigator === "undefined") return "mac-arm";
  const ua = navigator.userAgent;
  const uaPlatform = (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform;
  const p = `${uaPlatform ?? ""} ${ua}`.toLowerCase();

  if (/android/.test(p)) return "linux-x64";
  if (/mac|iphone|ipad|ipod/.test(p)) return "mac-arm";
  if (/win/.test(p)) return "windows";
  if (/linux|x11/.test(p)) {
    return /aarch64|arm64|armv8/.test(p) ? "linux-arm" : "linux-x64";
  }
  return "mac-arm";
}

function OSIcon({ os, className }: { os: OSKey; className?: string }) {
  if (os === "mac-arm" || os === "mac-intel") {
    return <HugeiconsIcon icon={AppleIcon} size={18} strokeWidth={1.8} className={className} />;
  }
  return <LinuxGlyph className={cn("size-[18px]", className)} />;
}

export function DownloadButtons() {
  const [os, setOs] = useState<OSKey | null>(null);
  useEffect(() => setOs(detect()), []);

  const isWindows = os === "windows";
  const primaryKey: Exclude<OSKey, "windows"> =
    os && os !== "windows" ? os : "mac-arm";
  const primary = downloads[primaryKey];

  const others = (Object.keys(downloads) as Array<Exclude<OSKey, "windows">>).filter(
    (k) => k !== primaryKey,
  );

  return (
    <div className="w-full">
      {/* Primary, platform-aware recommendation */}
      <a
        href={primary.url}
        className={cn(
          "group flex items-center justify-between gap-4 rounded-xl border border-border bg-card/70 px-5 py-4 ring-top transition-colors",
          "hover:border-primary/40 hover:bg-card",
        )}
      >
        <span className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-white/5 text-foreground">
            <OSIcon os={primaryKey} />
          </span>
          <span className="flex flex-col">
            <span className="text-sm text-muted-foreground">
              {os === null ? "Download" : "Recommended for you"}
            </span>
            <span className="font-medium">
              {primary.label}{" "}
              <span className="text-muted-foreground">· {primary.sub}</span>
            </span>
          </span>
        </span>
        <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground transition-transform group-hover:scale-105">
          <HugeiconsIcon icon={Download04Icon} size={18} strokeWidth={2} />
        </span>
      </a>

      {/* Everything else */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {others.map((k) => (
          <a
            key={k}
            href={downloads[k].url}
            className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card/40 px-3 py-2.5 text-sm transition-colors hover:border-border hover:bg-card/80"
          >
            <OSIcon os={k} className="text-muted-foreground" />
            <span className="flex flex-col leading-tight">
              <span>{downloads[k].label}</span>
              <span className="text-xs text-muted-foreground">{downloads[k].sub}</span>
            </span>
          </a>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {isWindows ? (
          <>
            Windows isn&apos;t supported natively yet — run nocki under{" "}
            <span className="text-foreground">WSL2</span>, or{" "}
          </>
        ) : (
          <>Prefer the terminal? </>
        )}
        <a href={site.releases} target="_blank" rel="noreferrer" className="text-foreground underline decoration-border underline-offset-4 hover:decoration-primary">
          browse all releases
          <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} className="ml-0.5 inline align-middle" />
        </a>
        .
      </p>
    </div>
  );
}
