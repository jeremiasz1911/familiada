#!/bin/bash

ROOT=${1:-.}
EXCLUDE="node_modules|dist|build|.git|.vscode|.idea|coverage|out|tmp|cache"

echo "=== DRZEWO PROJEKTU ==="
tree -I "$EXCLUDE" -L 10 --dirsfirst "$ROOT"

echo
echo "=== ZAWARTOŚĆ PLIKÓW (TYLKO TEKSTOWE) ==="

find "$ROOT" -type f \
  | grep -Ev "$EXCLUDE" \
  | while read FILE; do
      # sprawdzamy czy plik jest tekstowy
      if file "$FILE" | grep -q "text"; then
        echo
        echo "──────────────────────────────────────────────"
        echo "📄 $FILE"
        echo "──────────────────────────────────────────────"
        cat "$FILE"
        echo
      fi
    done
