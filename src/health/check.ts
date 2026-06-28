import { Socket } from "node:net";
import type { HealthCheck } from "../types.ts";

export type ProbeResult = { ok: true } | { ok: false; reason: string };

export async function probe(check: HealthCheck): Promise<ProbeResult> {
  switch (check.type) {
    case "none":
      return { ok: true };
    case "http":
      return httpProbe(check.url);
    case "tcp":
      return tcpProbe(check.host, check.port);
    case "cmd":
      return cmdProbe(check.cmd);
  }
}

async function httpProbe(url: string): Promise<ProbeResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, redirect: "manual" });
    clearTimeout(timer);
    if (res.status >= 200 && res.status < 300) return { ok: true };
    return { ok: false, reason: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

function tcpProbe(host: string, port: number): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let settled = false;
    const done = (result: ProbeResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(5000);
    socket.once("connect", () => done({ ok: true }));
    socket.once("timeout", () => done({ ok: false, reason: "connection timed out" }));
    socket.once("error", (err) => done({ ok: false, reason: err.message }));
    socket.connect(port, host);
  });
}

async function cmdProbe(cmd: string): Promise<ProbeResult> {
  try {
    const proc = Bun.spawn(["sh", "-c", cmd], {
      stdout: "ignore",
      stderr: "ignore",
    });
    const exitCode = await proc.exited;
    return exitCode === 0
      ? { ok: true }
      : { ok: false, reason: `exit code ${exitCode}` };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

export type HealthOutcome =
  | { healthy: true; elapsedMs: number }
  | { healthy: false; elapsedMs: number; reason: string };

export async function waitForHealthy(
  check: HealthCheck,
  startedAt: number,
  signal?: AbortSignal,
): Promise<HealthOutcome> {
  if (check.type === "none") {
    return { healthy: true, elapsedMs: 0 };
  }

  const deadline = startedAt + check.timeoutMs;
  let lastReason = "no successful probe";

  while (Date.now() < deadline) {
    if (signal?.aborted) {
      return { healthy: false, elapsedMs: Date.now() - startedAt, reason: "aborted" };
    }

    const result = await probe(check);
    if (result.ok) {
      return { healthy: true, elapsedMs: Date.now() - startedAt };
    }
    lastReason = result.reason;

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await sleep(Math.min(check.intervalMs, remaining), signal);
  }

  return {
    healthy: false,
    elapsedMs: Date.now() - startedAt,
    reason: lastReason,
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}
