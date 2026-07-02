"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { StarIcon } from "@hugeicons/core-free-icons";
import { site } from "@/lib/site";
import { cn } from "@/lib/utils";

function format(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

export function GitHubStars({ className }: { className?: string }) {
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch("https://api.github.com/repos/Hendo10X/nocki", {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d && typeof d.stargazers_count === "number") {
          setStars(d.stargazers_count);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  return (
    <a
      href={site.repo}
      target="_blank"
      rel="noreferrer"
      aria-label="Star nocki on GitHub"
      className={cn(
        "flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm transition-colors",
        "hover:border-primary/40 hover:bg-white/5 hover:text-foreground",
        className,
      )}
    >
      <HugeiconsIcon icon={StarIcon} size={15} strokeWidth={1.8} />
      <span>Star</span>
      {stars !== null && (
        <span className="tabular-nums text-muted-foreground">{format(stars)}</span>
      )}
    </a>
  );
}
