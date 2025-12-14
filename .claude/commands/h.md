# Pull Heroku Database from Production

Pull the production database (teeemlive) to local environment.

## Data Flow

```
┌─────────────────────┐
│  teeemlive (PROD)   │
│  Heroku PostgreSQL  │
└──────────┬──────────┘
           │
           │ Step 1: Capture backup (quick)
           ▼
┌─────────────────────┐
│   Heroku Backup     │
│   (~145MB)          │
└──────────┬──────────┘
           │
           │ Step 2: Download via curl
           ▼
┌─────────────────────┐
│       LOCAL         │
│  teeem_development  │
└─────────────────────┘
```

## Auto-Execute

```bash
# Step 1: Kill existing local connections
psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'teeem_development' AND pid <> pg_backend_pid();" 2>/dev/null || true

# Step 2: Capture fresh backup from production
cd /Users/robertharder/GitHub/teeem/backend
heroku pg:backups:capture --app teeemlive

# Step 3: Download backup via curl (more reliable than heroku CLI)
BACKUP_URL=$(heroku pg:backups:url --app teeemlive)
curl -o latest.dump -L --retry 3 --retry-delay 5 "$BACKUP_URL"
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
| 2 | teeemlive | Heroku backup | `pg:backups:capture` (quick, no connection hold) |
| 3 | Heroku backup | local file | `curl` with retries |
| 4 | local file | teeem_development | `pg_restore` |
| 5 | - | - | `db:migrate` + `create_system_foundations` |
| 6 | - | - | Verify data counts |
| 7 | - | localhost:3000 + 3001 | Restart servers |

## Why This Method

- **pg:backups:capture** - Quick snapshot, doesn't hold DB connections
- **curl with retries** - More reliable than `heroku pg:backups:download`
- **pg:pull** - Avoided because it saturates production DB connections
