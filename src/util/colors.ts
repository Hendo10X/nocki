export const RESET = "\x1b[0m";
export const BOLD = "\x1b[1m";
export const DIM = "\x1b[2m";

export const FG = {
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  grey: "\x1b[90m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
} as const;

const PALETTE = [
  "\x1b[36m",
  "\x1b[35m",
  "\x1b[34m",
  "\x1b[33m",
  "\x1b[96m",
  "\x1b[95m",
  "\x1b[94m",
  "\x1b[93m",
  "\x1b[92m",
  "\x1b[91m",
];

export function colorize(code: string, text: string): string {
  return `${code}${text}${RESET}`;
}

export function assignColors(serviceNames: string[]): Map<string, string> {
  const map = new Map<string, string>();
  serviceNames.forEach((name, i) => {
    map.set(name, PALETTE[i % PALETTE.length]);
  });
  return map;
}
