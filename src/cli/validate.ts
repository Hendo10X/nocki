import { loadConfig, ConfigError } from "../config/parse.ts";
import { buildGraph, detectCycle, topoLevels, CycleError } from "../graph/graph.ts";
import { FG, DIM, RESET, BOLD, colorize } from "../util/colors.ts";

export async function runValidate(configPath: string): Promise<number> {
  let config;
  try {
    config = await loadConfig(configPath);
  } catch (e) {
    if (e instanceof ConfigError) {
      console.error(colorize(FG.red, `✗ ${e.message}`));
      return 1;
    }
    throw e;
  }

  const graph = buildGraph(config);
  try {
    detectCycle(graph);
  } catch (e) {
    if (e instanceof CycleError) {
      console.error(colorize(FG.red, `✗ ${e.message}`));
      return 1;
    }
    throw e;
  }

  const levels = topoLevels(graph);
  const count = Object.keys(config.services).length;

  console.log(colorize(FG.green, `✓ nocki.yaml is valid (${count} services).`));
  console.log(`\n${BOLD}Boot order:${RESET}`);
  levels.forEach((level, i) => {
    const parallel = level.length > 1 ? `  ${DIM}(parallel)${RESET}` : "";
    console.log(`  ${DIM}Level ${i}:${RESET} ${level.join(", ")}${parallel}`);
  });

  return 0;
}
