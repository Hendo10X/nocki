import { expect, test, describe } from "bun:test";
import { validateConfig, ConfigError } from "../src/config/parse.ts";

describe("validateConfig", () => {
  test("parses a full valid config", () => {
    const config = validateConfig({
      version: 1,
      services: {
        redis: { cmd: "redis-server", port: 6379, health_check: { tcp: 6379, timeout: "10s" } },
        api: {
          cmd: "bun run dev",
          cwd: "./apps/api",
          depends_on: ["redis"],
          health_check: { http: "http://localhost:3001/health", timeout: "30s" },
          restart: { policy: "on-failure", max_attempts: 3, window: "60s" },
          env: { NODE_ENV: "development" },
        },
      },
    });

    expect(Object.keys(config.services)).toEqual(["redis", "api"]);
    expect(config.services.redis.healthCheck).toEqual({
      type: "tcp",
      host: "localhost",
      port: 6379,
      timeoutMs: 10_000,
      intervalMs: 1000,
    });
    expect(config.services.api.dependsOn).toEqual(["redis"]);
    expect(config.services.api.restart.windowMs).toBe(60_000);
    expect(config.services.api.env.NODE_ENV).toBe("development");
  });

  test("defaults: no health check, never restart", () => {
    const config = validateConfig({ services: { a: { cmd: "x" } } });
    expect(config.services.a.healthCheck).toEqual({ type: "none" });
    expect(config.services.a.restart.policy).toBe("never");
  });

  test("requires cmd", () => {
    expect(() => validateConfig({ services: { a: {} } })).toThrow(ConfigError);
  });

  test("rejects unknown depends_on target", () => {
    expect(() =>
      validateConfig({ services: { a: { cmd: "x", depends_on: ["ghost"] } } }),
    ).toThrow(/unknown service "ghost"/);
  });

  test("rejects self-dependency", () => {
    expect(() =>
      validateConfig({ services: { a: { cmd: "x", depends_on: ["a"] } } }),
    ).toThrow(/cannot depend on itself/);
  });

  test("rejects multiple health check kinds", () => {
    expect(() =>
      validateConfig({
        services: { a: { cmd: "x", health_check: { http: "http://x", tcp: 1 } } },
      }),
    ).toThrow(/only specify one of/);
  });

  test("rejects bad restart policy", () => {
    expect(() =>
      validateConfig({ services: { a: { cmd: "x", restart: { policy: "sometimes" } } } }),
    ).toThrow(/restart.policy must be/);
  });

  test("collects multiple issues", () => {
    try {
      validateConfig({ services: { a: {}, b: { cmd: "x", depends_on: ["ghost"] } } });
      throw new Error("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).issues.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("rejects non-object top level", () => {
    expect(() => validateConfig("nope")).toThrow(ConfigError);
    expect(() => validateConfig({ version: 1 })).toThrow(/services. is required/);
  });
});
