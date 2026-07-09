#!/usr/bin/env bash
# publish-rom.sh — compress a PS1 game to .chd and upload it to Cloudflare R2.
#
# Usage:
#   scripts/publish-rom.sh <input.cue|input.chd|input.bin> [slug]
#     slug: optional output name (default: derived from the input filename)
#
# Examples:
#   scripts/publish-rom.sh "Crash Bandicoot (USA).cue" crash-bandicoot
#   scripts/publish-rom.sh mgs.chd mgs-special-missions
#
# It prints the public URL to paste into arcade/catalogue.html (GAMES array).
#
# ── One-time setup ────────────────────────────────────────────────────────────
#   1. brew install rom-tools        # provides `chdman`
#      npm i -g wrangler             # Cloudflare CLI (or: brew install cloudflare-wrangler)
#      wrangler login
#   2. Cloudflare dashboard → R2 → create bucket:  ps1-roms
#   3. R2 → ps1-roms → Settings → Custom Domains → add:  roms.khalildrissi.com
#   4. R2 → ps1-roms → Settings → CORS policy:
#        [{ "AllowedOrigins": ["https://khalildrissi.com"],
#           "AllowedMethods": ["GET","HEAD"],
#           "AllowedHeaders": ["range"],
#           "ExposeHeaders": ["Content-Length","Content-Range","Accept-Ranges"] }]
#   5. (Quality core only) Rules → Transform Rules → Modify Response Header on
#      roms.khalildrissi.com: set  Cross-Origin-Resource-Policy: cross-origin
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

BUCKET="ps1-roms"
DOMAIN="https://roms.khalildrissi.com"

in="${1:?usage: publish-rom.sh <input.cue|.chd|.bin> [slug]}"
[ -f "$in" ] || { echo "error: no such file: $in" >&2; exit 1; }

slug="${2:-}"
if [ -z "$slug" ]; then
  slug="$(basename "$in")"; slug="${slug%.*}"
  slug="$(echo "$slug" | tr '[:upper:] ' '[:lower:]-' | tr -cd 'a-z0-9-' )"
fi
out="${slug}.chd"

ext="${in##*.}"; ext="$(echo "$ext" | tr '[:upper:]' '[:lower:]')"
if [ "$ext" = "chd" ]; then
  cp "$in" "$out"
else
  command -v chdman >/dev/null || { echo "error: chdman not found (brew install rom-tools)" >&2; exit 1; }
  echo "→ compressing $in → $out"
  chdman createcd -i "$in" -o "$out"
fi

sz=$(du -h "$out" | cut -f1)
echo "→ uploading $out ($sz) to r2://$BUCKET/$out"
command -v wrangler >/dev/null || { echo "error: wrangler not found (npm i -g wrangler)" >&2; exit 1; }
wrangler r2 object put "$BUCKET/$out" --file "$out" --remote \
  --content-type "application/octet-stream" \
  --cache-control "public, max-age=31536000, immutable"

echo
echo "✓ published:  $DOMAIN/$out"
echo "  add to arcade/catalogue.html:"
echo "    { title: '${slug}', year: 0, cover: '', rom: ROMS + '/${out}', core: '' },"
