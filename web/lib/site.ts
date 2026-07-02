export const site = {
  name: "nocki",
  tagline: "Your development environment should start itself.",
  repo: "https://github.com/Hendo10X/nocki",
  releases: "https://github.com/Hendo10X/nocki/releases",
  version: "v0.1.0",
  install: "curl -fsSL https://raw.githubusercontent.com/Hendo10X/nocki/main/install.sh | sh",
};

const DL = "https://github.com/Hendo10X/nocki/releases/latest/download";

export type OSKey = "mac-arm" | "mac-intel" | "linux-x64" | "linux-arm" | "windows";

export const downloads: Record<
  Exclude<OSKey, "windows">,
  { label: string; sub: string; asset: string; url: string }
> = {
  "mac-arm": {
    label: "macOS",
    sub: "Apple Silicon",
    asset: "nocki-darwin-arm64",
    url: `${DL}/nocki-darwin-arm64`,
  },
  "mac-intel": {
    label: "macOS",
    sub: "Intel",
    asset: "nocki-darwin-x64",
    url: `${DL}/nocki-darwin-x64`,
  },
  "linux-x64": {
    label: "Linux",
    sub: "x64",
    asset: "nocki-linux-x64",
    url: `${DL}/nocki-linux-x64`,
  },
  "linux-arm": {
    label: "Linux",
    sub: "arm64",
    asset: "nocki-linux-arm64",
    url: `${DL}/nocki-linux-arm64`,
  },
};
