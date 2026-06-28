#!/usr/bin/env bun

import { findConfig, ConfigError } from "./config/parse.ts";
import { runStart } from "./cli/start.ts";
import { runValidate } from "./cli/validate.ts";
import { runStatus } from "./cli/status.ts";
import { runStop, runRestart } from "./cli/control-cmds.ts";
import { runLogs } from "./cli/logs.ts";
import { runInit } from "./cli/init.ts";
import { FG, DIM, RESET, BOLD, colorize } from "./util/colors.ts";

const VERSION = "0.1.0";

const HELP = `${BOLD}nocki${RESET} — local development process orchestrator

${BOLD}USAGE${RESET}
  nocki <command> [options]

${BOLD}COMMANDS${RESET}
  start [service]     Start all services (or one + its dependencies)
  stop                Stop all running services
  restart <service>   Restart a named service
  status              Print status of all services (non-interactive)
  logs <service>      Print/tail logs for a service
  validate            Parse and validate nocki.yaml without starting
  init                Scaffold a nocki.yaml interactively

${BOLD}OPTIONS${RESET}
  -c, --config <path>   Path to config file (default: ./nocki.yaml)
      --no-tui          Run without the TUI; stream logs to stdout
      --ci              Headless mode for CI; exit 1 if boot fails
  -f, --follow          (logs) follow appended output
      --json            (status) emit JSON
  -h, --help            Show this help
  -v, --version         Show version

${DIM}Config lives at ./nocki.yaml and is committed to version control.${RESET}
`;

type Flags = {
  config?: string;
  noTui: boolean;
  ci: boolean;
  follow: boolean;
  json: boolean;
  help: boolean;
  version: boolean;
  positionals: string[];
};

function parseArgs(argv: string[]): Flags {
  const flags: Flags = {
    noTui: false,
    ci: false,
    follow: false,
    json: false,
    help: false,
    version: false,
    positionals: [],
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "-c":
      case "--config":
        flags.config = argv[++i];
        break;
      case "--no-tui":
        flags.noTui = true;
        break;
      case "--ci":
        flags.ci = true;
        break;
      case "-f":
      case "--follow":
        flags.follow = true;
        break;
      case "--json":
        flags.json = true;
        break;
      case "-h":
      case "--help":
        flags.help = true;
        break;
      case "-v":
      case "--version":
        flags.version = true;
        break;
      default:
        if (arg.startsWith("-")) {
          throw new Error(`Unknown option: ${arg}`);
        }
        flags.positionals.push(arg);
    }
  }

  return flags;
}

async function resolveConfig(explicit?: string): Promise<string> {
  if (explicit) return explicit;
  const found = await findConfig(".");
  return found ?? "nocki.yaml";
}

async function main(): Promise<number> {
  let flags: Flags;
  try {
    flags = parseArgs(Bun.argv.slice(2));
  } catch (e) {
    console.error(colorize(FG.red, `✗ ${(e as Error).message}`));
    console.error(`Run ${BOLD}nocki --help${RESET} for usage.`);
    return 1;
  }

  if (flags.version) {
    console.log(`nocki ${VERSION}`);
    return 0;
  }

  const [command, ...rest] = flags.positionals;

  if (!command || flags.help) {
    console.log(HELP);
    return command ? 0 : flags.help ? 0 : 1;
  }

  switch (command) {
    case "start":
      return runStart({
        configPath: await resolveConfig(flags.config),
        targets: rest,
        noTui: flags.noTui,
        ci: flags.ci,
      });

    case "validate":
      return runValidate(await resolveConfig(flags.config));

    case "status":
      return runStatus(flags.json);

    case "stop":
      return runStop();

    case "restart":
      if (!rest[0]) {
        console.error(colorize(FG.red, "✗ restart requires a service name."));
        return 1;
      }
      return runRestart(rest[0]);

    case "logs":
      if (!rest[0]) {
        console.error(colorize(FG.red, "✗ logs requires a service name."));
        return 1;
      }
      return runLogs(rest[0], flags.follow);

    case "init":
      return runInit(".");

    default:
      console.error(colorize(FG.red, `✗ Unknown command: ${command}`));
      console.error(`Run ${BOLD}nocki --help${RESET} for usage.`);
      return 1;
  }
}

try {
  process.exit(await main());
} catch (e) {
  if (e instanceof ConfigError) {
    console.error(colorize(FG.red, `✗ ${e.message}`));
    process.exit(1);
  }
  console.error(colorize(FG.red, `✗ Unexpected error: ${(e as Error).message}`));
  if (process.env.NOCKI_DEBUG) console.error((e as Error).stack);
  process.exit(1);
}
