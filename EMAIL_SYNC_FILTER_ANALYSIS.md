# Email Sync Filter Analysis

**Current State:** All emails are being synced without filtering
**Total Emails:** 41 emails in warehouse

## Emails That Should Be Filtered Out

### 1. System/Automated Emails - 12 emails (29%)

**Why filter:** Transactional emails (password resets, login confirmations, verification codes) are noise and don't contain business intelligence.

**Patterns:**
- `from_email` contains: `noreply@`, `no-reply@`, `security@`, `donotreply@`
- `subject` contains: "verification", "verify your", "security alert", "password reset", "login", "confirm a"

**Examples:**
```
ID   | Subject                                          | From
-----|--------------------------------------------------|------------------------------------------
4130 | Reset password                                   | security@identity.post.xero.com
4132 | New login from your Xero account...              | security@post.xero.com
4142 | Your verification code                           | security@identity.post.xero.com
4144 | ✅ Rach, review your Google Account settings...   | no-reply@google.com
4145 | Verify your email address                        | noreply@google.com
4148 | New Minimum Age Requirement                      | noreply@redditmail.com
4149 | Confirm a Xero login                             | security@post.xero.com
4156 | Security alert                                   | no-reply@accounts.google.com
```

### 2. Marketing/Promotional Emails - 3 emails (7%)

**Why filter:** Promotional content from retailers, ticketing, containers for change, etc. No business value.

**Patterns:**
- `from_email` contains: `events.`, `optin@`, `marketing@`, `promo@`
- Common senders: ticketek, davidjones, retail brands
- Subject often includes: emojis, "SALE", "OFFER", "LIMITED TIME"

**Examples:**
```
ID   | Subject                                          | From
-----|--------------------------------------------------|------------------------------------------
4138 | The busiest time of year is here!🎄🥂              | no-reply@qld.containersforchange.com.au
4139 | The best entertainment all in one place...       | Ticketek@events.ticketek.com.au
4140 | FESTIVE FRENZY Starts Now                        | optin@sub.davidjones.com.au
4141 | How can we pray for you this Christmas?          | connect@becomenew.com
```

## Emails That Should Be KEPT

### Sent Emails (Outbound) - 21 emails (51%) - ✅ KEEP

**Why keep:** These are valuable business communications:
- Internal team communication (Rach → Rob, Sam → Rob, etc.)
- Outbound client/supplier correspondence
- Complete conversation threads
- Business context and decisions

**Examples:**
```
ID   | Subject                                          | From                | To
-----|--------------------------------------------------|---------------------|---------------------
4133 | Fw: Love Your World & Money Matters Constitution | hello@lyw.org.au    | robert@tekna.com.au
4146 | Testing                                          | rach@lyw.org.au     | rob@lyw.org.au
4147 | this not working???                              | rach@lyw.org.au     | robert@tekna.com.au
```

**Note:** There are NO duplicate emails in the database. Each email appears only once based on `internet_message_id`.

## Summary

**Total emails that should be filtered:** 15 out of 41 (37%)
**Emails that should be kept:** 26 (63%)

### Breakdown:
- **Sent/Business Emails:** 21 emails (51%) - ✅ KEEP (valuable business context)
- **Legitimate Received:** 5 emails (12%) - ✅ KEEP
- **System/Automated:** 12 emails (29%) - ❌ FILTER (noise)
- **Marketing/Promo:** 3 emails (7%) - ❌ FILTER (noise)

## Recommended Filter Logic

```ruby
# In OrgEmailSyncJob, skip emails that match any of these:

# 1. Skip system/automated emails
automated_senders = ["noreply@", "no-reply@", "security@", "donotreply@"]
next if automated_senders.any? { |pattern| from_email.downcase.include?(pattern) }

automated_subjects = ["verification", "verify your", "security alert",
                      "password reset", "confirm a", "reset password"]
next if automated_subjects.any? { |pattern| subject.downcase.include?(pattern) }

# 2. Skip marketing emails
marketing_patterns = ["events.", "optin@", "marketing@", "promo@", "newsletter@"]
next if marketing_patterns.any? { |pattern| from_email.downcase.include?(pattern) }
```

## Implementation Priority

1. **HIGH PRIORITY:** Filter system/automated emails
   - Password resets, login confirmations, verification codes
   - 29% reduction in noise
   - Zero business value

2. **MEDIUM PRIORITY:** Filter marketing emails
   - Retail promotions, newsletters, event marketing
   - 7% reduction in noise
   - Be careful not to filter transactional emails (receipts, confirmations)

## Notes

- The current sync is pulling ALL emails without any filtering
- 37% of emails are pure noise (system/marketing)
- 63% are valuable business communications (including sent emails)
- **Do NOT filter sent emails** - they contain important business context
- Need to implement filters in `OrgEmailSyncJob.perform_sync` method