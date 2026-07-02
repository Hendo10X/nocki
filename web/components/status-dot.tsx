import { cn } from "@/lib/utils";

export type Status = "pending" | "starting" | "healthy" | "crashed" | "degraded" | "stopped";

const MAP: Record<Status, { glyph: string; className: string; pulse?: boolean }> = {
  pending: { glyph: "○", className: "text-degraded" },
  starting: { glyph: "◐", className: "text-starting", pulse: true },
  healthy: { glyph: "●", className: "text-healthy" },
  crashed: { glyph: "●", className: "text-crashed" },
  degraded: { glyph: "◌", className: "text-degraded" },
  stopped: { glyph: "—", className: "text-degraded" },
};

export function StatusDot({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  const { glyph, className: color, pulse } = MAP[status];
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block font-mono leading-none transition-colors duration-500",
        color,
        pulse && "animate-pulse",
        className,
      )}
    >
      {glyph}
    </span>
  );
}
