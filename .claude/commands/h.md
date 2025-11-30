# Pull Heroku Database to Local

Pull the Heroku PostgreSQL database to your local development environment from **staging (teeem-rob-dev)**.

## Auto-Execute

Run these commands immediately:

1. Kill any existing database connections
2. Capture a fresh backup from staging
3. Restore to local database
4. Run pending migrations

```bash
# Kill existing connections, backup, restore from staging
psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'teeem_development' AND pid <> pg_backend_pid();" 2>/dev/null || true
cd /Users/robertharder/GitHub/teeem/backend && heroku pg:backups:capture --app teeem-rob-dev && heroku pg:backups:download --app teeem-rob-dev -o latest.dump && pg_restore --verbose --clean --no-acl --no-owner -d teeem_development latest.dump 2>&1 | tail -20; rm -f latest.dump && bin/rails db:migrate
```

## Manual Options

**For Production (teeem-backend) - USE WITH CAUTION:**
```bash
psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'teeem_development' AND pid <> pg_backend_pid();" 2>/dev/null || true
cd /Users/robertharder/GitHub/teeem/backend && heroku pg:backups:capture --app teeem-backend && heroku pg:backups:download --app teeem-backend -o latest.dump && pg_restore --verbose --clean --no-acl --no-owner -d teeem_development latest.dump 2>&1 | tail -20; rm -f latest.dump && bin/rails db:migrate
```
