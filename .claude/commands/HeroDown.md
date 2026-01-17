# HeroDown - Pull Production Database to Local & Sam Dev

Pull the production database (teeemproduction) to both local environment AND teeem-sam-dev.

## Data Flow

```
┌─────────────────────┐
│  teeemproduction (PROD)   │
│  Heroku PostgreSQL  │
└──────────┬──────────┘
           │
           │ Step 1: Capture fresh backup
           ▼
┌─────────────────────┐
│   Heroku S3 Backup  │
│   (~145MB)          │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐  ┌──────────────┐
│  LOCAL  │  │ teeem-sam-dev│
│  Sam's  │  │   (Heroku)   │
│  Mac    │  └──────────────┘
└─────────┘
```

## Auto-Execute

```bash
# Step 1: Kill existing local connections
psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'teeem_development' AND pid <> pg_backend_pid();" 2>/dev/null || true

# Step 2: Capture fresh backup and get URL
cd /Users/samharder/Documents/GitHub/TeknaTrapid/backend
echo "📸 Capturing fresh backup from production..."
heroku pg:backups:capture --app teeemproduction 2>&1 | tail -5
BACKUP_URL=$(heroku pg:backups:url --app teeemproduction)

# Step 3: Copy backup to teeem-sam-dev (Heroku to Heroku - fast!)
echo "🚀 Copying database to teeem-sam-dev..."
heroku pg:copy teeemproduction::DATABASE_URL DATABASE_URL --app teeem-sam-dev --confirm teeem-sam-dev 2>&1 | tail -10

# Step 4: Run migrations on sam-dev
echo "🔄 Running migrations on teeem-sam-dev..."
heroku run bin/rails db:migrate --app teeem-sam-dev 2>&1 | tail -10

# Step 5: Download with aria2c for local (16 parallel connections, resume-capable)
echo "⬇️ Downloading backup for local restore..."
rm -f latest.dump
aria2c -x 16 -s 16 --file-allocation=none -o latest.dump "$BACKUP_URL"
echo "Downloaded: $(ls -lh latest.dump | awk '{print $5}')"

# Step 6: Restore to local
echo "📥 Restoring to local database..."
dropdb teeem_development 2>/dev/null || true
createdb teeem_development
pg_restore --verbose --no-acl --no-owner -d teeem_development latest.dump 2>&1 | tail -10
rm -f latest.dump

# Step 7: Run migrations and ensure foundations exist locally
bin/rails db:migrate
bin/rails teeem:create_system_foundations 2>&1 | tail -5

# Step 8: Clear encrypted credentials locally (can't decrypt with local keys)
bin/rails runner "
deleted_ms = MicrosoftCredential.delete_all
deleted_sp = OrganizationSharePointCredential.delete_all rescue 0
deleted_app = OrganizationMicrosoftAppCredential.delete_all
puts '🔑 Cleared ' + (deleted_ms + deleted_sp + deleted_app).to_s + ' credentials (encrypted with prod keys)'
"

# Step 9: Verify data pulled correctly
echo ""
echo "✅ LOCAL Data verification:"
bin/rails runner "puts \"   Users: #{User.count}\"; puts \"   Foundations: #{Foundation.count}\"; puts \"   Jobs: #{Job.count}\"; puts \"   Contacts: #{Contact.count}\""

echo ""
echo "✅ TEEEM-SAM-DEV Data verification:"
heroku run --app teeem-sam-dev 'bin/rails runner "puts \"   Users: #{User.count}\"; puts \"   Foundations: #{Foundation.count}\"; puts \"   Jobs: #{Job.count}\"; puts \"   Contacts: #{Contact.count}\""' 2>&1 | tail -6

# Step 10: Restart local servers
echo ""
echo "🔄 Restarting local servers..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Start backend on port 3001
cd /Users/samharder/Documents/GitHub/TeknaTrapid/backend
nohup bundle exec rails server -p 3001 > /tmp/rails_server.log 2>&1 &
echo "   Backend starting on port 3001..."

# Start frontend on port 3000
cd /Users/samharder/Documents/GitHub/TeknaTrapid/frontend-next
nohup npm run dev > /tmp/frontend.log 2>&1 &
echo "   Frontend starting on port 3000..."

echo ""
echo "✅ Database synced to BOTH local and teeem-sam-dev!"
echo ""
echo "┌────────────────────────────────────────────────────────┐"
echo "│ LOCAL:        http://localhost:3000                    │"
echo "│ SAM-DEV:      https://teeem-sam-dev.vercel.app         │"
echo "│ SAM-DEV API:  https://teeem-sam-dev-*.herokuapp.com    │"
echo "└────────────────────────────────────────────────────────┘"
```

## Summary

| Step | From | To | Method |
|------|------|-----|--------|
| 1 | - | - | Kill local connections |
| 2 | teeemproduction | S3 | `pg:backups:capture` (fresh) |
| 3 | teeemproduction | teeem-sam-dev | `pg:copy` (Heroku-to-Heroku, fast) |
| 4 | - | teeem-sam-dev | `db:migrate` |
| 5 | S3 | local file | `aria2c -x 16` (parallel, ~30s) |
| 6 | local file | teeem_development | `pg_restore` |
| 7 | - | local | `db:migrate` + `create_system_foundations` |
| 8 | - | local | Clear encrypted credentials |
| 9 | - | - | Verify data counts (both envs) |
| 10 | - | localhost | Restart servers |

## Notes

- **aria2c required**: `brew install aria2` (one-time)
- **Heroku-to-Heroku copy**: Much faster than downloading and re-uploading
- **Both envs in sync**: Local and sam-dev will have identical data
- **Credentials cleared locally**: Prod encryption keys don't work locally
- **Sam-dev credentials preserved**: Heroku env vars handle encryption