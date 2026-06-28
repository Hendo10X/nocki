import { sendControl, NotRunningError } from "../control/client.ts";
import { FG, colorize } from "../util/colors.ts";

export async function runStop(): Promise<number> {
  try {
    const res = await sendControl({ cmd: "stop" });
    if (!res.ok) {
      console.error(colorize(FG.red, `✗ ${res.error}`));
      return 1;
    }
    console.log(colorize(FG.green, "✓ Stop requested. Services are shutting down."));
    return 0;
  } catch (e) {
    return handleControlError(e);
  }
}

export async function runRestart(service: string): Promise<number> {
  try {
    const res = await sendControl({ cmd: "restart", service });
    if (!res.ok) {
      console.error(colorize(FG.red, `✗ ${res.error}`));
      return 1;
    }
    console.log(colorize(FG.green, `✓ Restarting "${service}".`));
    return 0;
  } catch (e) {
    return handleControlError(e);
  }
}

function handleControlError(e: unknown): number {
  if (e instanceof NotRunningError) {
    console.error(colorize(FG.grey, e.message));
    return 1;
  }
  throw e;
}
