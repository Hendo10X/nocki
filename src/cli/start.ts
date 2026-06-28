import { loadConfig } from "../config/parse.ts";
import { Orchestrator, BootError } from "../core/orchestrator.ts";
import { CycleError } from "../graph/graph.ts";
import { LogPersister } from "../log/persist.ts";
import { ControlServer } from "../control/server.ts";
import { Tui } from "../tui/app.ts";
import { FG, DIM, RESET, colorize } from "../util/colors.ts";
import type { LogEntry } from "../types.ts";

export type StartOptions = {
  configPath: string;
  targets: string[];
  noTui: boolean;
  ci: boolean;
};

function sessionId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("Z", "");
  return `${stamp}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function runStart(opts: StartOptions): Promise<number> {
  const config = await loadConfig(opts.configPath);

  let orch: Orchestrator;
  try {
    orch = new Orchestrator(config);
  } catch (e) {
    if (e instanceof CycleError) {
      console.error(colorize(FG.red, `✗ ${e.message}`));
      return 1;
    }
    throw e;
  }

  const session = sessionId();
  const persister = new LogPersister(orch.bus, session);
  await persister.start();

  let shuttingDown = false;
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await orch.stopAll();
    await control.stop();
    await persister.close();
  };

  const control = new ControlServer(orch, session, () => void shutdown(), undefined);
  await control.start();

  if (opts.noTui || opts.ci) {
    return runHeadless(orch, opts, shutdown);
  }

  const tui = new Tui(orch);
  process.on("SIGTERM", () => void shutdown().then(() => process.exit(0)));

  const bootPromise = orch.start(opts.targets).catch((e) => {
    orch.bus.system("nocki", e instanceof BootError ? e.message : String(e));
  });

  await tui.run();
  await bootPromise;
  await control.stop();
  await persister.close();
  return 0;
}

async function runHeadless(
  orch: Orchestrator,
  opts: StartOptions,
  shutdown: () => Promise<void>,
): Promise<number> {

  void (async () => {
    for await (const entry of orch.bus.subscribe()) {
      if (!entry.line && !entry.service) continue;
      process.stdout.write(formatPlain(entry, orch.colors) + "\n");
    }
  })();

  let signalled = false;
  const onSignal = () => {
    if (signalled) return;
    signalled = true;
    void shutdown().then(() => process.exit(0));
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);

  try {
    await orch.start(opts.targets);
  } catch (e) {
    const msg = e instanceof BootError ? e.message : String(e);
    console.error(colorize(FG.red, `✗ ${msg}`));
    await shutdown();
    return 1;
  }

  console.error(colorize(FG.green, "✓ All services healthy."));

  if (opts.ci) {

    console.error(colorize(DIM, "Running headless. Send SIGINT/SIGTERM to stop."));
  }

  await new Promise<void>(() => {});
  return 0;
}

function formatPlain(entry: LogEntry, colors: Map<string, string>): string {
  const color = colors.get(entry.service) ?? FG.white;
  const tag = entry.service ? colorize(color, `[${entry.service}]`) : "";
  let line = entry.line;
  if (entry.stream === "stderr") line = colorize(FG.red, line);
  if (entry.stream === "system") line = `${DIM}${line}${RESET}`;
  return `${tag} ${line}`.trimStart();
}
