# Pull Heroku Database to Local

Pull the production Heroku PostgreSQL database to your local development environment.

## Instructions

Run the following commands to pull the Heroku database to local:

1. First, stop any running Rails server to free database connections
2. Drop and recreate the local database, then pull from Heroku:

```bash
cd backend && bin/rails db:drop db:create
heroku pg:pull DATABASE_URL trapid_development --app trapid-backend
```

If `pg:pull` fails due to connection issues, use the backup method:

```bash
heroku pg:backups:capture --app trapid-backend
heroku pg:backups:download --app trapid-backend
pg_restore --verbose --clean --no-acl --no-owner -d trapid_development latest.dump
rm latest.dump
```

After pulling, run any pending migrations:

```bash
cd backend && bin/rails db:migrate
```
