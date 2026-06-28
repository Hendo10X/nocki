import { findConfig } from "../config/parse.ts";
import { FG, DIM, RESET, BOLD, colorize } from "../util/colors.ts";

const TEMPLATE = `version: 1

services:
  # A dependency with a TCP health check.
  redis:
    cmd: redis-server
    port: 6379
    health_check:
      tcp: 6379
      timeout: 10s

  # An API that waits for redis, with an HTTP health check and restart policy.
  api:
    cmd: bun run dev
    cwd: ./apps/api
    depends_on: [redis]
    health_check:
      http: http://localhost:3001/health
      timeout: 30s
    restart:
      policy: on-failure
      max_attempts: 3
      window: 60s
    env:
      NODE_ENV: development

  # A worker that always restarts and boots after the api.
  worker:
    cmd: bun run worker
    cwd: ./apps/worker
    depends_on: [api]
    restart:
      policy: always

  # A web frontend that boots after the api (in parallel with the worker).
  web:
    cmd: bun run dev
    cwd: ./apps/web
    depends_on: [api]
`;

async function prompt(question: string, fallback = ""): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim() || fallback;
  }
  return fallback;
}

export async function runInit(targetDir = "."): Promise<number> {
  const existing = await findConfig(targetDir);
  if (existing) {
    console.error(colorize(FG.red, `✗ A config already exists at ${existing}.`));
    return 1;
  }

  const outPath = `${targetDir}/nocki.yaml`;

  if (!process.stdin.isTTY) {
    await Bun.write(outPath, TEMPLATE);
    console.log(colorize(FG.green, `✓ Wrote template ${outPath}.`));
    return 0;
  }

  console.log(`${BOLD}${colorize(FG.cyan, "nocki init")}${RESET}`);
  console.log(`${DIM}Scaffold a nocki.yaml. Press enter to accept defaults.${RESET}\n`);

  const countRaw = await prompt(`How many services? ${DIM}(default 1)${RESET} `, "1");
  const count = Math.max(1, Math.min(20, Number(countRaw) || 1));

  const lines: string[] = ["version: 1", "", "services:"];
  let previous: string | null = null;

  for (let i = 0; i < count; i++) {
    console.log(colorize(DIM, `\n— service ${i + 1} of ${count} —`));
    const name = await prompt(`  name ${DIM}(default svc${i + 1})${RESET}: `, `svc${i + 1}`);
    const cmd = await prompt(`  cmd ${DIM}(e.g. "bun run dev")${RESET}: `, "echo hello");
    const cwd = await prompt(`  cwd ${DIM}(default .)${RESET}: `, ".");
    const deps =
      previous &&
      (await prompt(`  depends on "${previous}"? ${DIM}(y/N)${RESET} `, "n"))
        .toLowerCase()
        .startsWith("y");

    lines.push(`  ${name}:`);
    lines.push(`    cmd: ${cmd}`);
    if (cwd !== ".") lines.push(`    cwd: ${cwd}`);
    if (deps && previous) lines.push(`    depends_on: [${previous}]`);
    previous = name;
  }

  lines.push("");
  await Bun.write(outPath, lines.join("\n"));
  console.log(colorize(FG.green, `\n✓ Wrote ${outPath}. Run \`nocki validate\` to check it.`));
  return 0;
}
