import { expect, test, describe, afterEach } from "bun:test";
import { Orchestrator, BootError } from "../src/core/orchestrator.ts";
import { validateConfig } from "../src/config/parse.ts";
import type { Config } from "../src/types.ts";

const FIX = `${import.meta.dir.replaceAll("\\", "/")}/fixtures`;

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

let active: Orchestrator | null = null;

afterEach(async () => {
  if (active) {
    await active.stopAll();
    active = null;
  }
});

function makeConfig(services: Record<string, unknown>): Config {
  return validateConfig({ version: 1, services });
}

function start(config: Config): Orchestrator {
  active = new Orchestrator(config);
  return active;
}

function pickFreePort(): number {
  const listener = Bun.listen({
    hostname: "127.0.0.1",
    port: 0,
    socket: { open() {}, data() {}, error() {} },
  });
  const port = listener.port;
  listener.stop(true);
  return port;
}

async function bindable(port: number): Promise<boolean> {
  try {
    const listener = Bun.listen({
      hostname: "127.0.0.1",
      port,
      socket: { open() {}, data() {}, error() {} },
    });
    listener.stop(true);
    return true;
  } catch {
    return false;
  }
}

async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await Bun.sleep(100);
  }
  throw new Error(`timed out waiting for: ${label}`);
}

function httpService(over: Record<string, unknown> = {}): Record<string, unknown> {
  const port = (over.__port as number) ?? pickFreePort();
  delete over.__port;
  return {
    cmd: `bun run ${FIX}/http-server.ts`,
    env: { PORT: String(port), ...(over.env as object) },
    health_check: { http: `http://localhost:${port}/health`, timeout: "15s", interval: "200ms" },
    ...over,
  };
}

function tcpService(port: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    cmd: `bun run ${FIX}/tcp-listener.ts`,
    env: { PORT: String(port) },
    health_check: { tcp: port, timeout: "15s", interval: "200ms" },
    ...over,
  };
}

function longService(label: string, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    cmd: `bun run ${FIX}/longrunner.ts`,
    env: { LABEL: label },
    ...over,
  };
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe("boot sequencing", () => {
  test(
    "boots services in dependency order and reports healthy",
    async () => {
      const config = makeConfig({
        a: httpService(),
        b: httpService({ depends_on: ["a"] }),
      });
      const orch = start(config);
      await orch.start();

      const a = orch.get("a")!;
      const b = orch.get("b")!;
      expect(orch.effectiveStatus(a)).toBe("healthy");
      expect(orch.effectiveStatus(b)).toBe("healthy");
      // b must not have started before a was healthy.
      expect(b.startedAt!.getTime()).toBeGreaterThanOrEqual(a.startedAt!.getTime());
    },
    30_000,
  );

  test(
    "aborts boot and reports downstream impact when a health check fails",
    async () => {
      const deadPort = pickFreePort(); // nothing will listen here
      const config = makeConfig({
        gateway: longService("gateway", {
          health_check: { http: `http://localhost:${deadPort}/health`, timeout: "2s", interval: "300ms" },
        }),
        downstream: longService("downstream", { depends_on: ["gateway"] }),
      });
      const orch = start(config);

      let err: unknown;
      try {
        await orch.start();
      } catch (e) {
        err = e;
      }

      expect(err).toBeInstanceOf(BootError);
      expect((err as BootError).failed).toBe("gateway");
      expect((err as BootError).notStarted).toContain("downstream");
      expect(orch.get("downstream")!.status).toBe("pending");
    },
    30_000,
  );

  test(
    "single-service start resolves only that service and its dependencies",
    async () => {
      const config = makeConfig({
        a: longService("a"),
        b: longService("b", { depends_on: ["a"] }),
        c: longService("c"), // independent, should stay pending
      });
      const orch = start(config);
      await orch.start(["b"]);

      expect(orch.get("a")!.status).not.toBe("pending");
      expect(orch.get("b")!.status).not.toBe("pending");
      expect(orch.get("c")!.status).toBe("pending");
    },
    30_000,
  );
});

describe("supervision", () => {
  test(
    "restarts a service that crashes (on-failure policy)",
    async () => {
      const config = makeConfig({
        flaky: {
          cmd: `bun run ${FIX}/crasher.ts`,
          env: { LIVE_MS: "150", EXIT_CODE: "1" },
          restart: { policy: "on-failure", max_attempts: 50, window: "60s" },
        },
      });
      const orch = start(config);
      await orch.start();

      await waitFor(() => orch.get("flaky")!.restarts >= 2, 15_000, "flaky restarts >= 2");
      expect(orch.get("flaky")!.restarts).toBeGreaterThanOrEqual(2);
    },
    30_000,
  );

  test(
    "marks degraded past the restart ceiling and propagates to dependents",
    async () => {
      const config = makeConfig({
        flaky: {
          cmd: `bun run ${FIX}/crasher.ts`,
          env: { LIVE_MS: "150", EXIT_CODE: "1" },
          restart: { policy: "on-failure", max_attempts: 2, window: "60s" },
        },
        consumer: longService("consumer", { depends_on: ["flaky"] }),
      });
      const orch = start(config);
      await orch.start();

      await waitFor(
        () => orch.effectiveStatus(orch.get("flaky")!) === "degraded",
        15_000,
        "flaky degraded",
      );

      expect(orch.get("flaky")!.status).toBe("degraded");
      const consumer = orch.get("consumer")!;
      expect(orch.effectiveStatus(consumer)).toBe("degraded");
      expect(consumer.degradedReason).toContain("flaky");
    },
    30_000,
  );
});

describe("teardown", () => {
  test(
    "reaps the whole process tree on stop — no orphaned port (regression)",
    async () => {
      const port = pickFreePort();
      const config = makeConfig({ server: tcpService(port) });
      const orch = start(config);
      await orch.start();

      expect(orch.effectiveStatus(orch.get("server")!)).toBe("healthy");
      // Port is held by the service while running.
      expect(await bindable(port)).toBe(false);

      await orch.stopAll();
      active = null; // already stopped

      // After stop the port must be released (allow brief OS lag).
      await waitFor(() => bindable(port), 8_000, "port released after stop");
      expect(await bindable(port)).toBe(true);
    },
    30_000,
  );
});
