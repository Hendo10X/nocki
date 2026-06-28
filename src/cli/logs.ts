import { readdir, stat } from "node:fs/promises";
import { FG, colorize } from "../util/colors.ts";

const LOG_ROOT = ".nocki/logs";

async function latestSession(): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(LOG_ROOT);
  } catch {
    return null;
  }
  let newest: { name: string; mtime: number } | null = null;
  for (const name of entries) {
    try {
      const s = await stat(`${LOG_ROOT}/${name}`);
      if (s.isDirectory() && (!newest || s.mtimeMs > newest.mtime)) {
        newest = { name, mtime: s.mtimeMs };
      }
    } catch {}
  }
  return newest?.name ?? null;
}

export async function runLogs(service: string, follow: boolean): Promise<number> {
  const session = await latestSession();
  if (!session) {
    console.error(colorize(FG.grey, "No log sessions found. Run `nocki start` first."));
    return 1;
  }

  const path = `${LOG_ROOT}/${session}/${service}.log`;
  const file = Bun.file(path);
  if (!(await file.exists())) {
    console.error(colorize(FG.grey, `No logs for service "${service}" in session ${session}.`));
    return 1;
  }

  process.stdout.write(await file.text());

  if (!follow) return 0;

  let offset = file.size;
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => resolve());
    const tick = async () => {
      const f = Bun.file(path);
      const size = f.size;
      if (size > offset) {
        const chunk = await f.slice(offset, size).text();
        process.stdout.write(chunk);
        offset = size;
      }
      setTimeout(tick, 300);
    };
    void tick();
  });

  return 0;
}
