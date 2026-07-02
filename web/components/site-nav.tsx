import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { GithubIcon } from "@hugeicons/core-free-icons";
import { site } from "@/lib/site";
import { StatusDot } from "@/components/status-dot";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2 font-mono text-sm font-medium tracking-tight">
          <StatusDot status="healthy" />
          <span>nocki</span>
        </Link>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link
            href="/docs"
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-white/5 hover:text-foreground"
          >
            Docs
          </Link>
          <Link
            href={`${site.releases}/latest`}
            className="rounded-md px-3 py-1.5 transition-colors hover:bg-white/5 hover:text-foreground"
          >
            Releases
          </Link>
          <a
            href={site.repo}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="ml-1 grid size-9 place-items-center rounded-md transition-colors hover:bg-white/5 hover:text-foreground"
          >
            <HugeiconsIcon icon={GithubIcon} size={18} strokeWidth={1.8} />
          </a>
        </div>
      </nav>
    </header>
  );
}
