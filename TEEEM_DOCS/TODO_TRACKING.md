# TODO Comments - Tracked Technical Debt

**Generated:** 2025-12-06
**Source:** Code review `/t` command
**Status:** Pending conversion to Lexicon entries

---

## High Priority (Security & Core Features)

### TODO-001: Add Encryption for Accounting Integration
**File:** `backend/app/models/accounting_integration.rb`
**Priority:** High (Security)
**Description:** Need to add encryption with Rails encrypted credentials for sensitive accounting data
**Impact:** Security vulnerability - API keys and credentials stored unencrypted
**Recommendation:** Use Rails 7+ encrypted credentials or ActiveRecord encryption

```ruby
# Current: Unencrypted storage
# TODO: Add encryption with Rails encrypted credentials

# Recommended fix:
encrypts :api_key, :api_secret
```

---

## Medium Priority (Features & Functionality)

### TODO-002: Implement Role-Based Permissions for Folder Templates
**File:** `backend/app/models/folder_template.rb` (2 instances)
**Priority:** Medium (Feature)
**Description:** Need to implement role-based permissions for folder templates
**Impact:** All users can currently edit all folder templates
**Recommendation:** Add permission system with owner/admin roles

```ruby
# TODO: Implement role-based permissions
# TODO: Implement admin role that can edit all
```

---

### TODO-003: Re-enable Jobs Contact Assignment
**File:** `backend/app/models/job.rb`
**Priority:** Medium (Feature)
**Description:** Feature currently disabled, needs to be re-enabled once jobs have contacts assigned
**Impact:** Jobs cannot be properly associated with contacts
**Recommendation:** Complete contact assignment feature, then remove this TODO

```ruby
# TODO: Re-enable once jobs have contacts assigned
```

---

### TODO-004: Add User Company Group Assignment
**File:** `backend/app/models/user.rb`
**Priority:** Medium (Feature)
**Description:** Need to implement UserCompanyGroupAssignment model/association
**Impact:** Users cannot be assigned to company groups
**Recommendation:** Create join table and model for many-to-many relationship

```ruby
# TODO: Add UserCompanyGroupAssignment when needed
```

---

## Low Priority (Enhancements)

### TODO-005: Implement Kudos Notifications (3 instances)
**File:** `backend/app/jobs/kudos_recalculation_job.rb`
**Priority:** Low (Enhancement)
**Description:** Need to implement notifications for kudos milestones and leaderboard
**Impact:** Users don't receive notifications about kudos achievements
**Recommendation:** Integrate with existing notification system

```ruby
# TODO: Implement notification (3 instances)
# - Kudos milestone notifications
# - Leaderboard position changes
# - Leaderboard caching if needed
```

---

### TODO-006: Payment Status Sync Notifications
**File:** `backend/app/jobs/payment_status_sync_job.rb`
**Priority:** Low (Enhancement)
**Description:** Send notifications to admin/accounting team about newly paid invoices
**Impact:** Manual monitoring required for payment status changes
**Recommendation:** Add email/Slack notifications for accounting team

```ruby
# TODO: Send notification to admin/accounting team about newly paid invoices
```

---

### TODO-007: PO Timing Alert Notifications
**File:** `backend/app/jobs/check_po_timing_job.rb`
**Priority:** Low (Enhancement)
**Description:** Send notification/email to project manager when PO timing is off
**Impact:** Project managers may miss important PO timing alerts
**Recommendation:** Add email notifications to assigned project manager

```ruby
# TODO: Send notification/email to project manager
```

---

## Conversion Instructions

To convert these TODOs to Lexicon entries:

1. **Navigate to:** TEEEM UI → Documentation page → Lexicon tab
2. **For each TODO above:**
   - Click "Add New Entry"
   - Category: "Technical Debt" or "Feature Request"
   - Title: Use the TODO-XXX number and description
   - Content: Copy the full section from this document
   - Related Rules: Link to relevant Bible rules if applicable
   - Tags: Add appropriate tags (security, feature, enhancement, etc.)

3. **After creating entries:**
   - Update code comments to reference Lexicon entries
   - Example: `# TODO: See Lexicon Entry #123 - Add encryption`
   - Or remove TODOs if they're tracked in Lexicon

4. **Optional: Create GitHub Issues**
   - For high-priority items, also create GitHub issues
   - Link Lexicon entry to GitHub issue in the "details" field

---

## Summary

| Priority | Count | Estimated Effort |
|----------|-------|------------------|
| High (Security) | 1 | 4-8 hours |
| Medium (Features) | 3 | 16-24 hours |
| Low (Enhancements) | 3 | 8-12 hours |
| **Total** | **7** | **28-44 hours** |

**Next Steps:**
1. Address TODO-001 (encryption) immediately for security
2. Prioritize Medium items based on product roadmap
3. Schedule Low priority items for future sprints
4. Convert all entries to Lexicon for proper tracking
