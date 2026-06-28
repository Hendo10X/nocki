import { parse as parseYaml } from "yaml";
import { parseDuration } from "../util/duration.ts";
import type {
  Config,
  HealthCheck,
  RestartPolicy,
  RestartPolicyName,
  Service,
} from "../types.ts";

export const DEFAULT_CONFIG_FILES = ["nocki.yaml", "nocki.yml"];

const DEFAULT_HEALTH_TIMEOUT_MS = 30_000;
const DEFAULT_HEALTH_INTERVAL_MS = 1_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RESTART_WINDOW_MS = 60_000;

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly issues: string[] = [],
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

function fail(issues: string[]): never {
  const header =
    issues.length === 1
      ? "Invalid nocki.yaml:"
      : `Invalid nocki.yaml (${issues.length} issues):`;
  throw new ConfigError(
    `${header}\n${issues.map((i) => `  • ${i}`).join("\n")}`,
    issues,
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validateConfig(raw: unknown): Config {
  const issues: string[] = [];

  if (!isObject(raw)) {
    fail(["Top-level config must be a mapping (object)."]);
  }

  if (raw.version !== undefined && raw.version !== 1) {
    issues.push(`Unsupported version "${raw.version}". Only version 1 is supported.`);
  }

  if (!isObject(raw.services)) {
    fail([...issues, "`services` is required and must be a mapping of service definitions."]);
  }

  const serviceNames = Object.keys(raw.services);
  if (serviceNames.length === 0) {
    issues.push("`services` must define at least one service.");
  }

  const services: Record<string, Service> = {};

  for (const [name, rawSvc] of Object.entries(raw.services)) {
    const ctx = `service "${name}"`;

    if (!isObject(rawSvc)) {
      issues.push(`${ctx}: definition must be a mapping.`);
      continue;
    }

    if (typeof rawSvc.cmd !== "string" || rawSvc.cmd.trim() === "") {
      issues.push(`${ctx}: \`cmd\` is required and must be a non-empty string.`);
    }

    let cwd = ".";
    if (rawSvc.cwd !== undefined) {
      if (typeof rawSvc.cwd !== "string") {
        issues.push(`${ctx}: \`cwd\` must be a string path.`);
      } else {
        cwd = rawSvc.cwd;
      }
    }

    let port: number | undefined;
    if (rawSvc.port !== undefined) {
      if (typeof rawSvc.port !== "number" || !Number.isInteger(rawSvc.port)) {
        issues.push(`${ctx}: \`port\` must be an integer.`);
      } else {
        port = rawSvc.port;
      }
    }

    const dependsOn: string[] = [];
    if (rawSvc.depends_on !== undefined) {
      if (!Array.isArray(rawSvc.depends_on)) {
        issues.push(`${ctx}: \`depends_on\` must be a list of service names.`);
      } else {
        for (const dep of rawSvc.depends_on) {
          if (typeof dep !== "string") {
            issues.push(`${ctx}: \`depends_on\` entries must be strings.`);
          } else {
            dependsOn.push(dep);
          }
        }
      }
    }

    const env: Record<string, string> = {};
    if (rawSvc.env !== undefined) {
      if (!isObject(rawSvc.env)) {
        issues.push(`${ctx}: \`env\` must be a mapping of key/value pairs.`);
      } else {
        for (const [k, v] of Object.entries(rawSvc.env)) {
          if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") {
            issues.push(`${ctx}: env var "${k}" must be a string, number, or boolean.`);
          } else {
            env[k] = String(v);
          }
        }
      }
    }

    const healthCheck = parseHealthCheck(rawSvc.health_check, ctx, port, issues);
    const restart = parseRestart(rawSvc.restart, ctx, issues);

    services[name] = {
      name,
      cmd: typeof rawSvc.cmd === "string" ? rawSvc.cmd : "",
      cwd,
      port,
      dependsOn,
      env,
      healthCheck,
      restart,
    };
  }

  for (const svc of Object.values(services)) {
    for (const dep of svc.dependsOn) {
      if (!services[dep]) {
        issues.push(
          `service "${svc.name}": depends_on references unknown service "${dep}".`,
        );
      }
      if (dep === svc.name) {
        issues.push(`service "${svc.name}": cannot depend on itself.`);
      }
    }
  }

  if (issues.length > 0) fail(issues);

  return { version: 1, services };
}

function parseHealthCheck(
  raw: unknown,
  ctx: string,
  port: number | undefined,
  issues: string[],
): HealthCheck {
  if (raw === undefined) return { type: "none" };

  if (!isObject(raw)) {
    issues.push(`${ctx}: \`health_check\` must be a mapping.`);
    return { type: "none" };
  }

  let timeoutMs = DEFAULT_HEALTH_TIMEOUT_MS;
  let intervalMs = DEFAULT_HEALTH_INTERVAL_MS;
  try {
    if (raw.timeout !== undefined) timeoutMs = parseDuration(raw.timeout as string | number);
  } catch (e) {
    issues.push(`${ctx}: invalid health_check.timeout — ${(e as Error).message}`);
  }
  try {
    if (raw.interval !== undefined) intervalMs = parseDuration(raw.interval as string | number);
  } catch (e) {
    issues.push(`${ctx}: invalid health_check.interval — ${(e as Error).message}`);
  }

  const kinds = (["http", "tcp", "cmd"] as const).filter((k) => raw[k] !== undefined);
  if (kinds.length > 1) {
    issues.push(`${ctx}: health_check may only specify one of http/tcp/cmd.`);
  }

  if (raw.http !== undefined) {
    if (typeof raw.http !== "string") {
      issues.push(`${ctx}: health_check.http must be a URL string.`);
    } else {
      return { type: "http", url: raw.http, timeoutMs, intervalMs };
    }
  }

  if (raw.tcp !== undefined) {
    const tcpPort = typeof raw.tcp === "number" ? raw.tcp : port;
    if (typeof raw.tcp === "string") {

      const [host, p] = raw.tcp.split(":");
      const parsed = Number(p);
      if (!host || !Number.isInteger(parsed)) {
        issues.push(`${ctx}: health_check.tcp string must be "host:port".`);
      } else {
        return { type: "tcp", host, port: parsed, timeoutMs, intervalMs };
      }
    } else if (typeof tcpPort === "number" && Number.isInteger(tcpPort)) {
      return { type: "tcp", host: "localhost", port: tcpPort, timeoutMs, intervalMs };
    } else {
      issues.push(`${ctx}: health_check.tcp requires a port (number) or service \`port\`.`);
    }
  }

  if (raw.cmd !== undefined) {
    if (typeof raw.cmd !== "string") {
      issues.push(`${ctx}: health_check.cmd must be a shell command string.`);
    } else {
      return { type: "cmd", cmd: raw.cmd, timeoutMs, intervalMs };
    }
  }

  return { type: "none" };
}

function parseRestart(raw: unknown, ctx: string, issues: string[]): RestartPolicy {
  const fallback: RestartPolicy = {
    policy: "never",
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    windowMs: DEFAULT_RESTART_WINDOW_MS,
  };

  if (raw === undefined) return fallback;

  if (!isObject(raw)) {
    issues.push(`${ctx}: \`restart\` must be a mapping.`);
    return fallback;
  }

  let policy: RestartPolicyName = "never";
  const valid: RestartPolicyName[] = ["always", "on-failure", "never"];
  if (raw.policy !== undefined) {
    if (typeof raw.policy !== "string" || !valid.includes(raw.policy as RestartPolicyName)) {
      issues.push(`${ctx}: restart.policy must be one of ${valid.join(", ")}.`);
    } else {
      policy = raw.policy as RestartPolicyName;
    }
  }

  let maxAttempts = DEFAULT_MAX_ATTEMPTS;
  if (raw.max_attempts !== undefined) {
    if (typeof raw.max_attempts !== "number" || raw.max_attempts < 1) {
      issues.push(`${ctx}: restart.max_attempts must be a positive integer.`);
    } else {
      maxAttempts = raw.max_attempts;
    }
  }

  let windowMs = DEFAULT_RESTART_WINDOW_MS;
  if (raw.window !== undefined) {
    try {
      windowMs = parseDuration(raw.window as string | number);
    } catch (e) {
      issues.push(`${ctx}: invalid restart.window — ${(e as Error).message}`);
    }
  }

  return { policy, maxAttempts, windowMs };
}

export async function loadConfig(path: string): Promise<Config> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    throw new ConfigError(
      `Config file not found at "${path}". Run \`nocki init\` to scaffold one.`,
    );
  }

  let text: string;
  try {
    text = await file.text();
  } catch (e) {
    throw new ConfigError(`Could not read "${path}": ${(e as Error).message}`);
  }

  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (e) {
    throw new ConfigError(`YAML syntax error in "${path}": ${(e as Error).message}`);
  }

  return validateConfig(raw);
}

export async function findConfig(dir: string): Promise<string | null> {
  for (const name of DEFAULT_CONFIG_FILES) {
    const path = `${dir}/${name}`;
    if (await Bun.file(path).exists()) return path;
  }
  return null;
}
