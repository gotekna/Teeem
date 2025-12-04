#!/bin/bash
# TEEEM Cleanup Script - Generated 2025-12-05 07:34:34 +1000
# This script removes duplicate root-level code that exists in /backend/
#
# REVIEW THIS CAREFULLY BEFORE RUNNING!
# Run with: bash scripts/do_cleanup.sh

set -e  # Exit on error

echo '================================================'
echo 'TEEEM Codebase Cleanup'
echo '================================================'
echo ''

# Change to repo root
cd "$(dirname "$0")/.."

echo 'Current directory:' $(pwd)
echo ''

# Safety check - ensure we're in the right repo
if [ ! -d "backend" ] || [ ! -d "frontend-next" ]; then
  echo 'ERROR: This does not look like the TEEEM repo!'
  exit 1
fi

echo 'This will delete the following duplicate directories/files:'
echo ''
echo '  - app'
echo '  - bin'
echo '  - config'
echo '  - storage'
echo '  - public'
echo '  - lib'
echo '  - db'
echo '  - vendor'
echo '  - config.ru'
echo '  - Rakefile'
echo '  - Procfile'

echo ''
read -p 'Are you sure you want to proceed? (yes/no): ' confirm

if [ "$confirm" != "yes" ]; then
  echo 'Aborted.'
  exit 0
fi

echo ''
echo 'Creating backup branch...'
git checkout -b backup-before-cleanup-$(date +%Y%m%d-%H%M%S) 2>/dev/null || true
git checkout -

echo 'Removing duplicate files and directories...'

echo 'Removing directory: app'
rm -rf "app"

echo 'Removing directory: bin'
rm -rf "bin"

echo 'Removing directory: config'
rm -rf "config"

echo 'Removing directory: storage'
rm -rf "storage"

echo 'Removing directory: public'
rm -rf "public"

echo 'Removing directory: lib'
rm -rf "lib"

echo 'Removing directory: db'
rm -rf "db"

echo 'Removing directory: vendor'
rm -rf "vendor"

echo 'Removing file: config.ru'
rm -f "config.ru"

echo 'Removing file: Rakefile'
rm -f "Rakefile"

echo 'Removing file: Procfile'
rm -f "Procfile"

echo ''
echo '================================================'
echo 'Cleanup complete!'
echo '================================================'
echo ''
echo 'Next steps:'
echo '1. Run: git status'
echo '2. Review the changes'
echo '3. Commit with: git add -A && git commit -m "chore: Remove duplicate root-level Rails code"'
echo '4. Push to GitHub'

