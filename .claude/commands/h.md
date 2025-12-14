# Pull Heroku Database from Production

Pull the production database (teeemlive) to local environment.

## Data Flow

```
┌─────────────────────┐
│  teeemlive (PROD)   │
│  Heroku PostgreSQL  │
└──────────┬──────────┘
           │
           │ Step 1: Get latest backup (fast)
           ▼
┌─────────────────────┐
│   Heroku S3 Backup  │
│   (~145MB)          │
└──────────┬──────────┘
           │
           │ Step 2: aria2c parallel download
           ▼
┌─────────────────────┐
│       LOCAL         │
│  teeem_development  │
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

# Step 2: Get backup URL (use existing backup, don't capture new one unless stale)
cd /Users/robertharder/GitHub/teeem/backend
BACKUP_URL=$(heroku pg:backups:url --app teeemlive)

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

# Step 6: Verify data pulled correctly
bin/rails runner "puts '✅ Data verification:'; puts \"   Users: #{User.count}\"; puts \"   Foundations: #{Foundation.count}\"; puts \"   Jobs: #{Job.count}\"; puts \"   Contacts: #{Contact.count}\""

# Step 7: Restart local servers
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

cd /Users/robertharder/GitHub/teeem/backend && bin/rails server -p 3001 &
cd /Users/robertharder/GitHub/teeem/frontend-next && npm run dev &

echo "✅ Database synced and servers restarted"
```

## Summary

| Step | From | To | Method |
|------|------|-----|--------|
| 1 | - | - | Kill local connections |
| 2 | teeemlive | S3 URL | `pg:backups:url` |
| 3 | S3 | local file | `aria2c -x 16` (parallel, resume-capable) |
| 4 | local file | teeem_development | `pg_restore` |
| 5 | - | - | `db:migrate` + `create_system_foundations` |
| 6 | - | - | Verify data counts |
| 7 | - | localhost:3000 + 3001 | Restart servers |

## Notes

- **aria2c required**: `brew install aria2` (one-time)
- **Skip capture**: Uses existing backup. Heroku auto-captures daily. Only run `pg:backups:capture` if you need today's data.
- **Resume downloads**: If download fails, re-run aria2c and it resumes from where it left off
- **Australia latency**: Downloads may take 15-30 min due to US S3 → Australia network distance
