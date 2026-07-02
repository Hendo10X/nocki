import { highlight } from "@/lib/shiki";
import { CopyButton } from "@/components/copy-button";
import { cn } from "@/lib/utils";

export async function CodeBlock({
  code,
  lang = "bash",
  filename,
  className,
}: {
  code: string;
  lang?: string;
  filename?: string;
  className?: string;
}) {
  const html = await highlight(code.trim(), lang);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card/60",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-2">
        <span className="font-mono text-xs text-muted-foreground">
          {filename ?? lang}
        </span>
        <CopyButton value={code.trim()} className="-mr-2" />
      </div>
      <div
        className="overflow-x-auto p-4 text-[13px] leading-relaxed [&_pre]:!bg-transparent [&_pre]:font-mono"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
