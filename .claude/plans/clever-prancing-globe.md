# Email Warehouse Search - Full Redesign (Option C)

## The Problem
Email search in CreateTaskDialog's AttachmentPicker is slow/broken:
1. **Missing Index** - No GIN index on `searchable` tsvector column (63k+ emails!)
2. **Per-Account UX** - User must select account first, then search (confusing)
3. **Account Type Issues** - Outlook personal accounts weren't handled

## Root Cause
```
email_warehouse.searchable → tsvector column EXISTS
BUT → NO GIN INDEX! (compare to pricebook which HAS idx_pricebook_search)
```

---

## Solution: Full Redesign

### Step 1: Add Missing GIN Index (Critical)
```ruby
# Migration
add_index :email_warehouse, :searchable, using: :gin, name: 'idx_email_warehouse_searchable_gin'
```

### Step 2: Redesign EmailSearchPanel Component
**Before:** Account dropdown → then search
**After:** Single search box, searches all user's emails

```tsx
// New simplified UI:
<div className="space-y-3">
  <div className="flex gap-2">
    <Input placeholder="Search all emails..." />
    <Button>Search</Button>
  </div>
  {/* Results show email with source indicator */}
  {emails.map(email => (
    <Card>
      <div>{email.subject}</div>
      <div className="text-xs text-muted">
        {email.from_email} • {email.mailbox_owner_email}
      </div>
    </Card>
  ))}
</div>
```

### Step 3: Backend Already Supports This!
The `my_emails=true` param in email_warehouse_controller already:
- Gets user's IMAP credentials
- Gets user's Outlook credential
- Gets user's MS365 mailbox access
- Combines all into unified query

No backend changes needed - just use `?my_emails=true&search=query`

---

## Files to Modify

| File | Change |
|------|--------|
| `db/migrate/xxx_add_email_warehouse_search_index.rb` | CREATE - Add GIN index |
| `frontend-next/components/task-hub/AttachmentPicker.tsx` | MODIFY - Remove account dropdown, single search |

## Implementation Order
1. Create migration for GIN index
2. Run migration locally
3. Simplify EmailSearchPanel - remove account picker
4. Use `my_emails=true` param for all searches
5. Add mailbox indicator in results (which account email is from)
6. Deploy and test
