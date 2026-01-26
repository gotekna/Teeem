#!/bin/bash

# Vercel Ignored Build Step (Zero-Waste Branch Filtering)
# ═══════════════════════════════════════════════════════
# Exit 0 = skip build (NO resources consumed)
# Exit 1 = proceed with build
#
# REQUIRED: Each Vercel project must have DEPLOY_BRANCH env var set:
#   - teeem-staging    → DEPLOY_BRANCH=Staging
#   - teeem-beta       → DEPLOY_BRANCH=Beta
#   - teeem-production → DEPLOY_BRANCH=Live
#   - teeem-jake       → DEPLOY_BRANCH=jake (or his branch name)
#   - teeem-sam        → DEPLOY_BRANCH=sam-dev
#   - teeem-rob        → DEPLOY_BRANCH=rob
# ═══════════════════════════════════════════════════════

echo "═══════════════════════════════════════════════════════"
echo "Branch: $VERCEL_GIT_COMMIT_REF"
echo "DEPLOY_BRANCH: ${DEPLOY_BRANCH:-NOT SET}"
echo "═══════════════════════════════════════════════════════"

# STEP 1: REQUIRED branch check (fail-safe)
if [ -z "$DEPLOY_BRANCH" ]; then
  echo "❌ ERROR: DEPLOY_BRANCH env var not set!"
  echo "   Add DEPLOY_BRANCH to this Vercel project's Environment Variables"
  echo "   Skipping build to prevent accidental deploys"
  exit 0
fi

if [ "$VERCEL_GIT_COMMIT_REF" != "$DEPLOY_BRANCH" ]; then
  echo "⏭️  Skipping: Branch '$VERCEL_GIT_COMMIT_REF' != '$DEPLOY_BRANCH'"
  exit 0
fi

echo "✅ Branch matches ($DEPLOY_BRANCH)"

# STEP 2: Check if ONLY non-critical files changed (skip build)
# Skip if changes are only in: docs, .claude, tests, README, etc.
# NOTE: Empty commits (no changes) SHOULD build - used for forced deploys
echo "Checking what changed..."

CHANGES=$(git diff --name-only HEAD^ HEAD -- . 2>/dev/null)

if [ -z "$CHANGES" ]; then
  echo "📦 No file changes (empty commit) - proceeding with build"
  exit 1
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
