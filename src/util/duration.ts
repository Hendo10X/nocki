const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
};

export class DurationError extends Error {}

export function parseDuration(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) {
      throw new DurationError(`Invalid duration: ${input}`);
    }
    return Math.round(input * 1000);
  }

  const trimmed = input.trim();
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h)?$/.exec(trimmed);
  if (!match) {
    throw new DurationError(
      `Invalid duration "${input}". Use forms like "10s", "500ms", "2m", "1h".`,
    );
  }

  const value = Number(match[1]);
  const unit = match[2] ?? "s";
  return Math.round(value * UNIT_MS[unit]);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}
