#!/bin/bash

# Vercel Ignored Build Step
# Exit 0 = skip build (no frontend changes)
# Exit 1 = proceed with build (frontend changed)

echo "Checking for frontend-next changes..."

# Check if any files in frontend-next changed
git diff --quiet HEAD^ HEAD -- .

if [ $? -eq 0 ]; then
  echo "⏭️  No frontend changes detected - skipping build"
  exit 0
else
  echo "🔨 Frontend changes detected - proceeding with build"
  exit 1
fi
