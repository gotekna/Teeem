# Pull Heroku Database from Production

Pull the production database (teeemlive) to both local and staging environments concurrently.

## Data Flow

```
┌─────────────────────┐
│  teeemlive (PROD)   │
│  Heroku PostgreSQL  │
└──────────┬──────────┘
           │
           │ Step 1: Capture backup
           ▼
┌─────────────────────┐
│   Backup created    │
│   on Heroku         │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     │           │
     ▼           ▼
┌─────────┐ ┌─────────────────┐
│ Step 2a │ │    Step 2b      │
│Download │ │ Direct restore  │
│ .dump   │ │ from backup URL │
└────┬────┘ └────────┬────────┘
     │               │
     ▼               ▼
┌─────────────┐ ┌─────────────────┐
│   LOCAL     │ │  teeem-rob-dev  │
│ teeem_dev   │ │    (STAGING)    │
└─────────────┘ └─────────────────┘

Both restores run CONCURRENTLY

Step 3: Restart local frontend & backend servers
```

## Auto-Execute

```bash
# Step 1: Kill existing local connections
psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'teeem_development' AND pid <> pg_backend_pid();" 2>/dev/null || true

# Step 2: Capture backup from teeemlive (production)
cd /Users/robertharder/GitHub/teeem/backend && heroku pg:backups:capture --app teeemlive && heroku pg:backups:download --app teeemlive -o latest.dump

# Step 3: Restore CONCURRENTLY to both local and staging
# 3a: teeemlive backup → local teeem_development
(pg_restore --verbose --clean --no-acl --no-owner -d teeem_development latest.dump 2>&1 | tail -20 && bin/rails db:migrate) &
# 3b: teeemlive backup → teeem-rob-dev (staging)
(heroku pg:reset --app teeem-rob-dev --confirm teeem-rob-dev && heroku pg:restore "$(heroku pg:backups:url --app teeemlive)" --app teeem-rob-dev --confirm teeem-rob-dev) &
wait

# Step 4: Clean up
rm -f latest.dump

# Step 5: Restart local servers
# Kill existing frontend (Next.js on port 3000) and backend (Rails on port 3001)
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Start backend server on port 3001
cd /Users/robertharder/GitHub/teeem/backend && bin/rails server -p 3001 &

# Start frontend server (Next.js)
cd /Users/robertharder/GitHub/teeem/frontend-next && npm run dev &

echo "✅ Database synced and servers restarted"
```

## Summary

| Step | From | To | Method |
|------|------|-----|--------|
| 1 | teeemlive | Heroku backup | `pg:backups:capture` |
| 2a | Heroku backup | local file | `pg:backups:download` |
| 3a | local file | teeem_development | `pg_restore` |
| 3b | Heroku backup URL | teeem-rob-dev | `pg:restore` |
| 4 | - | - | Clean up dump file |
| 5 | - | localhost:3000 + 3001 | Restart Next.js + Rails |
