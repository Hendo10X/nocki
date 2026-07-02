"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { StatusDot, type Status } from "@/components/status-dot";
import { cn } from "@/lib/utils";

type Kind = "sys" | "out" | "ok";
type Log = { id: number; service: string; text: string; kind: Kind };

const SERVICES = ["cache", "api", "worker", "web"] as const;
type Service = (typeof SERVICES)[number];

const LABEL_COLOR: Record<Service | "nocki", string> = {
  cache: "text-cyan",
  api: "text-[#d8b4fe]",
  worker: "text-[#93c5fd]",
  web: "text-starting",
  nocki: "text-muted-foreground",
};

type Event = { after: number; sets?: [Service, Status][]; log?: [string, string, Kind] };

const SCRIPT: Event[] = [
  { after: 250, log: ["nocki", "starting services", "sys"] },
  { after: 220, sets: [["cache", "starting"]], log: ["cache", "redis-server", "sys"] },
  { after: 600, log: ["cache", "Ready to accept connections", "out"] },
  { after: 420, sets: [["cache", "healthy"]], log: ["cache", "healthy (0.4s)", "sys"] },
  { after: 260, sets: [["api", "starting"]], log: ["api", "bun run dev", "sys"] },
  { after: 420, log: ["api", "booting (NODE_ENV=development)", "out"] },
  { after: 640, log: ["api", "Server listening on :3001", "out"] },
  { after: 420, sets: [["api", "healthy"]], log: ["api", "healthy (2.1s)", "sys"] },
  {
    after: 260,
    sets: [["web", "starting"], ["worker", "starting"]],
    log: ["worker", "bun run worker", "sys"],
  },
  { after: 340, log: ["worker", "Connected to queue", "out"] },
  { after: 300, log: ["web", "▸ compiling…", "out"] },
  {
    after: 460,
    sets: [["worker", "healthy"], ["web", "healthy"]],
    log: ["web", "dev server ready on :3000", "out"],
  },
  { after: 340, log: ["worker", "Processing job #4821", "out"] },
  { after: 300, log: ["nocki", "✓ all services healthy", "ok"] },
];

const HOLD = 2600;

const FINAL_STATUS: Record<Service, Status> = {
  cache: "healthy",
  api: "healthy",
  worker: "healthy",
  web: "healthy",
};

function initialStatus(): Record<Service, Status> {
  return { cache: "pending", api: "pending", worker: "pending", web: "pending" };
}

export function BootTerminal() {
  const [statuses, setStatuses] = useState<Record<Service, Status>>(initialStatus);
  const [logs, setLogs] = useState<Log[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const idRef = useRef(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      setStatuses(FINAL_STATUS);
      setLogs(
        SCRIPT.filter((e) => e.log).map((e, i) => ({
          id: i,
          service: e.log![0],
          text: e.log![1],
          kind: e.log![2],
        })),
      );
      return;
    }

    const clearAll = () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };

    const run = () => {
      setStatuses(initialStatus());
      setLogs([]);
      let t = 0;
      for (const ev of SCRIPT) {
        t += ev.after;
        timers.current.push(
          setTimeout(() => {
            if (ev.sets) {
              setStatuses((prev) => {
                const next = { ...prev };
                for (const [svc, st] of ev.sets!) next[svc] = st;
                return next;
              });
            }
            if (ev.log) {
              const [service, text, kind] = ev.log;
              setLogs((prev) => [...prev, { id: idRef.current++, service, text, kind }]);
            }
          }, t),
        );
      }
      timers.current.push(setTimeout(run, t + HOLD));
    };

    run();
    return clearAll;
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card/80 backdrop-blur">
      {/* title bar */}
      <div className="flex items-center gap-2 border-b border-border/70 px-4 py-2.5">
        <span className="flex gap-1.5">
          <span className="size-3 rounded-full bg-crashed/70" />
          <span className="size-3 rounded-full bg-starting/70" />
          <span className="size-3 rounded-full bg-healthy/70" />
        </span>
        <span className="flex-1 text-center font-mono text-xs text-muted-foreground">
          nocki start
        </span>
        <span className="font-mono text-xs text-muted-foreground/50">~/app</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr]">
        {/* sidebar */}
        <div className="flex flex-row gap-3 border-b border-border/60 px-4 py-3 font-mono text-[13px] sm:flex-col sm:gap-2.5 sm:border-b-0 sm:border-r sm:py-4">
          {SERVICES.map((svc) => (
            <div key={svc} className="flex items-center gap-2">
              <StatusDot status={statuses[svc]} />
              <span
                className={cn(
                  "transition-colors duration-500",
                  statuses[svc] === "pending" ? "text-muted-foreground/40" : "text-foreground/90",
                )}
              >
                {svc}
              </span>
            </div>
          ))}
        </div>

        {/* log pane */}
        <div className="flex h-[248px] flex-col justify-end overflow-hidden px-4 py-3 font-mono text-[12.5px] leading-relaxed sm:h-[236px]">
          <AnimatePresence initial={false}>
            {logs.map((l) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={cn(
                  "flex gap-2 whitespace-pre",
                  l.kind === "ok" && "text-healthy",
                )}
              >
                {l.kind !== "ok" && (
                  <span className={cn("shrink-0", LABEL_COLOR[l.service as Service] ?? "text-muted-foreground")}>
                    [{l.service}]
                  </span>
                )}
                <span className={cn(l.kind === "sys" && "text-muted-foreground", l.kind === "out" && "text-foreground/80")}>
                  {l.text}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
          <span className="mt-1 h-4 w-2 bg-foreground/70 animate-blink" aria-hidden />
        </div>
      </div>
    </div>
  );
}
