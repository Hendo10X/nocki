import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

export function InstallCommand({ command, className }: { command: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card/70 px-4 py-3 backdrop-blur",
        className,
      )}
    >
      <span aria-hidden className="select-none font-mono text-sm text-healthy">
        $
      </span>
      <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-[13px] text-foreground/90 sm:text-sm [scrollbar-width:none]">
        {command}
      </code>
      <CopyButton value={command} className="-mr-1 shrink-0" />
    </div>
  );
}
