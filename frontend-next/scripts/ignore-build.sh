#!/bin/bash

# Vercel Ignored Build Step
# Exit 0 = skip build
# Exit 1 = proceed with build

echo "Branch: $VERCEL_GIT_COMMIT_REF"
echo "Project: $VERCEL_PROJECT_PRODUCTION_URL"

# STEP 1: Check if this project should build this branch
# Set DEPLOY_BRANCH env var in each Vercel project:
#   teeem-staging:    DEPLOY_BRANCH=Staging
#   teeem-beta:       DEPLOY_BRANCH=Beta
#   teeem-production: DEPLOY_BRANCH=Live
#   teeem-jake:       (no DEPLOY_BRANCH = builds all branches)

if [ -n "$DEPLOY_BRANCH" ]; then
  if [ "$VERCEL_GIT_COMMIT_REF" != "$DEPLOY_BRANCH" ]; then
    echo "⏭️  Skipping: Branch '$VERCEL_GIT_COMMIT_REF' != project branch '$DEPLOY_BRANCH'"
    exit 0
  fi
  echo "✅ Branch matches project ($DEPLOY_BRANCH)"
fi

# STEP 2: Check if frontend files changed
echo "Checking for frontend-next changes..."
git diff --quiet HEAD^ HEAD -- .

if [ $? -eq 0 ]; then
  echo "⏭️  No frontend changes detected - skipping build"
  exit 0
else
  echo "🔨 Frontend changes detected - proceeding with build"
  exit 1
fi

