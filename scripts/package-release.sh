#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
version=$(node -p 'require("./package.json").version')
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Expected a stable package version." >&2; exit 1; }
[[ "$(uname -s)/$(uname -m)" == Linux/x86_64 ]] || { echo "Build this archive on Linux x86-64." >&2; exit 1; }
[[ -f .next/standalone/server.js ]] || { echo "Run the production build first." >&2; exit 1; }

output=${1:-dist/release}
mkdir -p "$output"
output=$(cd "$output" && pwd -P)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
name="ShipOS-v${version}-linux-x64"
root="$work/$name"
mkdir -p "$root/app"
cp -aL .next/standalone/. "$root/app/"
cp LICENSE "$root/"
cp scripts/start-release.sh "$root/start.sh"
chmod 755 "$root/start.sh"

# Populate a new, empty SQLite database using the exact release schema.
touch "$root/shipos-seed.db"
DATABASE_URL="file:$root/shipos-seed.db" npm run db:push -- --skip-generate

cat > "$root/README.txt" <<'INSTRUCTIONS'
ShipOS standalone server for Linux x86-64

Requirements: Node.js 24 and an OpenSSL 3-compatible Linux system.
Run ./start.sh and open http://127.0.0.1:3000.
SQLite data is stored in ./data/shipos.db by default.
Set SHIPOS_DATA_DIR to keep the database outside this package.
Set PORT to use a different port.

The launcher binds to loopback by default. The app uses shared
single-instance state. See the repository security policy before
configuring access beyond a trusted environment.
INSTRUCTIONS

tar -C "$work" -czf "$output/$name.tar.gz" "$name"
cp docs/media/repo-teaser.mp4 "$output/ShipOS-teaser.mp4"
cp docs/media/repo-teaser.vtt "$output/ShipOS-teaser.vtt"
(
  cd "$output"
  sha256sum "$name.tar.gz" ShipOS-teaser.mp4 ShipOS-teaser.vtt > SHA256SUMS.txt
)
printf 'Packaged %s\n' "$output/$name.tar.gz"
