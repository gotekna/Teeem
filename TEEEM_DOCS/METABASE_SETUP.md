# Metabase Integration Setup Guide

This guide explains how to set up Metabase for self-service analytics on TEEEM's data warehouse.

## Overview

Metabase is an open-source business intelligence tool that allows business users to explore data and create dashboards without writing SQL.

## Deployment Options

### Option 1: Metabase Cloud (Recommended for simplicity)
- **Cost:** $85/month starter plan
- **Pros:** Managed service, automatic updates, no maintenance
- **Cons:** Higher cost, less control

**Setup:**
1. Sign up at https://www.metabase.com/pricing
2. Create a new organization
3. Connect your database (see Database Connection below)

### Option 2: Self-Hosted on Heroku
- **Cost:** ~$7-14/month (Eco/Basic dyno + Heroku Postgres Mini for Metabase's metadata)
- **Pros:** Lower cost, full control
- **Cons:** Requires maintenance

**Deploy to Heroku:**
```bash
# Create Heroku app for Metabase
heroku create teeem-metabase

# Add Heroku Postgres for Metabase's internal database
heroku addons:create heroku-postgresql:mini -a teeem-metabase

# Deploy Metabase
heroku container:push web -a teeem-metabase
heroku container:release web -a teeem-metabase

# Or use the official buildpack deployment:
# https://github.com/metabase/metabase-deploy-heroku
```

### Option 3: Docker (Local/Self-hosted)
```bash
docker run -d -p 3000:3000 --name metabase metabase/metabase
```

## Database Connection

### Create Read-Only User

Run these SQL commands on your production database (via `heroku pg:psql -a teeemlive`):

```sql
-- Create read-only user for Metabase
CREATE USER metabase_reader WITH PASSWORD 'GENERATE_SECURE_PASSWORD_HERE';

-- Grant connect permission
GRANT CONNECT ON DATABASE production TO metabase_reader;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO metabase_reader;

-- Grant SELECT on warehouse views only (not operational tables)
GRANT SELECT ON
    mv_job_summary,
    mv_financial_summary,
    mv_financial_summary_weekly,
    mv_financial_summary_quarterly,
    mv_financial_summary_yearly,
    mv_job_summary_monthly,
    mv_document_summary,
    mv_document_completeness,
    mv_invoice_po_reconciliation,
    mv_resource_utilization,
    mv_job_document_status,
    mv_task_metrics,
    fact_job_daily_snapshots,
    email_warehouse,
    external_invoices
TO metabase_reader;

-- Prevent access to sensitive tables
REVOKE ALL ON users, user_sessions, api_keys FROM metabase_reader;
```

### Connection Settings

| Setting | Value |
|---------|-------|
| Database type | PostgreSQL |
| Host | Your Heroku PostgreSQL host |
| Port | 5432 |
| Database name | Your database name |
| Username | metabase_reader |
| Password | The password you created |
| SSL | Required |

**Get connection details:**
```bash
heroku pg:credentials:url -a teeemlive
```

## Recommended Dashboards

### 1. Financial Overview
- **Data source:** `mv_financial_summary`, `mv_financial_summary_quarterly`
- **Charts:**
  - Revenue vs Expenses (line chart by month)
  - Quarterly comparison (bar chart)
  - Year-over-year growth (trend)
  - Category breakdown (pie chart)

### 2. Job Performance
- **Data source:** `mv_job_summary`, `mv_job_summary_monthly`
- **Charts:**
  - Jobs by status (pie chart)
  - Task completion rate (gauge)
  - Hours logged per job (bar chart)
  - Revenue per job type (table)

### 3. Document Health
- **Data source:** `mv_document_summary`, `mv_document_completeness`
- **Charts:**
  - Verification status (donut chart)
  - Documents by type (bar chart)
  - Upload trends (line chart)
  - Storage usage (number)

### 4. Email Analytics
- **Data source:** `email_warehouse`
- **Charts:**
  - Emails by job (table)
  - Email volume over time (line chart)
  - Top senders/recipients (bar chart)

## Security Best Practices

1. **Use read-only user:** Never give Metabase write access
2. **Limit table access:** Only expose warehouse views, not operational tables
3. **Enable SSL:** Always require SSL connections
4. **Rotate credentials:** Change the metabase_reader password periodically
5. **Audit access:** Review who has Metabase access regularly

## Refresh Considerations

- Materialized views refresh hourly
- Dashboards may show data up to 1 hour old
- Add "Data refreshed hourly" disclaimer to dashboards

## Troubleshooting

### "Permission denied" errors
- Verify grants were applied correctly:
```sql
SELECT grantee, table_name, privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'metabase_reader';
```

### Slow queries
- Check if query is hitting indexes
- Consider creating additional materialized views for specific dashboard needs
- Use Metabase's query caching feature

### Connection timeouts
- Heroku dynos sleep after 30 mins of inactivity
- Use Heroku Scheduler or UptimeRobot to keep dyno awake

## Support

For issues with Metabase setup, contact the development team or refer to:
- Metabase docs: https://www.metabase.com/docs/
- Heroku Postgres docs: https://devcenter.heroku.com/articles/heroku-postgresql
