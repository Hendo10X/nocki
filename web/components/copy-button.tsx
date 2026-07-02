"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

export function CopyButton({
  value,
  className,
  label = "Copy",
}: {
  value: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      className={cn(
        "grid size-8 place-items-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-white/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        className,
      )}
    >
      <HugeiconsIcon
        icon={copied ? Tick02Icon : Copy01Icon}
        size={16}
        strokeWidth={2}
        className={copied ? "text-healthy" : ""}
      />
    </button>
  );
}
