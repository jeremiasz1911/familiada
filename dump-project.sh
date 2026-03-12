#!/usr/bin/env bash
set -euo pipefail

# Output file
OUTPUT="project_dump.txt"

# Directories to ignore (regex for grep)
IGNORE_DIRS_REGEX='/(node_modules|\.next|\.git|dist|build|coverage|\.turbo|\.cache|\.vercel|\.firebase|\.expo|out)(/|$)'

# File extensions / names worth dumping for Next.js + Firebase
# (add/remove as you like)
INCLUDE_EXT_REGEX='\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|scss|yml|yaml|toml)$'
INCLUDE_NAME_REGEX='/(next\.config\.(js|mjs|ts)|tailwind\.config\.(js|ts)|postcss\.config\.(js|cjs)|eslint\.config\.(js|mjs|cjs)|tsconfig\.json|package\.json|firebase\.json|firestore\.rules|storage\.rules|\.firebaserc|apphosting\.yaml)$'

# Helper: print header for file content
print_file_header () {
  local f="$1"
  {
    echo ""
    echo "========================================"
    echo "FILE: $f"
    echo "========================================"
  } >> "$OUTPUT"
}

# Start fresh
: > "$OUTPUT"

{
  echo "========================================"
  echo "PROJECT DUMP (Next.js + Firebase)"
  echo "Generated: $(date)"
  echo "Directory: $(pwd)"
  echo "========================================"
  echo ""
} >> "$OUTPUT"

# ---------
# STRUCTURE
# ---------
{
  echo "========================================"
  echo "PROJECT STRUCTURE"
  echo "========================================"
  echo ""
} >> "$OUTPUT"

# Prefer tree if installed, fallback to find
if command -v tree >/dev/null 2>&1; then
  # -a include hidden, -I ignore pattern, -F append indicators, -L depth limit (adjust)
  tree -a -F -L 6 -I "node_modules|.next|.git|dist|build|coverage|.turbo|.cache|.vercel|.firebase|out" >> "$OUTPUT"
else
  # Fallback: show dirs/files up to depth 6
  find . -maxdepth 6 \
    \( -path "*/node_modules/*" -o -path "*/.next/*" -o -path "*/.git/*" -o -path "*/dist/*" -o -path "*/build/*" -o -path "*/coverage/*" -o -path "*/.turbo/*" -o -path "*/.cache/*" -o -path "*/.vercel/*" -o -path "*/.firebase/*" -o -path "*/out/*" \) -prune -o \
    -print >> "$OUTPUT"
fi

# -------------
# FILE CONTENTS
# -------------
{
  echo ""
  echo "========================================"
  echo "FILE CONTENTS"
  echo "========================================"
  echo ""
} >> "$OUTPUT"

# Dump selected files (excluding ignored dirs)
# We include:
# - source: .ts/.tsx/.js...
# - config files
# - firebase configs/rules
# - docs
while IFS= read -r f; do
  # Skip non-regular files
  [[ -f "$f" ]] || continue

  print_file_header "$f"

  # Special handling for env files: mask secrets
  base="$(basename "$f")"
  if [[ "$base" == ".env" || "$base" == .env.* ]]; then
    # Mask values for KEY=VALUE (keeps key)
    sed -E 's/^([A-Za-z_][A-Za-z0-9_]*=).+$/\1***MASKED***/' "$f" >> "$OUTPUT" || true
  else
    cat "$f" >> "$OUTPUT" || true
  fi
done < <(
  find . -type f \
    | grep -Ev "$IGNORE_DIRS_REGEX" \
    | grep -E "($INCLUDE_EXT_REGEX|$INCLUDE_NAME_REGEX|/\.env(\..*)?$)" \
    | sort
)

# ----------------
# QUICK SUMMARY
# ----------------
{
  echo ""
  echo "========================================"
  echo "QUICK SUMMARY"
  echo "========================================"
  echo ""
  echo "Node: $(node -v 2>/dev/null || echo 'not found')"
  echo "NPM:  $(npm -v 2>/dev/null || echo 'not found')"
  echo "PNPM: $(pnpm -v 2>/dev/null || echo 'not found')"
  echo "Yarn: $(yarn -v 2>/dev/null || echo 'not found')"
  echo ""
  echo "Git branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'not a git repo')"
  echo "Last commit: $(git log -1 --oneline 2>/dev/null || echo 'no commits')"
} >> "$OUTPUT"

echo "✅ Done. Created: $OUTPUT"
echo "Tip: share project_dump.txt here."
