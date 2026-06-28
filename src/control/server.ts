import { unlink } from "node:fs/promises";
import type { Orchestrator } from "../core/orchestrator.ts";
import {
  SOCKET_PATH,
  type ControlRequest,
  type ControlResponse,
  type ServiceSnapshot,
} from "./protocol.ts";

export class ControlServer {
  private server: ReturnType<typeof Bun.listen> | null = null;

  constructor(
    private readonly orch: Orchestrator,
    private readonly sessionId: string,
    private readonly onStop: () => void,
    private readonly socketPath = SOCKET_PATH,
  ) {}

  async start(): Promise<void> {

    try {
      await unlink(this.socketPath);
    } catch {}

    this.server = Bun.listen({
      unix: this.socketPath,
      socket: {
        data: (socket, data) => this.handle(socket, data.toString("utf8")),
      },
    });
  }

  private handle(socket: { write: (s: string) => void; end: () => void }, raw: string): void {
    let response: ControlResponse;
    try {
      const req = JSON.parse(raw.trim()) as ControlRequest;
      response = this.dispatch(req);
    } catch (e) {
      response = { ok: false, error: (e as Error).message };
    }
    socket.write(JSON.stringify(response) + "\n");
    socket.end();
  }

  private dispatch(req: ControlRequest): ControlResponse {
    switch (req.cmd) {
      case "status":
        return { ok: true, cmd: "status", sessionId: this.sessionId, services: this.snapshot() };
      case "restart":
        if (!this.orch.get(req.service)) {
          return { ok: false, error: `Unknown service "${req.service}".` };
        }
        void this.orch.restart(req.service).catch(() => {});
        return { ok: true, cmd: "restart", service: req.service };
      case "stop":

        queueMicrotask(() => this.onStop());
        return { ok: true, cmd: "stop" };
    }
  }

  private snapshot(): ServiceSnapshot[] {
    return this.orch.entries().map((e) => ({
      name: e.service.name,
      status: this.orch.effectiveStatus(e),
      pid: e.pid,
      restarts: e.restarts,
      uptimeMs: e.startedAt ? Date.now() - e.startedAt.getTime() : null,
      lastExitCode: e.lastExitCode,
      degradedReason: e.degradedReason,
    }));
  }

  async stop(): Promise<void> {
    this.server?.stop(true);
    try {
      await unlink(this.socketPath);
    } catch {}
  }
}
