export type HealthCheck =
  | { type: "http"; url: string; timeoutMs: number; intervalMs: number }
  | { type: "tcp"; port: number; host: string; timeoutMs: number; intervalMs: number }
  | { type: "cmd"; cmd: string; timeoutMs: number; intervalMs: number }
  | { type: "none" };

export type RestartPolicyName = "always" | "on-failure" | "never";

export type RestartPolicy = {
  policy: RestartPolicyName;

  maxAttempts: number;
  windowMs: number;
};

export type Service = {
  name: string;
  cmd: string;
  cwd: string;
  port?: number;
  dependsOn: string[];
  env: Record<string, string>;
  healthCheck: HealthCheck;
  restart: RestartPolicy;
};

export type Config = {
  version: number;
  services: Record<string, Service>;
};

export type ServiceStatus =
  | "pending"
  | "starting"
  | "healthy"
  | "degraded"
  | "crashed"
  | "stopped";

export type ProcessEntry = {
  service: Service;
  process: Bun.Subprocess | null;
  status: ServiceStatus;
  restarts: number;

  restartTimes: number[];
  startedAt: Date | null;
  lastExitCode: number | null;
  pid: number | null;

  degradedReason: string | null;
};

export type LogEntry = {
  service: string;
  stream: "stdout" | "stderr" | "system";
  line: string;
  timestamp: Date;
};
