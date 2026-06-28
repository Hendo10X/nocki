import { mkdir } from "node:fs/promises";
import type { LogBus } from "./bus.ts";

export class LogPersister {
  private streams = new Map<string, ReturnType<ReturnType<typeof Bun.file>["writer"]>>();
  private readonly dir: string;
  private task: Promise<void> | null = null;

  constructor(
    private readonly bus: LogBus,
    sessionId: string,
    baseDir = ".nocki/logs",
  ) {
    this.dir = `${baseDir}/${sessionId}`;
  }

  get directory(): string {
    return this.dir;
  }

  async start(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    this.task = this.run();
  }

  private writerFor(service: string) {
    let w = this.streams.get(service);
    if (!w) {
      const file = Bun.file(`${this.dir}/${service}.log`);
      w = file.writer();
      this.streams.set(service, w);
    }
    return w;
  }

  private async run(): Promise<void> {
    for await (const entry of this.bus.subscribe()) {
      if (!entry.service) continue;
      const w = this.writerFor(entry.service);
      const ts = entry.timestamp.toISOString();
      w.write(`${ts} [${entry.stream}] ${entry.line}\n`);
    }
  }

  async close(): Promise<void> {
    await this.task;
    for (const w of this.streams.values()) {
      try {
        await w.flush();
        await w.end();
      } catch {}
    }
  }
}
