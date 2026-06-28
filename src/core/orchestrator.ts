import type { Config, ProcessEntry, ServiceStatus } from "../types.ts";
import {
  affectedDependents,
  buildGraph,
  dependencyClosure,
  detectCycle,
  topoLevels,
  type DependencyGraph,
} from "../graph/graph.ts";
import { spawnService, signalTree } from "../process/spawn.ts";
import { waitForHealthy } from "../health/check.ts";
import { LogBus } from "../log/bus.ts";
import { assignColors } from "../util/colors.ts";
import { formatDuration } from "../util/duration.ts";

export class BootError extends Error {
  constructor(
    message: string,
    public readonly failed: string,
    public readonly notStarted: string[],
  ) {
    super(message);
    this.name = "BootError";
  }
}

type ChangeListener = () => void;

export class Orchestrator {
  readonly bus = new LogBus();
  readonly colors: Map<string, string>;
  readonly graph: DependencyGraph;
  readonly levels: string[][];

  private registry = new Map<string, ProcessEntry>();
  private listeners = new Set<ChangeListener>();

  private intentionalStop = new Set<string>();
  private shuttingDown = false;
  private bootAbort = new AbortController();

  constructor(config: Config) {
    this.graph = buildGraph(config);
    detectCycle(this.graph);
    this.levels = topoLevels(this.graph);
    this.colors = assignColors(Object.keys(config.services));

    for (const svc of Object.values(config.services)) {
      this.registry.set(svc.name, {
        service: svc,
        process: null,
        status: "pending",
        restarts: 0,
        restartTimes: [],
        startedAt: null,
        lastExitCode: null,
        pid: null,
        roots: new Set(),
        degradedReason: null,
      });
    }
  }

  entries(): ProcessEntry[] {
    return [...this.registry.values()];
  }

  get(name: string): ProcessEntry | undefined {
    return this.registry.get(name);
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emitChange(): void {
    for (const l of this.listeners) l();
  }

  private setStatus(name: string, status: ServiceStatus): void {
    const entry = this.registry.get(name);
    if (!entry || entry.status === status) return;
    entry.status = status;
    this.emitChange();
  }

  effectiveStatus(entry: ProcessEntry): ServiceStatus {
    if (entry.status === "degraded") return "degraded";
    if (entry.degradedReason) return "degraded";
    return entry.status;
  }

  async start(targets?: string[]): Promise<void> {
    const selected = this.resolveTargets(targets);

    for (const level of this.levels) {
      const inLevel = level.filter((name) => selected.has(name));
      if (inLevel.length === 0) continue;

      const waits = inLevel.map((name) => this.bootOne(name));

      const results = await Promise.all(waits);
      const failure = results.find((r) => !r.ok);

      if (failure && !failure.ok) {
        const notStarted = this.downstreamNotStarted(failure.name, selected);
        this.bus.system(
          "nocki",
          `Boot aborted: "${failure.name}" failed health check (${failure.reason}).`,
        );
        if (notStarted.length > 0) {
          this.bus.system(
            "nocki",
            `Not started due to failure: ${notStarted.join(", ")}`,
          );
        }
        throw new BootError(
          `Service "${failure.name}" failed its health check (${failure.reason}). ` +
            (notStarted.length > 0
              ? `Downstream services not started: ${notStarted.join(", ")}.`
              : ""),
          failure.name,
          notStarted,
        );
      }
    }
  }

  private resolveTargets(targets?: string[]): Set<string> {
    if (!targets || targets.length === 0) {
      return new Set(this.registry.keys());
    }
    const selected = new Set<string>();
    for (const t of targets) {
      if (!this.registry.has(t)) {
        throw new Error(`Unknown service "${t}".`);
      }
      for (const dep of dependencyClosure(this.graph, t)) selected.add(dep);
    }
    return selected;
  }

  private downstreamNotStarted(failed: string, selected: Set<string>): string[] {
    return [...affectedDependents(this.graph, failed)]
      .filter((name) => selected.has(name))
      .filter((name) => {
        const s = this.registry.get(name)!.status;
        return s === "pending";
      });
  }

  private async bootOne(
    name: string,
  ): Promise<{ ok: true; name: string } | { ok: false; name: string; reason: string }> {
    const entry = this.registry.get(name)!;
    this.spawnAndSupervise(entry);
    this.bus.system(name, `Starting: ${entry.service.cmd}`);

    const outcome = await waitForHealthy(
      entry.service.healthCheck,
      entry.startedAt!.getTime(),
      this.bootAbort.signal,
    );

    if (outcome.healthy) {
      this.setStatus(name, "healthy");
      if (entry.service.healthCheck.type !== "none") {
        this.bus.system(name, `Healthy (${formatDuration(outcome.elapsedMs)}).`);
      }
      return { ok: true, name };
    }

    return { ok: false, name, reason: outcome.reason };
  }

  private spawnAndSupervise(entry: ProcessEntry): void {
    const handle = spawnService(entry.service, this.bus);
    entry.process = handle.process;
    entry.pid = handle.pid;
    entry.roots.add(handle.pid);
    entry.startedAt = new Date();
    entry.status = "starting";
    entry.degradedReason = null;
    this.emitChange();

    void handle.process.exited.then((exitCode) =>
      this.onExit(entry, exitCode, handle.pid),
    );
  }

  private onExit(entry: ProcessEntry, exitCode: number, pid: number): void {
    const name = entry.service.name;
    entry.roots.delete(pid);
    entry.lastExitCode = exitCode;
    // Only clear the live handle if this exit is for the current generation;
    // a stale generation exiting must not blank out a newer running process.
    if (entry.pid === pid) {
      entry.process = null;
      entry.pid = null;
    }

    if (this.intentionalStop.has(name) || this.shuttingDown) {
      // Keep the flag until every generation has exited so a lingering
      // straggler can't be misread as a crash and restarted.
      if (entry.roots.size === 0) this.intentionalStop.delete(name);
      this.setStatus(name, "stopped");
      return;
    }

    this.setStatus(name, "crashed");
    this.bus.system(name, `Exited with code ${exitCode}.`);

    if (this.shouldRestart(entry, exitCode)) {
      this.attemptRestart(entry);
    } else {

      if (entry.service.restart.policy === "never" && exitCode !== 0) {
        this.markDegraded(name);
      }
    }
  }

  private shouldRestart(entry: ProcessEntry, exitCode: number): boolean {
    switch (entry.service.restart.policy) {
      case "always":
        return true;
      case "on-failure":
        return exitCode !== 0;
      case "never":
        return false;
    }
  }

  private attemptRestart(entry: ProcessEntry): void {
    const name = entry.service.name;
    const { maxAttempts, windowMs } = entry.service.restart;
    const now = Date.now();

    entry.restartTimes = entry.restartTimes.filter((t) => now - t < windowMs);
    if (entry.restartTimes.length >= maxAttempts) {
      this.bus.system(
        name,
        `Restart ceiling reached (${maxAttempts} in ${formatDuration(windowMs)}). Marking degraded.`,
      );
      this.markDegraded(name);
      return;
    }

    entry.restartTimes.push(now);
    entry.restarts += 1;

    // Backoff before respawn: avoids crash-storms and gives the OS time to
    // release resources (e.g. a port) the previous generation held.
    const delay = Math.min(entry.restartTimes.length * 250, 2000);
    this.bus.system(
      name,
      `Restarting (attempt ${entry.restarts}) in ${formatDuration(delay)}.`,
    );

    setTimeout(() => {
      if (this.shuttingDown || this.intentionalStop.has(name)) return;
      this.spawnAndSupervise(entry);
      void this.watchHealthAfterRestart(entry);
    }, delay);
  }

  private async watchHealthAfterRestart(entry: ProcessEntry): Promise<void> {
    const name = entry.service.name;
    const startedAt = entry.startedAt!.getTime();
    const outcome = await waitForHealthy(entry.service.healthCheck, startedAt);

    if (entry.process === null) return;
    if (outcome.healthy) {
      this.setStatus(name, "healthy");
      this.clearDegradedRoot(name);
    }
  }

  private markDegraded(name: string): void {
    const entry = this.registry.get(name)!;
    entry.status = "degraded";
    this.recomputePropagation();
    this.emitChange();
  }

  private clearDegradedRoot(name: string): void {
    const entry = this.registry.get(name)!;
    if (entry.status === "degraded") {

      entry.status = "healthy";
    }
    this.recomputePropagation();
    this.emitChange();
  }

  private recomputePropagation(): void {
    for (const entry of this.registry.values()) entry.degradedReason = null;

    const roots = [...this.registry.values()]
      .filter((e) => e.status === "degraded")
      .map((e) => e.service.name);

    for (const root of roots) {
      for (const dependent of affectedDependents(this.graph, root)) {
        const entry = this.registry.get(dependent)!;
        if (entry.status === "degraded") continue;
        if (!entry.degradedReason) {
          entry.degradedReason = `upstream dependency ${root} is unhealthy`;
        }
      }
    }
  }

  async restart(name: string): Promise<void> {
    const entry = this.registry.get(name);
    if (!entry) throw new Error(`Unknown service "${name}".`);

    await this.killProcess(entry);
    entry.restartTimes = [];
    entry.status = "pending";
    this.bus.system(name, "Manual restart requested.");
    this.spawnAndSupervise(entry);
    void this.watchHealthAfterRestart(entry);
  }

  async kill(name: string): Promise<void> {
    const entry = this.registry.get(name);
    if (!entry) throw new Error(`Unknown service "${name}".`);
    this.intentionalStop.add(name);
    await this.killProcess(entry);
    this.setStatus(name, "stopped");
    this.bus.system(name, "Killed by user.");
  }

  async stopAll(): Promise<void> {
    this.shuttingDown = true;
    this.bootAbort.abort();

    for (const level of [...this.levels].reverse()) {
      await Promise.all(
        level.map(async (name) => {
          const entry = this.registry.get(name)!;
          if (entry.process || entry.roots.size > 0) {
            this.intentionalStop.add(name);
            await this.killProcess(entry);
            this.setStatus(name, "stopped");
          }
        }),
      );
    }

    this.bus.system("nocki", "All services stopped.");
    this.bus.close();
  }

  private async killProcess(entry: ProcessEntry, graceMs = 5000): Promise<void> {
    // Kill every tracked root, not just the current handle: a crash-storm can
    // leave a straggler generation whose tree still holds a port.
    const roots = [...entry.roots];
    const proc = entry.process;
    if (roots.length === 0 && !proc) return;
    const exited = proc?.exited ?? Promise.resolve(0);

    // Windows consoles don't handle a graceful close signal, so force-kill the
    // whole tree at once. taskkill /T reaps children that hold ports.
    if (process.platform === "win32") {
      for (const pid of roots) signalTree(pid, "SIGKILL");
      await exited;
      entry.roots.clear();
      return;
    }

    // POSIX: signal each process group (the child is a group leader because it
    // was spawned detached), so grandchildren that hold ports die too.
    for (const pid of roots) signalTree(pid, "SIGTERM");
    const timeout = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), graceMs),
    );
    const result = await Promise.race([exited.then(() => "exited" as const), timeout]);

    if (result === "timeout") {
      for (const pid of [...entry.roots]) signalTree(pid, "SIGKILL");
      await exited;
    }
    entry.roots.clear();
  }
}
