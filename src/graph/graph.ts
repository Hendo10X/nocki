import type { Config } from "../types.ts";

export type DependencyGraph = {

  dependencies: Map<string, string[]>;

  dependents: Map<string, string[]>;
};

export class CycleError extends Error {
  constructor(
    message: string,
    public readonly cycle: string[],
  ) {
    super(message);
    this.name = "CycleError";
  }
}

export function buildGraph(config: Config): DependencyGraph {
  const dependencies = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();

  for (const name of Object.keys(config.services)) {
    dependencies.set(name, []);
    dependents.set(name, []);
  }

  for (const svc of Object.values(config.services)) {
    dependencies.set(svc.name, [...svc.dependsOn]);
    for (const dep of svc.dependsOn) {
      dependents.get(dep)!.push(svc.name);
    }
  }

  return { dependencies, dependents };
}

export function detectCycle(graph: DependencyGraph): void {
  const WHITE = 0;
  const GREY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  const stack: string[] = [];

  for (const node of graph.dependencies.keys()) color.set(node, WHITE);

  const visit = (node: string): void => {
    color.set(node, GREY);
    stack.push(node);

    for (const dep of graph.dependencies.get(node) ?? []) {
      const c = color.get(dep);
      if (c === GREY) {

        const start = stack.indexOf(dep);
        const cycle = [...stack.slice(start), dep];
        throw new CycleError(
          `Circular dependency detected: ${cycle.join(" → ")}`,
          cycle,
        );
      }
      if (c === WHITE) visit(dep);
    }

    stack.pop();
    color.set(node, BLACK);
  };

  for (const node of graph.dependencies.keys()) {
    if (color.get(node) === WHITE) visit(node);
  }
}

export function topoLevels(graph: DependencyGraph): string[][] {
  const indegree = new Map<string, number>();
  for (const [node, deps] of graph.dependencies) {
    indegree.set(node, deps.length);
  }

  const levels: string[][] = [];
  let frontier = [...indegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([node]) => node)
    .sort();

  const resolved = new Set<string>();

  while (frontier.length > 0) {
    levels.push(frontier);
    const next: string[] = [];

    for (const node of frontier) {
      resolved.add(node);
      for (const dependent of graph.dependents.get(node) ?? []) {
        const deg = indegree.get(dependent)! - 1;
        indegree.set(dependent, deg);
        if (deg === 0) next.push(dependent);
      }
    }

    frontier = next.sort();
  }

  if (resolved.size !== indegree.size) {
    const unresolved = [...indegree.keys()].filter((n) => !resolved.has(n));
    throw new CycleError(
      `Unresolvable dependencies (possible cycle) among: ${unresolved.join(", ")}`,
      unresolved,
    );
  }

  return levels;
}

export function dependencyClosure(graph: DependencyGraph, target: string): Set<string> {
  const closure = new Set<string>();
  const walk = (node: string): void => {
    if (closure.has(node)) return;
    closure.add(node);
    for (const dep of graph.dependencies.get(node) ?? []) walk(dep);
  };
  walk(target);
  return closure;
}

export function affectedDependents(graph: DependencyGraph, root: string): Set<string> {
  const affected = new Set<string>();
  const walk = (node: string): void => {
    for (const dependent of graph.dependents.get(node) ?? []) {
      if (affected.has(dependent)) continue;
      affected.add(dependent);
      walk(dependent);
    }
  };
  walk(root);
  return affected;
}
