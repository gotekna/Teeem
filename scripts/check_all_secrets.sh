#!/bin/bash

# Master API Key and Secret Detection Script
# Runs secret detection on both backend and frontend
# This should be run by the deploy-manager agent before ANY deployment

set -e

echo "🔒 TEEEM SECURITY CHECK"
echo "================================================"
echo "Scanning entire codebase for leaked secrets..."
echo ""

EXIT_CODE=0

# Check backend
if [ -f "backend/scripts/check_for_secrets.sh" ]; then
  echo "📦 Checking BACKEND..."
  cd backend
  if ! ./scripts/check_for_secrets.sh; then
    EXIT_CODE=1
  fi
  cd ..
  echo ""
else
  echo "⚠️  Backend secrets check script not found"
  EXIT_CODE=1
fi

# Check frontend for API keys and tokens
echo "🎨 Checking FRONTEND..."
cd frontend 2>/dev/null || cd ../frontend 2>/dev/null || true

if [ -d "../frontend" ] || [ -d "src" ]; then
  FRONTEND_SECRETS_FOUND=0

  # Patterns specific to frontend
  FRONTEND_PATTERNS=(
    "VITE_.*_KEY.*=.*[a-zA-Z0-9]{20,}"
    "REACT_APP_.*_KEY"
    "apiKey:\s*['\"][a-zA-Z0-9_-]{20,}['\"]"
    "API_KEY.*=.*['\"][a-zA-Z0-9_-]{20,}['\"]"
  )

  for pattern in "${FRONTEND_PATTERNS[@]}"; do
    if git grep -iE "$pattern" -- ':(exclude)*.md' ':(exclude)node_modules' 2>/dev/null; then
      echo "❌ POTENTIAL SECRET FOUND in frontend"
      FRONTEND_SECRETS_FOUND=1
    fi
  done

  # Check for .env files that shouldn't be committed
  if git ls-files --error-unmatch ".env" 2>/dev/null || \
     git ls-files --error-unmatch ".env.local" 2>/dev/null || \
     git ls-files --error-unmatch ".env.production" 2>/dev/null; then
    echo "❌ SECRET FILE TRACKED: .env file should not be committed"
    FRONTEND_SECRETS_FOUND=1
  fi

  if [ $FRONTEND_SECRETS_FOUND -eq 0 ]; then
    echo "✅ No secrets detected in frontend"
  else
    EXIT_CODE=1
  fi
fi

cd - > /dev/null 2>&1 || cd .. > /dev/null 2>&1

echo ""
echo "================================================"

if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ SECURITY CHECK PASSED"
  echo "Safe to proceed with deployment"
  echo ""
  exit 0
else
  echo "❌ SECURITY CHECK FAILED"
  echo "DEPLOYMENT BLOCKED - Fix security issues before deploying"
  echo ""
  exit 1
fi
