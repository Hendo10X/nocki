import type { ServiceStatus } from "../types.ts";

export const SOCKET_PATH = ".nocki/control.sock";

export type ControlRequest =
  | { cmd: "status" }
  | { cmd: "stop" }
  | { cmd: "restart"; service: string };

export type ServiceSnapshot = {
  name: string;
  status: ServiceStatus;
  pid: number | null;
  restarts: number;
  uptimeMs: number | null;
  lastExitCode: number | null;
  degradedReason: string | null;
};

export type ControlResponse =
  | { ok: true; cmd: "status"; services: ServiceSnapshot[]; sessionId: string }
  | { ok: true; cmd: "stop" }
  | { ok: true; cmd: "restart"; service: string }
  | { ok: false; error: string };
