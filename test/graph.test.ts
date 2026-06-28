import { expect, test, describe } from "bun:test";
import {
  buildGraph,
  detectCycle,
  topoLevels,
  dependencyClosure,
  affectedDependents,
  CycleError,
} from "../src/graph/graph.ts";
import { validateConfig } from "../src/config/parse.ts";
import type { Config } from "../src/types.ts";

function cfg(deps: Record<string, string[]>): Config {
  const services: Record<string, unknown> = {};
  for (const [name, d] of Object.entries(deps)) {
    services[name] = { cmd: "x", depends_on: d };
  }
  return validateConfig({ services });
}

describe("topoLevels", () => {
  test("computes boot levels with parallelism (PRD 5.2 example)", () => {
    const graph = buildGraph(cfg({ redis: [], api: ["redis"], worker: ["api"], web: ["api"] }));
    const levels = topoLevels(graph);
    expect(levels[0]).toEqual(["redis"]);
    expect(levels[1]).toEqual(["api"]);
    expect(levels[2].sort()).toEqual(["web", "worker"]);
  });

  test("independent services share level 0", () => {
    const graph = buildGraph(cfg({ a: [], b: [], c: [] }));
    expect(topoLevels(graph)).toEqual([["a", "b", "c"]]);
  });

  test("diamond dependency resolves", () => {
    const graph = buildGraph(cfg({ a: [], b: ["a"], c: ["a"], d: ["b", "c"] }));
    const levels = topoLevels(graph);
    expect(levels[0]).toEqual(["a"]);
    expect(levels[1].sort()).toEqual(["b", "c"]);
    expect(levels[2]).toEqual(["d"]);
  });
});

describe("detectCycle", () => {
  test("passes on a DAG", () => {
    const graph = buildGraph(cfg({ a: [], b: ["a"] }));
    expect(() => detectCycle(graph)).not.toThrow();
  });

  test("detects a 2-node cycle and names it", () => {

    const graph = buildGraph(cfg({ a: [], b: [] }));
    graph.dependencies.set("a", ["b"]);
    graph.dependencies.set("b", ["a"]);
    graph.dependents.set("a", ["b"]);
    graph.dependents.set("b", ["a"]);

    try {
      detectCycle(graph);
      throw new Error("expected cycle");
    } catch (e) {
      expect(e).toBeInstanceOf(CycleError);
      expect((e as CycleError).cycle).toContain("a");
      expect((e as CycleError).cycle).toContain("b");
    }
  });
});

describe("graph traversal", () => {
  test("dependencyClosure includes self and all prerequisites", () => {
    const graph = buildGraph(cfg({ redis: [], api: ["redis"], web: ["api"] }));
    expect([...dependencyClosure(graph, "web")].sort()).toEqual(["api", "redis", "web"]);
    expect([...dependencyClosure(graph, "redis")]).toEqual(["redis"]);
  });

  test("affectedDependents walks downstream (PRD 5.5 propagation)", () => {
    const graph = buildGraph(cfg({ api: [], worker: ["api"], web: ["api"], report: ["worker"] }));
    expect([...affectedDependents(graph, "api")].sort()).toEqual(["report", "web", "worker"]);
    expect([...affectedDependents(graph, "web")]).toEqual([]);
  });
});
