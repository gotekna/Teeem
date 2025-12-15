# Stale Xero Contact Detection System

## Problem
External links can point to archived/deleted Xero contacts, causing:
- Duplicate contacts to keep reappearing after merge
- Sync errors for non-existent contacts
- Data inconsistency between TEEEM and Xero

## Solution (SSoT Approach)

Track Xero contact status in `contact_external_links` table instead of immediate deletion.

### 1. Database Schema (Migration: 20251215093000)

Added tracking fields:
```ruby
xero_contact_status:  string   # 'active', 'archived', 'deleted', 'not_found'
last_verified_at:     datetime # Last time contact was verified to exist in Xero
```

### 2. Model Changes (ContactExternalLink)

**New Statuses:**
- `active` - Contact exists and is active in Xero (default)
- `archived` - Contact is archived in Xero
- `deleted` - Contact was deleted in Xero
- `not_found` - Contact not found during sync

**New Methods:**
```ruby
link.mark_verified!              # Mark as active when seen in sync
link.mark_stale!('not_found')    # Mark as stale when not found
link.stale?                      # Check if link is stale
link.active_status?              # Check if link is active
```

**New Scopes:**
```ruby
ContactExternalLink.active_status           # All active links
ContactExternalLink.stale_status            # All stale links
ContactExternalLink.unverified_since(time)  # Links not verified since time
```

### 3. Sync Service Changes (XeroContactSyncService)

**During Sync:**
- When contact is successfully synced → `link.mark_verified!`
- When contact not found in Xero → `link.mark_stale!('not_found')`

**After Sync:**
- Links not seen during sync are marked as `not_found`
- Stale links are NOT deleted immediately (tracked for 7 days)

### 4. Cleanup Job (CleanupStaleXeroLinksJob)

**What it does:**
- Runs daily to clean up stale links
- Deletes links marked as stale for 7+ days
- Logs all deletions for audit trail

**Run manually:**
```ruby
CleanupStaleXeroLinksJob.perform_now
```

**Schedule:**
Add to `config/recurring.yml`:
```yaml
cleanup_stale_xero_links:
  class: CleanupStaleXeroLinksJob
  schedule: "every 1 day at 3am"
  description: "Remove Xero external links marked as stale for 7+ days"
```

### 5. Fix Scripts

#### 5a. Fix Specific Duplicate (fix_duplicate_ato_contacts.rb)

**One-time fix for ATO duplicate:**
```bash
heroku run --app teeemlive "rails runner lib/scripts/fix_duplicate_ato_contacts.rb"
```

**What it does:**
1. Identifies duplicate ATO contacts (3410 and 3496)
2. Determines which Xero link is stale
3. Marks stale link as `not_found`
4. Deletes stale link
5. Merges TEEEM contacts

#### 5b. Merge All Duplicates (merge_all_duplicate_xero_contacts.rb)

**Find and merge ALL duplicate contacts:**
```bash
# Dry run (see what would happen)
heroku run --app teeemlive "DRY_RUN=true rails runner lib/scripts/merge_all_duplicate_xero_contacts.rb"

# Live run (make changes)
heroku run --app teeemlive "rails runner lib/scripts/merge_all_duplicate_xero_contacts.rb"

# Process specific tenant only
heroku run --app teeemlive "TENANT_ID=xxx rails runner lib/scripts/merge_all_duplicate_xero_contacts.rb"
```

**What it does:**
1. Finds ALL contacts with multiple Xero links for the same tenant
2. Keeps the most recently verified link
3. Marks other links as `not_found`
4. Deletes stale links
5. Reports all changes made

## Benefits

### Before (Old System)
- Immediate deletion of missing contacts
- No audit trail
- No grace period for temporary issues
- Duplicates reappear after merge

### After (New System)
- Stale links tracked, not immediately deleted
- 7-day grace period for Xero issues
- Full audit trail of status changes
- Duplicates detected and prevented

## Usage

### Check for Stale Links
```ruby
# Find all stale links
ContactExternalLink.stale_status

# Find links not verified in last 7 days
ContactExternalLink.unverified_since(7.days.ago)

# Count stale links by status
ContactExternalLink.group(:xero_contact_status).count
```

### Manual Cleanup
```ruby
# Force cleanup of all stale links (ignores 7-day threshold)
ContactExternalLink.stale_status.destroy_all

# Mark specific link as stale
link = ContactExternalLink.find(123)
link.mark_stale!('not_found')
```

### Check Sync Health
```ruby
# See how many contacts were verified in last sync
ContactExternalLink.where("last_verified_at > ?", 1.hour.ago).count

# Find contacts with stale links
Contact.joins(:external_links).merge(ContactExternalLink.stale_status).distinct
```

## Testing

1. **Run migration on production:**
   ```bash
   heroku run --app teeemlive "rails db:migrate"
   ```

2. **Fix current ATO duplicate:**
   ```bash
   heroku run --app teeemlive "rails runner lib/scripts/fix_duplicate_ato_contacts.rb"
   ```

3. **Run full Xero sync:**
   ```bash
   heroku run --app teeemlive "rails runner 'XeroContactSyncService.new.sync'"
   ```

4. **Check results:**
   ```bash
   heroku run --app teeemlive "rails runner 'puts ContactExternalLink.group(:xero_contact_status).count'"
   ```

## Deployment Checklist

- [x] Migration created
- [x] Model methods added
- [x] Sync service updated
- [x] Cleanup job created
- [x] Fix scripts created (specific + merge all)
- [x] Run migration on production
- [x] Run fix script on production (ATO)
- [x] Add cleanup job to recurring.yml
- [ ] Run merge all duplicates script
- [ ] Monitor first full sync
- [ ] Verify no duplicates reappear

## Future Enhancements

1. **Xero API Status Detection:**
   - Query Xero API to differentiate between archived vs deleted
   - Mark as 'archived' instead of 'not_found' when applicable

2. **Automatic Merge:**
   - When marking link as stale, check if contact has no other links
   - Automatically merge into another contact with same name

3. **Dashboard:**
   - Show stale link count in admin UI
   - Allow manual review before cleanup

4. **Notifications:**
   - Alert when many contacts go stale at once
   - Could indicate sync issue or Xero API problem
