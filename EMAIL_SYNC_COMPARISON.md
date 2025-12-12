# Email Sync Job Comparison

## Summary

**Short answer:** `BulkEmailSyncJob` calls `OrgEmailSyncJob` internally - they both use the **same blacklist filtering**.

## The Jobs

### 1. OrgEmailSyncJob (Regular Sync)
**Purpose:** Standard email synchronization (daily/weekly use)

**Features:**
- ✅ Uses Email Blacklist (filters marketing/spam)
- Two modes: `incremental` or `full`
- Configured via `sync_years` or `sync_days`
- Default: 200 pages max per folder (20,000 emails)
- No progress tracking/checkpointing
- Fast, lightweight

**Usage:**
```ruby
# Incremental sync (since last sync)
OrgEmailSyncJob.perform_now('incremental', org_name: 'Love Your World')

# Full sync (last 7 days)
OrgEmailSyncJob.perform_now('full', org_name: 'Love Your World')

# Full sync (last 3 years - default)
credential.update!(sync_config: { sync_years: 3 })
OrgEmailSyncJob.perform_now('full', org_name: 'Love Your World')
```

**When to use:**
- Daily/weekly email syncs
- Syncing last 7 days to 3 years
- When you want blacklist filtering active

---

### 2. BulkEmailSyncJob (One-Time Historical Import)
**Purpose:** Large one-time imports (10+ years of email history)

**Features:**
- ✅ Uses Email Blacklist (calls OrgEmailSyncJob internally)
- **3 Phases:**
  1. Sync emails to warehouse (calls `OrgEmailSyncJob`)
  2. Upload attachments to SharePoint
  3. Upload .eml files to SharePoint
- Progress tracking with checkpointing
- Can resume from failure
- No page limits (processes ALL emails)
- Memory-efficient batching
- Detailed progress logging

**Usage:**
```ruby
# Initial bulk sync (10 years)
BulkEmailSyncJob.perform_now(credential_id, sync_years: 10)

# Resume from failure
BulkEmailSyncJob.perform_now(credential_id, resume: true)
```

**Progress tracking:**
Stored in `credential.bulk_sync_progress`:
```json
{
  "status": "in_progress",
  "started_at": "2024-01-01T00:00:00Z",
  "phase1_complete": false,
  "phase2_complete": false,
  "phase3_complete": false,
  "emails_synced": 15000,
  "emails_total": 20000,
  "attachments_processed": 3000,
  "last_processed_email_id": 12345
}
```

**When to use:**
- Initial setup (import all historical emails)
- Migrating from another system
- One-time bulk import of 10+ years
- When you need resumable progress tracking

---

## Key Differences

| Feature | OrgEmailSyncJob | BulkEmailSyncJob |
|---------|-----------------|------------------|
| **Blacklist filtering** | ✅ Yes | ✅ Yes (via OrgEmailSyncJob) |
| **Progress tracking** | ❌ No | ✅ Yes (checkpoints) |
| **Resumable** | ❌ No | ✅ Yes |
| **Page limits** | ✅ Yes (200 pages) | ❌ No (unlimited) |
| **Phases** | 1 (email sync only) | 3 (emails + attachments + SharePoint) |
| **Memory usage** | Low | Optimized batching |
| **Use case** | Regular syncs | One-time bulk imports |
| **SharePoint upload** | Separate job needed | Built-in (phases 2 & 3) |
| **Error recovery** | Start over | Resume from checkpoint |

---

## How BulkEmailSyncJob Uses OrgEmailSyncJob

**Phase 1 of BulkEmailSyncJob:**
```ruby
def sync_emails_to_warehouse(sync_years)
  # Configure for full historical sync
  @credential.update!(
    sync_config: { "sync_years" => sync_years },
    last_sync_at: nil  # Force full sync
  )

  # Calls OrgEmailSyncJob internally!
  result = OrgEmailSyncJob.perform_now("full", org_name: @credential.name)

  # Track progress
  @progress["emails_synced"] = result[:total_synced]
end
```

**This means:**
- ✅ BulkEmailSyncJob uses the **same blacklist filtering** as OrgEmailSyncJob
- ✅ Any patterns you add to Email Blacklist work for **both jobs**
- ✅ Marketing/spam emails are filtered in both incremental and bulk syncs

---

## Email Blacklist Applies to Both

The Email Blacklist system you just created works for:

✅ **OrgEmailSyncJob** (incremental sync)
```ruby
OrgEmailSyncJob.perform_now('incremental', org_name: 'Love Your World')
# Filters using EmailBlacklistItem.should_filter?
```

✅ **OrgEmailSyncJob** (full sync)
```ruby
OrgEmailSyncJob.perform_now('full', org_name: 'Love Your World')
# Filters using EmailBlacklistItem.should_filter?
```

✅ **BulkEmailSyncJob** (bulk import)
```ruby
BulkEmailSyncJob.perform_now(credential_id, sync_years: 10)
# Phase 1 calls OrgEmailSyncJob internally
# Filters using EmailBlacklistItem.should_filter?
```

---

## What Gets Filtered

In **all jobs**, emails are skipped if they match blacklist patterns (unless they have attachments):

```ruby
# From OrgEmailSyncJob#upsert_email
elsif has_attachments
  # NEVER FILTERED - emails with attachments always sync
else
  # Check against database blacklist
  if EmailBlacklistItem.should_filter?(
    from_email: from_email,
    from_name: from_data["name"],
    subject: subject
  )
    Rails.logger.debug "[OrgEmailSync] Skipping blacklisted email"
    return nil  # Don't sync this email
  end
end
```

---

## Recommendation

**For your Love Your World sync:**
- ✅ Use `OrgEmailSyncJob` for regular syncs (7 days, 3 years, etc.)
- ✅ Use `BulkEmailSyncJob` only for initial 10+ year historical import
- ✅ Blacklist works the same for both!

**Example:**
```ruby
# Regular weekly sync (recommended)
OrgEmailSyncJob.perform_now('full', org_name: 'Love Your World')

# One-time historical import (if needed)
BulkEmailSyncJob.perform_now(credential_id, sync_years: 10)
```

Both will respect your Email Blacklist patterns!
