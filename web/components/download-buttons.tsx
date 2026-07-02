"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { AppleIcon, Download01Icon, ArrowDown01Icon, ArrowUpRight01Icon } from "@hugeicons/core-free-icons";
import { downloads, site } from "@/lib/site";
import { cn } from "@/lib/utils";

function LinuxGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2c-2.2 0-3.7 1.8-3.7 4.2 0 1.2.1 2.2-.5 3.3-.5.9-1.6 2-2.4 3.6-.5 1-.9 2-.6 2.8.2.6.8.9.6 1.7-.3 1-.9 1.9-.4 2.7.5.8 1.8.7 3 .7.7 0 1.2.3 2 .8.6.4 1.5.6 2.4.4.9-.2 1.5-.8 2-1.3.6-.6 1.6-.7 2.4-1.2.9-.6.9-1.6.6-2.4-.3-.7.2-1.1.4-1.8.3-.9-.2-1.9-.8-2.9-.9-1.5-1.9-2.6-2.3-3.5-.5-1.1-.4-2.1-.4-3.4C15.3 3.8 14 2 12 2Zm-1.6 4.1c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9Zm3.2 0c.4 0 .7.4.7.9s-.3.9-.7.9-.7-.4-.7-.9.3-.9.7-.9Zm-1.6 2.3c.9 0 1.9.5 1.9 1 0 .3-.5.4-1 .7-.4.2-.6.5-.9.5s-.5-.3-.9-.5c-.5-.3-1-.4-1-.7 0-.5 1-1 1.9-1Z" />
    </svg>
  );
}

type Opt = { label: string; url: string };

function DownloadMenu({ label, icon, options }: { label: string; icon: ReactNode; options: Opt[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-center gap-2.5 rounded-xl border border-border bg-card/70 px-5 py-3.5 font-medium transition-colors",
          "hover:border-primary/40 hover:bg-card focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        )}
      >
        {icon}
        <span>Download for {label}</span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={16}
          strokeWidth={2}
          className={cn("text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-xl border border-border bg-popover p-1"
        >
          {options.map((o) => (
            <a
              key={o.url}
              href={o.url}
              role="menuitem"
              className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5"
            >
              <span>{o.label}</span>
              <HugeiconsIcon icon={Download01Icon} size={15} strokeWidth={1.8} className="text-muted-foreground" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function DownloadButtons() {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <DownloadMenu
          label="macOS"
          icon={<HugeiconsIcon icon={AppleIcon} size={18} strokeWidth={1.8} />}
          options={[
            { label: "Apple Silicon (arm64)", url: downloads["mac-arm"].url },
            { label: "Intel (x64)", url: downloads["mac-intel"].url },
          ]}
        />
        <DownloadMenu
          label="Linux"
          icon={<LinuxGlyph className="size-[18px]" />}
          options={[
            { label: "x64", url: downloads["linux-x64"].url },
            { label: "arm64", url: downloads["linux-arm"].url },
          ]}
        />
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Windows isn&apos;t supported natively yet; run nocki under{" "}
        <span className="text-foreground">WSL2</span>, or{" "}
        <a
          href={site.releases}
          target="_blank"
          rel="noreferrer"
          className="text-foreground underline decoration-border underline-offset-4 hover:decoration-primary"
        >
          browse all releases
          <HugeiconsIcon icon={ArrowUpRight01Icon} size={12} className="ml-0.5 inline align-middle" />
        </a>
        .
      </p>
    </div>
  );
}
