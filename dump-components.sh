#!/bin/bash

OUTPUT="project_text_dump.txt"

echo "Dumping text-only project files..." > "$OUTPUT"
echo "" >> "$OUTPUT"

dump_folder() {
  FOLDER=$1
  echo "=== $FOLDER ===" >> "$OUTPUT"
  echo "" >> "$OUTPUT"

  find "$FOLDER" -type f \
    \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.mjs" -o -name "*.json" -o -name "*.css" -o -name "*.md" -o -name "*.txt" \) \
    | while read FILE; do
        echo "--- FILE: $FILE ---" >> "$OUTPUT"
        cat "$FILE" >> "$OUTPUT"
        echo "" >> "$OUTPUT"
      done

  echo "" >> "$OUTPUT"
}

dump_folder "app"
dump_folder "components"
# dump_folder "services"
# dump_folder "types"

echo "Done. Saved to $OUTPUT"
