#!/bin/sh
# nocki installer — downloads the right prebuilt binary from GitHub Releases.
#
#   curl -fsSL https://raw.githubusercontent.com/Hendo10X/nocki/main/install.sh | sh
#
# Environment overrides:
#   NOCKI_VERSION   release tag to install (default: latest)
#   NOCKI_INSTALL_DIR   install location (default: /usr/local/bin, else ~/.local/bin)

set -eu

REPO="Hendo10X/nocki"
BIN_NAME="nocki"

err() {
  echo "nocki install: $1" >&2
  exit 1
}

# --- Detect platform -------------------------------------------------------
os=$(uname -s)
arch=$(uname -m)

case "$os" in
  Darwin) os="darwin" ;;
  Linux) os="linux" ;;
  *) err "unsupported OS '$os'. Prebuilt binaries cover macOS and Linux; on Windows use WSL2." ;;
esac

case "$arch" in
  arm64 | aarch64) arch="arm64" ;;
  x86_64 | amd64) arch="x64" ;;
  *) err "unsupported architecture '$arch'." ;;
esac

asset="${BIN_NAME}-${os}-${arch}"

# --- Resolve version -------------------------------------------------------
version="${NOCKI_VERSION:-latest}"
if [ "$version" = "latest" ]; then
  base="https://github.com/${REPO}/releases/latest/download"
else
  base="https://github.com/${REPO}/releases/download/${version}"
fi
url="${base}/${asset}"

# --- Choose install dir ----------------------------------------------------
if [ -n "${NOCKI_INSTALL_DIR:-}" ]; then
  install_dir="$NOCKI_INSTALL_DIR"
elif [ -w "/usr/local/bin" ] 2>/dev/null; then
  install_dir="/usr/local/bin"
else
  install_dir="${HOME}/.local/bin"
fi
mkdir -p "$install_dir"

# --- Download --------------------------------------------------------------
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

echo "Downloading ${asset} (${version})..."
if command -v curl >/dev/null 2>&1; then
  curl -fSL "$url" -o "$tmp" || err "download failed from $url"
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$tmp" "$url" || err "download failed from $url"
else
  err "need curl or wget to download."
fi

chmod +x "$tmp"
target="${install_dir}/${BIN_NAME}"
mv "$tmp" "$target"
trap - EXIT

echo "Installed nocki to ${target}"

# --- PATH hint -------------------------------------------------------------
case ":${PATH}:" in
  *":${install_dir}:"*) ;;
  *) echo "Note: ${install_dir} is not on your PATH. Add it, e.g.:"
     echo "  export PATH=\"${install_dir}:\$PATH\"" ;;
esac

echo "Run 'nocki --help' to get started."
