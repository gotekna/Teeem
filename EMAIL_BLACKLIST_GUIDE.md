# Email Blacklist System

A configurable, database-backed system for filtering unwanted emails during sync (both incremental and full).

## Overview

The Email Blacklist allows you to maintain a dynamic list of patterns to filter out marketing, spam, and other unwanted emails during email synchronization. Patterns are stored in the database and can be managed through the API.

## Features

- **Database-backed:** No code changes needed to add/remove filters
- **Pattern types:** Filter by sender email, subject, domain, or sender name
- **Match tracking:** See how many emails each pattern has filtered
- **Active/Inactive:** Temporarily disable patterns without deleting them
- **Cached:** 5-minute cache for performance (no DB hit on every email)
- **Works for all sync types:** Both incremental and full syncs use the same blacklist

## Pattern Types

| Type | Description | Example |
|------|-------------|---------|
| `from_email` | Matches part of sender email address | `marketing@`, `noreply@` |
| `subject` | Matches part of email subject line | `unsubscribe`, `opt out` |
| `domain` | Matches exact sender domain | `mailchimp.com`, `sendgrid.net` |
| `sender_name` | Matches part of sender display name | `LinkedIn`, `Facebook` |

## API Endpoints

### List All Blacklist Items
```bash
GET /api/v1/email_blacklist
```

**Response:**
```json
{
  "success": true,
  "items": [
    {
      "id": 1,
      "pattern": "marketing@",
      "pattern_type": "from_email",
      "description": "Marketing/automated email pattern",
      "active": true,
      "match_count": 42,
      "created_at": "2025-12-12T02:04:02.000Z",
      "updated_at": "2025-12-12T02:04:02.000Z"
    }
  ],
  "pattern_types": ["from_email", "subject", "domain", "sender_name"]
}
```

### Add New Blacklist Pattern
```bash
POST /api/v1/email_blacklist
Content-Type: application/json

{
  "email_blacklist_item": {
    "pattern": "linkedin.com",
    "pattern_type": "domain",
    "description": "LinkedIn notification emails",
    "active": true
  }
}
```

### Update Blacklist Pattern
```bash
PATCH /api/v1/email_blacklist/:id
Content-Type: application/json

{
  "email_blacklist_item": {
    "active": false
  }
}
```

### Delete Blacklist Pattern
```bash
DELETE /api/v1/email_blacklist/:id
```

### Test Email Against Blacklist
```bash
POST /api/v1/email_blacklist/test
Content-Type: application/json

{
  "from_email": "no-reply@marketing.example.com",
  "from_name": "Example Marketing",
  "subject": "Special Offer - Unsubscribe at bottom"
}
```

**Response:**
```json
{
  "success": true,
  "would_filter": true,
  "matched_pattern": {
    "id": 5,
    "pattern": "no-reply@",
    "pattern_type": "from_email",
    "description": "No-reply automated emails",
    "active": true,
    "match_count": 156,
    "created_at": "2025-12-12T02:04:02.000Z",
    "updated_at": "2025-12-12T02:04:02.000Z"
  }
}
```

## Pre-seeded Patterns

The system comes with these default patterns:

**From Email:**
- `marketing@`
- `promo@`
- `newsletter@`
- `noreply@`
- `no-reply@`

**Subject:**
- `unsubscribe`
- `opt out`
- `opt-out`
- `manage preferences`
- `view in browser`

## Usage Examples

### Add a pattern via cURL
```bash
curl -X POST https://teeem-sam-dev-7f131d00a67d.herokuapp.com/api/v1/email_blacklist \
  -H "Content-Type: application/json" \
  -d '{
    "email_blacklist_item": {
      "pattern": "facebook.com",
      "pattern_type": "domain",
      "description": "Facebook notification emails"
    }
  }'
```

### Add a pattern via Rails console
```ruby
# On Heroku
heroku run --app teeem-sam-dev rails console

# In console
EmailBlacklistItem.create!(
  pattern: "linkedin.com",
  pattern_type: "domain",
  description: "LinkedIn notifications"
)
```

### View match statistics
```ruby
# See which patterns are most effective
EmailBlacklistItem.order(match_count: :desc).limit(10).each do |item|
  puts "#{item.pattern} (#{item.pattern_type}): #{item.match_count} matches"
end
```

### Temporarily disable a pattern
```ruby
item = EmailBlacklistItem.find_by(pattern: "newsletter@")
item.update!(active: false)
```

## How It Works

1. **During Email Sync:** For each email (except those with attachments):
   - Extract: `from_email`, `from_name`, `subject`
   - Call: `EmailBlacklistItem.should_filter?(...)`
   - If matched: Skip syncing this email
   - If not matched: Continue with sync

2. **Caching:** Active blacklist items are cached for 5 minutes to avoid database queries on every email

3. **Match Tracking:** When an email matches a pattern, the `match_count` is incremented

4. **Cache Invalidation:** When you add/update/delete a pattern, the cache is automatically cleared

## Important Notes

- ⚠️ **Emails with attachments are NEVER filtered** (always synced regardless of blacklist)
- ⚠️ **Internal emails in Sent Items are NEVER filtered** (handled separately)
- ✅ Patterns are **case-insensitive**
- ✅ Patterns use **substring matching** (not regex)
- ✅ Changes take effect **immediately** (cache cleared on modify)

## Common Patterns to Add

```ruby
# Social media notifications
EmailBlacklistItem.create!(pattern: "facebook.com", pattern_type: "domain", description: "Facebook")
EmailBlacklistItem.create!(pattern: "linkedin.com", pattern_type: "domain", description: "LinkedIn")
EmailBlacklistItem.create!(pattern: "twitter.com", pattern_type: "domain", description: "Twitter")

# Marketing platforms
EmailBlacklistItem.create!(pattern: "mailchimp.com", pattern_type: "domain", description: "Mailchimp")
EmailBlacklistItem.create!(pattern: "sendgrid.net", pattern_type: "domain", description: "SendGrid")
EmailBlacklistItem.create!(pattern: "constantcontact.com", pattern_type: "domain", description: "Constant Contact")

# Specific senders
EmailBlacklistItem.create!(pattern: "donotreply@", pattern_type: "from_email", description: "Do not reply addresses")
EmailBlacklistItem.create!(pattern: "automated@", pattern_type: "from_email", description: "Automated emails")

# Subject patterns
EmailBlacklistItem.create!(pattern: "click here", pattern_type: "subject", description: "Spam subject pattern")
EmailBlacklistItem.create!(pattern: "limited time offer", pattern_type: "subject", description: "Marketing subject")
```

## Troubleshooting

### Pattern not working?
1. Check if pattern is active: `EmailBlacklistItem.find(id).active?`
2. Clear cache manually: `Rails.cache.delete("email_blacklist_items_active")`
3. Test the pattern: Use POST `/api/v1/email_blacklist/test` endpoint

### Too many emails being filtered?
1. Check match counts: `EmailBlacklistItem.order(match_count: :desc)`
2. Disable aggressive patterns temporarily
3. Review logs for `[EmailBlacklist] Matched pattern:` messages

### Want to see what's being filtered in real-time?
```bash
# On Heroku
heroku logs --tail --app teeem-sam-dev | grep "EmailBlacklist"
```

## Database Schema

```ruby
create_table :email_blacklist_items do |t|
  t.string :pattern, null: false            # The pattern to match
  t.string :pattern_type, null: false       # from_email, subject, domain, sender_name
  t.text :description                       # Human-readable description
  t.boolean :active, default: true          # Enable/disable without deleting
  t.integer :match_count, default: 0        # Track effectiveness
  t.timestamps
end

# Indexes
add_index :email_blacklist_items, [:pattern, :pattern_type], unique: true
add_index :email_blacklist_items, :active
```
