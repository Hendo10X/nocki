import Link from "next/link";
import { site } from "@/lib/site";
import { GitHubStars } from "@/components/github-stars";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 bg-background/70 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-5xl items-center justify-between px-5">
        <Link href="/" className="font-display text-base">
          nocki
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
          <GitHubStars className="ml-1" />
        </div>
      </nav>
    </header>
  );
}
