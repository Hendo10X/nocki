import { sendControl, NotRunningError } from "../control/client.ts";
import type { ServiceSnapshot } from "../control/protocol.ts";
import type { ServiceStatus } from "../types.ts";
import { FG, DIM, RESET, BOLD, colorize } from "../util/colors.ts";
import { formatDuration } from "../util/duration.ts";

const STATUS_DISPLAY: Record<ServiceStatus, { symbol: string; color: string }> = {
  pending: { symbol: "○", color: FG.grey },
  starting: { symbol: "◐", color: FG.yellow },
  healthy: { symbol: "●", color: FG.green },
  crashed: { symbol: "●", color: FG.red },
  degraded: { symbol: "◌", color: FG.grey },
  stopped: { symbol: "—", color: FG.grey },
};

export async function runStatus(json: boolean): Promise<number> {
  let services: ServiceSnapshot[];
  try {
    const res = await sendControl({ cmd: "status" });
    if (!res.ok || res.cmd !== "status") {
      console.error(colorize(FG.red, `✗ ${res.ok ? "unexpected response" : res.error}`));
      return 1;
    }
    services = res.services;
  } catch (e) {
    if (e instanceof NotRunningError) {
      console.error(colorize(FG.grey, e.message));
      return 1;
    }
    throw e;
  }

  if (json) {
    console.log(JSON.stringify(services, null, 2));
    return 0;
  }

  const nameWidth = Math.max(7, ...services.map((s) => s.name.length));
  console.log(
    `${BOLD}${"SERVICE".padEnd(nameWidth)}  STATUS     PID      UPTIME    RESTARTS${RESET}`,
  );
  for (const s of services) {
    const d = STATUS_DISPLAY[s.status];
    const status = colorize(d.color, `${d.symbol} ${s.status}`.padEnd(10));
    const pid = (s.pid?.toString() ?? "—").padEnd(8);
    const uptime = (s.uptimeMs != null ? formatDuration(s.uptimeMs) : "—").padEnd(9);
    const restarts = s.restarts.toString();
    let line = `${s.name.padEnd(nameWidth)}  ${status} ${pid} ${uptime} ${restarts}`;
    if (s.degradedReason) line += `  ${DIM}(${s.degradedReason})${RESET}`;
    console.log(line);
  }

  const anyDegraded = services.some((s) => s.status === "degraded" || s.status === "crashed");
  return anyDegraded ? 2 : 0;
}
