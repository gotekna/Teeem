#!/bin/bash
# Deploy backend directory to Heroku
# This ensures Heroku only uses the backend directory - single source of truth

set -e  # Exit on error

echo "🚀 Deploying backend to Heroku..."

# Split backend directory into deployment branch
echo "📦 Creating deployment branch from backend directory..."
/opt/homebrew/bin/git subtree split --prefix backend -b heroku-deploy

# Push to Heroku
echo "⬆️  Pushing to Heroku..."
/opt/homebrew/bin/git push heroku heroku-deploy:main --force

echo "✅ Deployment complete!"
echo ""
echo "View logs: heroku logs --tail --app trapid-backend"
echo "Check status: heroku ps --app trapid-backend"
