#!/bin/bash

# Only rebuild Eleventy if templates/layouts/data have changed

CHANGED=$(git diff --name-only HEAD~1 HEAD)

if echo "$CHANGED" | grep -E '^(src/|_data/|layouts/|eleventy\.js)'; then
  echo "🔁 Detected changes in templates or data. Rebuilding Eleventy..."
  npm run build
else
  echo "✅ No Eleventy-related changes. Skipping build."
fi
