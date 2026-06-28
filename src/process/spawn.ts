import type { Service } from "../types.ts";
import type { LogBus } from "../log/bus.ts";

export type SpawnHandle = {
  process: Bun.Subprocess;
  pid: number;
};

export function spawnService(service: Service, bus: LogBus): SpawnHandle {
  const proc = Bun.spawn(["sh", "-c", service.cmd], {
    cwd: service.cwd,
    env: { ...process.env, ...service.env },
    stdout: "pipe",
    stderr: "pipe",
  });

  pipeStream(proc.stdout, service.name, "stdout", bus);
  pipeStream(proc.stderr, service.name, "stderr", bus);

  return { process: proc, pid: proc.pid };
}

async function pipeStream(
  stream: ReadableStream<Uint8Array> | number | undefined | null,
  service: string,
  kind: "stdout" | "stderr",
  bus: LogBus,
): Promise<void> {
  if (!stream || typeof stream === "number") return;

  const decoder = new TextDecoder();
  let pending = "";

  try {
    for await (const chunk of stream as ReadableStream<Uint8Array>) {
      pending += decoder.decode(chunk, { stream: true });
      let nl: number;
      while ((nl = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, nl).replace(/\r$/, "");
        pending = pending.slice(nl + 1);
        bus.emit({ service, stream: kind, line, timestamp: new Date() });
      }
    }

    const tail = pending.replace(/\r$/, "");
    if (tail.length > 0) {
      bus.emit({ service, stream: kind, line: tail, timestamp: new Date() });
    }
  } catch {}
}
