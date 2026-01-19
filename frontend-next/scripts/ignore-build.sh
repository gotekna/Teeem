#!/bin/bash

# Vercel Ignored Build Step
# Exit 0 = skip build
# Exit 1 = proceed with build

echo "Branch: $VERCEL_GIT_COMMIT_REF"
echo "Project: $VERCEL_PROJECT_PRODUCTION_URL"

# STEP 1: Check if this project should build this branch
if [ -n "$DEPLOY_BRANCH" ]; then
  if [ "$VERCEL_GIT_COMMIT_REF" != "$DEPLOY_BRANCH" ]; then
    echo "⏭️  Skipping: Branch '$VERCEL_GIT_COMMIT_REF' != project branch '$DEPLOY_BRANCH'"
    exit 0
  fi
  echo "✅ Branch matches project ($DEPLOY_BRANCH)"
fi

# STEP 2: Check if ONLY non-critical files changed (skip build)
# Skip if changes are only in: docs, .claude, tests, README, etc.
echo "Checking what changed..."

CHANGES=$(git diff --name-only HEAD^ HEAD -- . 2>/dev/null)

if [ -z "$CHANGES" ]; then
  echo "⏭️  No changes detected - skipping build"
  exit 0
fi

# Check if ALL changes are skip-able
SKIP_BUILD=true
while IFS= read -r file; do
  case "$file" in
    *.md|*.txt|*.mdx)
      echo "  📄 Doc: $file (skip-able)"
      ;;
    *.test.*|*.spec.*|__tests__/*)
      echo "  🧪 Test: $file (skip-able)"
      ;;
    .claude/*|TEEEM_DOCS/*)
      echo "  📋 Config: $file (skip-able)"
      ;;
    *)
      echo "  🔨 Code: $file (requires build)"
      SKIP_BUILD=false
      ;;
  esac
done <<< "$CHANGES"

if [ "$SKIP_BUILD" = true ]; then
  echo "⏭️  Only docs/tests/config changed - skipping build"
  exit 0
fi

echo "🔨 Code changes detected - proceeding with build"
exit 1
