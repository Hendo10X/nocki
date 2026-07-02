import Link from "next/link";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-5 py-10 text-sm text-muted-foreground sm:flex-row">
        <div className="flex items-center gap-2 font-semibold">
          <span className="font-display text-foreground">nocki</span>
          <span className="text-muted-foreground/60">· {site.version}</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/docs" className="transition-colors hover:text-foreground">
            Docs
          </Link>
          <a href={site.repo} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
            GitHub
          </a>
          <a href={site.releases} target="_blank" rel="noreferrer" className="transition-colors hover:text-foreground">
            Releases
          </a>
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-muted-foreground/50">
        built on Bun · MIT licensed
      </p>
    </footer>
  );
}
