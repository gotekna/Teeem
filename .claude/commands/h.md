# Pull Heroku Database from Production

Pull the production database (teeem-production) to local environment.

## Data Flow

```
┌─────────────────────┐
│  teeem-production   │  All tenants: Tekna, Pilgrim, TEEEM
│  Heroku PostgreSQL  │
└──────────┬──────────┘
           │
           │ Step 2: Capture fresh backup (all tenants)
           ▼
┌─────────────────────┐
│   Heroku S3 Backup  │
│   (~145MB)          │
└──────────┬──────────┘
           │
           │ Step 3: aria2c parallel download
           ▼
┌─────────────────────┐
│       LOCAL         │
│  teeem_development  │  Step 6: Assign NULL data to Tekna
│                     │  (multi-tenancy works like prod)
└─────────────────────┘
```

## Why This Method (SSoT)

| Method | Issue | Status |
|--------|-------|--------|
| `pg:pull` | Saturates prod DB connections | ❌ Avoid |
| `heroku pg:backups:download` | CLI truncates large files | ❌ Avoid |
| `curl` | Single connection, very slow from AU | ❌ Avoid |
| **`aria2c`** | Parallel chunks, resume-capable | ✅ SSoT |

## Auto-Execute

```bash
# Step 1: Kill existing local connections
psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'teeem_development' AND pid <> pg_backend_pid();" 2>/dev/null || true

# Step 2: Capture fresh backup and get URL
cd /Users/robertharder/GitHub/teeem/backend
echo "📸 Capturing fresh backup from production..."
heroku pg:backups:capture --app teeem-production 2>&1 | tail -5
BACKUP_URL=$(heroku pg:backups:url --app teeem-production)

# Step 3: Download with aria2c (16 parallel connections, resume-capable)
rm -f latest.dump
aria2c -x 16 -s 16 --file-allocation=none -o latest.dump "$BACKUP_URL"
echo "Downloaded: $(ls -lh latest.dump | awk '{print $5}')"

# Step 4: Restore to local
dropdb teeem_development 2>/dev/null || true
createdb teeem_development
pg_restore --verbose --no-acl --no-owner -d teeem_development latest.dump 2>&1 | tail -10
rm -f latest.dump

# Step 5: Run migrations and ensure foundations exist
bin/rails db:migrate
bin/rails teeem:create_system_foundations 2>&1 | tail -5

# Step 6: Assign NULL tenant data to Tekna (pre-multi-tenancy data fix)
# This ensures local dev works like production with proper tenant isolation
bin/rails tenant:assign_null_to_tekna

# Step 7: Clear encrypted credentials (can't decrypt with local keys)
bin/rails runner "
deleted_ms = MicrosoftCredential.delete_all
deleted_app = OrganizationMicrosoftAppCredential.delete_all rescue 0
deleted_s3 = S3Credential.delete_all rescue 0
puts '🔑 Cleared ' + (deleted_ms + deleted_app + deleted_s3).to_s + ' credentials (encrypted with prod keys)'
"

# Step 8: Verify data pulled correctly
bin/rails runner "puts '✅ Data verification:'; puts \"   Users: #{User.count}\"; puts \"   Foundations: #{Foundation.count}\"; puts \"   Jobs: #{Job.count}\"; puts \"   Contacts: #{Contact.count}\""

# Step 9: Restart local servers using screen (persistent)
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
screen -X -S backend quit 2>/dev/null || true
screen -X -S frontend-next quit 2>/dev/null || true

screen -dmS backend bash -c 'cd /Users/robertharder/GitHub/teeem/backend && /Users/robertharder/.rbenv/shims/bundle exec rails server -p 3001'
screen -dmS frontend-next bash -c 'cd /Users/robertharder/GitHub/teeem/frontend-next && npm run dev'

echo "✅ Database synced and servers restarted (screen sessions: backend, frontend-next)"

echo "⏳ Waiting for servers to start..."
sleep 3
echo "🎉 Done! Local environment ready at http://localhost:3000"
```

## Summary

| Step | From | To | Method |
|------|------|-----|--------|
| 1 | - | - | Kill local connections |
| 2 | teeem-production | S3 | `pg:backups:capture` (fresh) |
| 3 | S3 | local file | `aria2c -x 16` (parallel, ~30s) |
| 4 | local file | teeem_development | `pg_restore` |
| 5 | - | - | `db:migrate` + `create_system_foundations` |
| 6 | - | - | Assign NULL tenant data to Tekna (multi-tenancy fix) |
| 7 | - | - | Clear encrypted credentials (prod keys don't work locally) |
| 8 | - | - | Verify data counts |
| 9 | - | localhost:3000 + 3001 | Restart servers (screen) |

## Notes

- **aria2c required**: `brew install aria2` (one-time)
- **Always fresh**: Captures a new backup before downloading to ensure current data
- **Daily schedule**: Auto-backup at 2:00 AM Brisbane (configured Dec 2024)
- **Resume downloads**: If download fails, re-run aria2c and it resumes from where it left off
- **Australia latency**: Download takes ~30s with aria2c parallel connections
