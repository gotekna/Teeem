# TEEEM LEXICON - Bug History & Knowledge Base

**Version:** 1.0.0
**Last Updated:** 2025-11-17 22:56 AEST
**Authority Level:** Reference (supplements Bible)
**Audience:** Claude Code + Human Developers

---

## 🔴 CRITICAL: Read This First

### This Document is "The Lexicon"

This file is the **knowledge base** for all TEEEM development.

**This Lexicon Contains KNOWLEDGE ONLY:**
- 🐛 Bug history (what went wrong, how we fixed it)
- 🏛️ Architecture decisions (why we chose X over Y)
- 📊 Test catalog (what tests exist, what's missing)
- 🔍 Known gaps (what needs to be built)

**For RULES (MUST/NEVER/ALWAYS):**
- 📖 See [TEEEM_BIBLE.md](TEEEM_BIBLE.md)

**For USER GUIDES (how to use features):**
- 📘 See [TEEEM_USER_MANUAL.md](TEEEM_USER_MANUAL.md)

---

## 💾 Database-Driven Lexicon

**IMPORTANT:** This file is auto-generated from the `trinity` database table.

**To edit entries:**
1. Go to Documentation page in TEEEM
2. Click "📕 TEEEM Lexicon"
3. Use the UI to add/edit/delete entries
4. Run `rake teeem:export_lexicon` to update this file

**Single Source of Truth:** Database (not this file)

---

## Table of Contents

- [Chapter 1: Overview & System-Wide Rules](#chapter-1-overview-system-wide-rules)
- [Chapter 2: Overview & System-Wide Rules](#chapter-2-overview-system-wide-rules)
- [Chapter 2: Authentication & Users](#chapter-2-authentication-users)
- [Chapter 3: Contacts & Relationships](#chapter-3-contacts-relationships)
- [Chapter 3: System Administration](#chapter-3-system-administration)
- [Chapter 4: Contacts & Relationships](#chapter-4-contacts-relationships)
- [Chapter 4: Price Books & Suppliers](#chapter-4-price-books-suppliers)
- [Chapter 5: Price Books & Suppliers](#chapter-5-price-books-suppliers)
- [Chapter 6: Jobs & Construction Management](#chapter-6-jobs-construction-management)
- [Chapter 7: Estimates & Quoting](#chapter-7-estimates-quoting)
- [Chapter 8: AI Plan Review](#chapter-8-ai-plan-review)
- [Chapter 9: Purchase Orders](#chapter-9-purchase-orders)
- [Chapter 9: Gantt & Schedule Master](#chapter-9-gantt-schedule-master)
- [Chapter 10: Gantt & Schedule Master](#chapter-10-gantt-schedule-master)
- [Chapter 11: Project Tasks & Checklists](#chapter-11-project-tasks-checklists)
- [Chapter 12: Weather & Public Holidays](#chapter-12-weather-public-holidays)
- [Chapter 13: OneDrive Integration](#chapter-13-onedrive-integration)
- [Chapter 14: Outlook/Email Integration](#chapter-14-outlook-email-integration)
- [Chapter 15: Chat & Communications](#chapter-15-chat-communications)
- [Chapter 16: Xero Accounting Integration](#chapter-16-xero-accounting-integration)
- [Chapter 17: Payments & Financials](#chapter-17-payments-financials)
- [Chapter 18: Workflows & Automation](#chapter-18-workflows-automation)
- [Chapter 19: Custom Tables & Formulas](#chapter-19-custom-tables-formulas)
- [Chapter 19: UI/UX Standards & Patterns](#chapter-19-ui-ux-standards-patterns)
- [Chapter 20: Trinity Table - Gold Standard](#chapter-20-trinity-table-gold-standard)
- [Chapter 20: UI/UX Standards & Patterns](#chapter-20-ui-ux-standards-patterns)
- [Chapter 21: Agent System & Automation](#chapter-21-agent-system-automation)

---


# Chapter 1: Overview & System-Wide Rules

**Last Updated:** 2025-11-17

## 🏛️ Architecture

### Design Decisions & Rationale

### 1. Multiple Sources of Truth - Codebase Audit Findings

**Decision:** ## 🔍 Audit Date: 2025-11-17

Found **7 critical violations** of RULE #1.13 (Single Source of Truth):

### ❌ VIOLATION #1: AgentShortcutsTab.jsx hardcoded commands
**Location:** `frontend/src/components/settings/AgentShortcutsTab.jsx`
**Problem:** Agent shortcuts hardcoded in `baseCommands` array
**Should be:** Read from AgentDefinition database via API
**Impact:** When agents change, must update code manually

### ❌ VIOLATION #2: AgentStatus.jsx hardcoded agent info
**Location:** `frontend/src/components/settings/AgentStatus.jsx`
**Problem:** Agent icons, names, descriptions hardcoded in 3 functions
**Should be:** Read from AgentDefinition database via API
**Impact:** Duplicate data, manual sync required

### ❌ VIOLATION #3: User roles hardcoded in frontend
**Location:** 
- `frontend/src/components/settings/AddUserModal.jsx`
- `frontend/src/components/settings/EditUserModal.jsx`
**Problem:** `roles` and `assignableRoles` arrays hardcoded
**Should be:** Fetch from backend API (/api/v1/roles)
**Impact:** Role changes require frontend code updates

### ❌ VIOLATION #4: Contact types hardcoded in frontend
**Location:** `frontend/src/components/settings/ContactRolesManagement.jsx`
**Problem:** `CONTACT_TYPES` array hardcoded
**Should be:** Fetch from backend (matches database enum)
**Impact:** Adding contact types requires code change

### ❌ VIOLATION #5: Trinity filter options hardcoded
**Location:** `frontend/src/components/documentation/FilterSection.jsx`
**Problem:** `typeOptions` and `statusOptions` hardcoded
**Should be:** Fetch from Trinity model constants via API
**Impact:** Adding new types requires frontend update

### ❌ VIOLATION #6: Schedule Master types hardcoded
**Location:** 
- `frontend/src/components/schedule-master/ScheduleTemplateEditor.jsx`
- `frontend/src/components/schedule-master/PredecessorEditor.jsx`
**Problem:** Task types, dependency types, roles hardcoded
**Should be:** Database enums or configuration table
**Impact:** Changes require code updates

### ❌ VIOLATION #7: Column types hardcoded
**Location:** `frontend/src/constants/columnTypes.js`
**Problem:** `COLUMN_TYPES` array hardcoded
**Should be:** Database table or API endpoint
**Impact:** Cannot add column types without deployment

## ✅ Recommended Fixes

1. Create API endpoints for all enum/constant data
2. Frontend fetches from API on mount
3. Cache in React Context/Redux for performance
4. Remove hardcoded arrays from components

## 📊 Priority

**High:** #1, #2 (Agents already have database)
**Medium:** #3, #4, #5 (Used frequently)  
**Low:** #6, #7 (Less frequently changed)

## ✅ FIXES APPLIED (2025-11-17)

### Backend Infrastructure Complete:
1. ✅ Created  endpoint (AgentsController)
2. ✅ Created  endpoint
3. ✅ Created  task
4. ✅ Added  entry type to Trinity
5. ✅ Updated RULE #21.19 (3-step process, database as source of truth)
6. ✅ Imported UI Compliance Auditor to Trinity database

### Frontend Fixes Remaining (9 hours estimated):
- [ ] Update AgentShortcutsTab to fetch from API (2h)
- [ ] Update AgentStatus to fetch from API (included)
- [ ] Create roles API + update modals (3h)
- [ ] Create contact types API + update component (2h)
- [ ] Create Trinity constants API + update filters (2h)

### Future Work (Low Priority, 8-12 hours):
- [ ] Schedule Master types to database
- [ ] Column types to database

See implementation summary for details.



# Chapter 2: Overview & System-Wide Rules

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚡ Unmigrated Schema Changes (working_days column)

**Status:** ⚡ FIXED
**First Reported:** Unknown
**Severity:** Medium

#### Summary
The `working_days` column was added manually to `company_settings` table without creating a migration file. When the test tried to use `working_days`, it failed with "undefined method" despite the column existing in the database.

#### Scenario
The `working_days` column was added manually to `company_settings` table without creating a migration file. When the test tried to use `working_days`, it failed with "undefined method" despite the column existing in the database.

#### Root Cause
1. Column was added directly to staging database (via console or manual SQL)
2. No migration file created to track this schema change
3. ActiveRecord's schema cache didn't recognize the column
4. Test failed: `undefined method 'working_days' for an instance of CompanySetting`


### ⚡ Nil User in Authorization Check

**Status:** ⚡ FIXED
**First Reported:** Unknown
**Severity:** Critical

#### Summary
User attempts to update schedule template rows via Gantt drag-and-drop. API returns error:

#### Scenario
User attempts to update schedule template rows via Gantt drag-and-drop. API returns error:

#### Root Cause
1. `ApplicationController#authorize_request` decoded JWT token but didn't validate that `@current_user` was set
2. If JWT was missing/invalid, `decoded` would be `nil` → `@current_user` remained `nil`
3. No error was raised - request continued
4. When `check_can_edit_templates` called `@current_user.can_create_templates?`, it failed with NoMethodError

#### Prevention
- ALWAYS use safe navigation (`&.`) when calling methods on `@current_user`
- Ensure `authorize_request` validates `@current_user` is not nil
- Return proper 401 Unauthorized instead of allowing nil to propagate

**Component:** ScheduleTemplateRows


### ⚡ JWT Token Expiration Not Handled in Frontend

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
User logs in, leaves tab open for 25 hours, makes request → 401 Unauthorized error.

#### Scenario
User logs in, leaves tab open for 25 hours, makes request → 401 Unauthorized error.

#### Root Cause
JWT tokens expire after 24 hours with NO automatic refresh mechanism.


### ⚡ No Account Lockout for Admin Users

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
Attacker brute forces admin user password with unlimited attempts.

#### Scenario
Attacker brute forces admin user password with unlimited attempts.

#### Root Cause
Account lockout only implemented for `PortalUser`, not `User` model.


### ⚡ Password Reset Email Disabled

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
User requests password reset → token generated but NO email sent.

#### Scenario
User requests password reset → token generated but NO email sent.

**Component:** Users


### ⚡ OAuth Token Expiration Not Monitored

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Low

#### Summary
User logs in via Microsoft OAuth → token expires after 1 hour → OneDrive API calls fail silently.

#### Scenario
User logs in via Microsoft OAuth → token expires after 1 hour → OneDrive API calls fail silently.

#### Root Cause
`oauth_expires_at` field is stored but not checked before API calls.

#### Solution
Check token expiration before OneDrive API calls:

**Component:** OmniauthCallbacks


## 🏛️ Architecture

### Design Decisions & Rationale

### 1. JWT vs Session-Based Auth (Design Decision)

**Decision:** Stateless authentication using JWT tokens instead of session cookies for API-friendly architecture

**Details:**
**Why JWT?**
- Stateless: No server-side session storage
- API-friendly: Works well with React SPA
- Mobile-ready

**Trade-offs:**
- Cannot revoke tokens
- Larger size than session ID


### 2. Role System Architecture

**Decision:** Hardcoded enum roles in User model for security and performance

**Details:**
Roles are hardcoded rather than database-driven to prevent privilege escalation via API exploits.


### 3. Authentication & Contacts System - Complete Investigation

**Decision:** Comprehensive investigation of authentication flow and contact management system. Key Findings: JWT token-based authentication with 24-hour expiration, User model with bcrypt password hashing, Contact system with Xero sync integration, Portal users (separate from admin users), Nested contact persons and addresses. Architecture Decisions: Chose JWT over session-based auth for API flexibility, Separate portal_users table for customer access, Contact sync with Xero using fuzzy matching, Bidirectional relationship management. Full investigation archived in: AUTHENTICATION_AND_CONTACTS_INVESTIGATION.md

**Trade-offs:**
Original file archived at: AUTHENTICATION_AND_CONTACTS_INVESTIGATION.md (38.5 KB)



# Chapter 2: Authentication & Users

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚡ Unmigrated Schema Changes (working_days column)

**Status:** ⚡ FIXED
**First Reported:** Unknown
**Severity:** Medium

#### Summary
The `working_days` column was added manually to `company_settings` table without creating a migration file. When the test tried to use `working_days`, it failed with "undefined method" despite the column existing in the database.

#### Scenario
The `working_days` column was added manually to `company_settings` table without creating a migration file. When the test tried to use `working_days`, it failed with "undefined method" despite the column existing in the database.

#### Root Cause
1. Column was added directly to staging database (via console or manual SQL)
2. No migration file created to track this schema change
3. ActiveRecord's schema cache didn't recognize the column
4. Test failed: `undefined method 'working_days' for an instance of CompanySetting`


### ⚡ Nil User in Authorization Check

**Status:** ⚡ FIXED
**First Reported:** Unknown
**Severity:** Critical

#### Summary
User attempts to update schedule template rows via Gantt drag-and-drop. API returns error:

#### Scenario
User attempts to update schedule template rows via Gantt drag-and-drop. API returns error:

#### Root Cause
1. `ApplicationController#authorize_request` decoded JWT token but didn't validate that `@current_user` was set
2. If JWT was missing/invalid, `decoded` would be `nil` → `@current_user` remained `nil`
3. No error was raised - request continued
4. When `check_can_edit_templates` called `@current_user.can_create_templates?`, it failed with NoMethodError

#### Prevention
- ALWAYS use safe navigation (`&.`) when calling methods on `@current_user`
- Ensure `authorize_request` validates `@current_user` is not nil
- Return proper 401 Unauthorized instead of allowing nil to propagate

**Component:** ScheduleTemplateRows


### ⚡ JWT Token Expiration Not Handled in Frontend

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
User logs in, leaves tab open for 25 hours, makes request → 401 Unauthorized error.

#### Scenario
User logs in, leaves tab open for 25 hours, makes request → 401 Unauthorized error.

#### Root Cause
JWT tokens expire after 24 hours with NO automatic refresh mechanism.


### ⚡ No Account Lockout for Admin Users

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
Attacker brute forces admin user password with unlimited attempts.

#### Scenario
Attacker brute forces admin user password with unlimited attempts.

#### Root Cause
Account lockout only implemented for `PortalUser`, not `User` model.


### ⚡ Password Reset Email Disabled

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
User requests password reset → token generated but NO email sent.

#### Scenario
User requests password reset → token generated but NO email sent.

**Component:** Users


### ⚡ OAuth Token Expiration Not Monitored

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Low

#### Summary
User logs in via Microsoft OAuth → token expires after 1 hour → OneDrive API calls fail silently.

#### Scenario
User logs in via Microsoft OAuth → token expires after 1 hour → OneDrive API calls fail silently.

#### Root Cause
`oauth_expires_at` field is stored but not checked before API calls.

#### Solution
Check token expiration before OneDrive API calls:

**Component:** OmniauthCallbacks


## 🏛️ Architecture

### Design Decisions & Rationale

### 1. JWT vs Session-Based Auth (Design Decision)

**Decision:** Stateless authentication using JWT tokens instead of session cookies for API-friendly architecture

**Details:**
**Why JWT?**
- Stateless: No server-side session storage
- API-friendly: Works well with React SPA
- Mobile-ready

**Trade-offs:**
- Cannot revoke tokens
- Larger size than session ID


### 2. Role System Architecture

**Decision:** Hardcoded enum roles in User model for security and performance

**Details:**
Roles are hardcoded rather than database-driven to prevent privilege escalation via API exploits.


### 3. Authentication & Contacts System - Complete Investigation

**Decision:** Comprehensive investigation of authentication flow and contact management system. Key Findings: JWT token-based authentication with 24-hour expiration, User model with bcrypt password hashing, Contact system with Xero sync integration, Portal users (separate from admin users), Nested contact persons and addresses. Architecture Decisions: Chose JWT over session-based auth for API flexibility, Separate portal_users table for customer access, Contact sync with Xero using fuzzy matching, Bidirectional relationship management. Full investigation archived in: AUTHENTICATION_AND_CONTACTS_INVESTIGATION.md

**Trade-offs:**
Original file archived at: AUTHENTICATION_AND_CONTACTS_INVESTIGATION.md (38.5 KB)



# Chapter 3: Contacts & Relationships

**Last Updated:** 2025-11-17

## 🏛️ Architecture

### Design Decisions & Rationale

### 1. Timezone Support Migration - Architecture Decision

**Decision:** Decision to add timezone support to company_settings and handle all dates in UTC with timezone conversion. Migration Approach: Added timezone column to company_settings, Default: Australia/Brisbane, Frontend converts to local timezone, Backend stores all times in UTC, Working days respect business timezone. Impact: All scheduling features now timezone-aware, Gantt chart displays in business hours, Reports use correct business day boundaries. Full migration guide: TIMEZONE_MIGRATION_GUIDE.md, Testing guide: TIMEZONE_TESTING_GUIDE.md

**Trade-offs:**
Original file archived at: TIMEZONE_MIGRATION_SUMMARY.md (7.9 KB)


## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 3: System Administration

**Last Updated:** 2025-11-17

## 🏛️ Architecture

### Design Decisions & Rationale

### 1. Timezone Support Migration - Architecture Decision

**Decision:** Decision to add timezone support to company_settings and handle all dates in UTC with timezone conversion. Migration Approach: Added timezone column to company_settings, Default: Australia/Brisbane, Frontend converts to local timezone, Backend stores all times in UTC, Working days respect business timezone. Impact: All scheduling features now timezone-aware, Gantt chart displays in business hours, Reports use correct business day boundaries. Full migration guide: TIMEZONE_MIGRATION_GUIDE.md, Testing guide: TIMEZONE_TESTING_GUIDE.md

**Trade-offs:**
Original file archived at: TIMEZONE_MIGRATION_SUMMARY.md (7.9 KB)


## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 4: Contacts & Relationships

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚠️ Xero Sync Creates Duplicate Contacts for Name Variations

**Status:** ⚠️ BY_DESIGN
**First Reported:** 2025-09-20
**Last Occurred:** 2025-11-10
**Severity:** Medium

#### Summary
Xero contact "ABC Plumbing Pty Ltd" and existing local contact "ABC Plumbing" are treated as different contacts during sync, creating duplicates.

#### Scenario
Xero contact "ABC Plumbing Pty Ltd" and existing local contact "ABC Plumbing" are treated as different contacts during sync, creating duplicates.

#### Root Cause
Fuzzy match threshold set at 85% similarity doesn't catch common business suffix variations like "Pty Ltd" vs no suffix, "Trading As" vs legal name, ampersand vs "and".

#### Solution
1. Manual Merge: Use POST /api/v1/contacts/merge. 2. Preventive: Set tax_number (ABN/ACN) - Priority 2 matching catches these. 3. Workaround: Manually link via POST /api/v1/contacts/:id/link_xero_contact

#### Prevention
Always set ABN for Australian businesses to enable Priority 2 matching

**Component:** XeroContactSync


### ⚡ Contact Merge Fails When Supplier Has Active Purchase Orders

**Status:** ⚡ FIXED
**First Reported:** 2025-11-04
**Last Occurred:** 2025-11-04
**Fixed Date:** 2025-11-05
**Severity:** High

#### Summary
Attempting to merge two supplier contacts fails with foreign key constraint error when source supplier has purchase orders.

#### Scenario
Attempting to merge two supplier contacts fails with foreign key constraint error when source supplier has purchase orders.

#### Root Cause
Merge controller was updating PricebookItem and PriceHistory foreign keys, but forgot to update PurchaseOrder.supplier_id.

#### Solution
Added missing PurchaseOrder update: PurchaseOrder.where(supplier_id: source.id).update_all(supplier_id: target.id)

#### Prevention
Always check ALL foreign key relationships when implementing merge features

**Component:** ContactMerge


### ⚡ Primary Contact Person Not Enforced on Xero Sync

**Status:** ⚡ FIXED
**First Reported:** 2025-10-12
**Last Occurred:** 2025-10-12
**Fixed Date:** 2025-10-15
**Severity:** Low

#### Summary
After Xero contact sync, contacts end up with multiple is_primary = true contact persons.

#### Scenario
After Xero contact sync, contacts end up with multiple is_primary = true contact persons.

#### Root Cause
XeroContactSyncService was creating ContactPerson records directly without triggering callbacks

#### Solution
Changed to use single record creation which triggers callbacks

#### Prevention
Added validation test in contact_person_spec.rb

**Component:** XeroContactSync


### ⚡ Portal Password Reset Loop for Locked Accounts

**Status:** ⚡ FIXED
**First Reported:** 2025-10-28
**Last Occurred:** 2025-10-28
**Fixed Date:** 2025-11-01
**Severity:** Medium

#### Summary
Portal users locked out after 5 failed attempts cannot reset password because password reset endpoint also checks locked? status.

#### Scenario
Portal users locked out after 5 failed attempts cannot reset password because password reset endpoint also checks locked? status.

#### Root Cause
Password reset endpoint was checking lockout status, preventing locked users from resetting passwords

#### Solution
Modified password reset endpoint to skip lockout check and clear locked_until and failed_login_attempts on successful reset

#### Prevention
Only check lockout on login attempts, not password resets

**Component:** PortalAuth


### ⚠️ Bidirectional Relationship Cascade Causes Infinite Loop

**Status:** ⚠️ BY_DESIGN
**First Reported:** 2025-09-15
**Severity:** Critical

#### Summary
Creating a relationship triggers after_create which creates the reverse, which triggers another after_create, leading to infinite recursion.

#### Scenario
Creating a relationship triggers after_create which creates the reverse, which triggers another after_create, leading to infinite recursion.

#### Root Cause
Bidirectional relationships need to create reverse relationships automatically without protection

#### Solution
Use Thread-local flag to prevent recursion: Thread.current[:creating_reverse_relationship]

#### Prevention
This pattern MUST be used for all bidirectional associations. See BIBLE RULE #3.2

**Component:** ContactRelationship


### 🔄 Contact Activity Log Growing Too Large (>10k Records)

**Status:** 🔄 MONITORING
**First Reported:** 2025-10-20
**Severity:** Low

#### Summary
Contacts with high Xero sync frequency accumulate thousands of ContactActivity records, slowing down activities endpoint

#### Scenario
Contacts with high Xero sync frequency accumulate thousands of ContactActivity records, slowing down activities endpoint

#### Root Cause
No archival or pagination for activity logs

#### Solution
Activities endpoint limits to 50 most recent records

#### Prevention
Consider adding archival for activities older than 6 months, implement pagination

**Component:** ContactActivity


### ⚡ Portal User Email Validation Too Strict

**Status:** ⚡ FIXED
**First Reported:** 2025-10-22
**Fixed Date:** 2025-10-25
**Severity:** Low

#### Summary
Portal user creation fails for valid email addresses with plus addressing or subdomains

#### Scenario
Portal user creation fails for valid email addresses with plus addressing or subdomains

#### Root Cause
Email validation regex was overly restrictive

#### Solution
Changed to use Ruby's built-in URI::MailTo::EMAIL_REGEXP

#### Prevention
Use standard email validation libraries instead of custom regex

**Component:** PortalUser


### ⚡ Contact Type Filter Returns Wrong Results for "Both"

**Status:** ⚡ FIXED
**First Reported:** 2025-10-15
**Fixed Date:** 2025-10-18
**Severity:** Medium

#### Summary
Filtering contacts with ?type=both returns contacts that are customer OR supplier instead of customer AND supplier

#### Scenario
Filtering contacts with ?type=both returns contacts that are customer OR supplier instead of customer AND supplier

#### Root Cause
Controller was using array overlap check (&&) instead of array containment (@>)

#### Solution
Changed to array containment operator: contact_types @> ARRAY['customer', 'supplier']::varchar[]

#### Prevention
Use @> for AND logic on PostgreSQL arrays, && for OR logic

**Component:** ContactsController


### ⚡ Deleting Contact Doesn't Clear Related Supplier References

**Status:** ⚡ FIXED
**First Reported:** 2025-09-25
**Fixed Date:** 2025-09-28
**Severity:** High

#### Summary
Deleting a contact that has linked suppliers leaves orphaned SupplierContact records

#### Scenario
Deleting a contact that has linked suppliers leaves orphaned SupplierContact records

#### Root Cause
Missing dependent: :destroy on has_many :supplier_contacts association

#### Solution
Added cascade delete: has_many :supplier_contacts, dependent: :destroy

#### Prevention
Added model test to verify cascade deletion

**Component:** Contact


### ⚠️ Xero Sync Rate Limiting Causes Timeout on Large Contact Lists

**Status:** ⚠️ BY_DESIGN
**First Reported:** 2025-11-08
**Severity:** Low

#### Summary
Syncing 500+ contacts from Xero takes over 10 minutes due to 1.2-second delay, causing Heroku timeout

#### Scenario
Syncing 500+ contacts from Xero takes over 10 minutes due to 1.2-second delay, causing Heroku timeout

#### Root Cause
Xero API has 60 requests/minute limit. With 500 contacts sync takes 600 seconds

#### Solution
Run Xero sync as background job: XeroContactSyncJob.perform_later

#### Prevention
Large syncs must use background jobs

**Component:** XeroContactSync


## 🏛️ Architecture

### Design Decisions & Rationale

### 1. Contact Type System

**Decision:** PostgreSQL array column for contact_types to support hybrid entities

**Details:**
Uses varchar[] to allow contacts to be both customers and suppliers simultaneously. GIN indexes provide fast querying.


### 2. Supplier Portal - Implementation Plan & Architecture

**Decision:** Complete plan for building supplier portal allowing external access to quotes, POs, and invoices. Features Planned: Separate portal_users authentication, Scoped access to contact data only, Quote approval workflow, PO confirmation, Invoice status tracking. Security Considerations: Separate auth tokens from admin, Row-level security checks, Email verification required, Password complexity requirements. Full plan archived in: PORTAL_IMPLEMENTATION_PLAN.md

**Trade-offs:**
Original file archived at: PORTAL_IMPLEMENTATION_PLAN.md (26.9 KB)


## 🎓 Developer Notes

### Supplier Portal Phase 1 - Completion Summary

Phase 1 completion report for supplier portal. Completed Features: Portal user authentication, Contact association, Quote viewing, Basic dashboard. Pending Features: PO confirmation workflow, Invoice upload, Email notifications, Advanced permissions. Full details in: PORTAL_PHASE1_COMPLETE.md



# Chapter 4: Price Books & Suppliers

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚠️ Xero Sync Creates Duplicate Contacts for Name Variations

**Status:** ⚠️ BY_DESIGN
**First Reported:** 2025-09-20
**Last Occurred:** 2025-11-10
**Severity:** Medium

#### Summary
Xero contact "ABC Plumbing Pty Ltd" and existing local contact "ABC Plumbing" are treated as different contacts during sync, creating duplicates.

#### Scenario
Xero contact "ABC Plumbing Pty Ltd" and existing local contact "ABC Plumbing" are treated as different contacts during sync, creating duplicates.

#### Root Cause
Fuzzy match threshold set at 85% similarity doesn't catch common business suffix variations like "Pty Ltd" vs no suffix, "Trading As" vs legal name, ampersand vs "and".

#### Solution
1. Manual Merge: Use POST /api/v1/contacts/merge. 2. Preventive: Set tax_number (ABN/ACN) - Priority 2 matching catches these. 3. Workaround: Manually link via POST /api/v1/contacts/:id/link_xero_contact

#### Prevention
Always set ABN for Australian businesses to enable Priority 2 matching

**Component:** XeroContactSync


### ⚡ Contact Merge Fails When Supplier Has Active Purchase Orders

**Status:** ⚡ FIXED
**First Reported:** 2025-11-04
**Last Occurred:** 2025-11-04
**Fixed Date:** 2025-11-05
**Severity:** High

#### Summary
Attempting to merge two supplier contacts fails with foreign key constraint error when source supplier has purchase orders.

#### Scenario
Attempting to merge two supplier contacts fails with foreign key constraint error when source supplier has purchase orders.

#### Root Cause
Merge controller was updating PricebookItem and PriceHistory foreign keys, but forgot to update PurchaseOrder.supplier_id.

#### Solution
Added missing PurchaseOrder update: PurchaseOrder.where(supplier_id: source.id).update_all(supplier_id: target.id)

#### Prevention
Always check ALL foreign key relationships when implementing merge features

**Component:** ContactMerge


### ⚡ Primary Contact Person Not Enforced on Xero Sync

**Status:** ⚡ FIXED
**First Reported:** 2025-10-12
**Last Occurred:** 2025-10-12
**Fixed Date:** 2025-10-15
**Severity:** Low

#### Summary
After Xero contact sync, contacts end up with multiple is_primary = true contact persons.

#### Scenario
After Xero contact sync, contacts end up with multiple is_primary = true contact persons.

#### Root Cause
XeroContactSyncService was creating ContactPerson records directly without triggering callbacks

#### Solution
Changed to use single record creation which triggers callbacks

#### Prevention
Added validation test in contact_person_spec.rb

**Component:** XeroContactSync


### ⚡ Portal Password Reset Loop for Locked Accounts

**Status:** ⚡ FIXED
**First Reported:** 2025-10-28
**Last Occurred:** 2025-10-28
**Fixed Date:** 2025-11-01
**Severity:** Medium

#### Summary
Portal users locked out after 5 failed attempts cannot reset password because password reset endpoint also checks locked? status.

#### Scenario
Portal users locked out after 5 failed attempts cannot reset password because password reset endpoint also checks locked? status.

#### Root Cause
Password reset endpoint was checking lockout status, preventing locked users from resetting passwords

#### Solution
Modified password reset endpoint to skip lockout check and clear locked_until and failed_login_attempts on successful reset

#### Prevention
Only check lockout on login attempts, not password resets

**Component:** PortalAuth


### ⚠️ Bidirectional Relationship Cascade Causes Infinite Loop

**Status:** ⚠️ BY_DESIGN
**First Reported:** 2025-09-15
**Severity:** Critical

#### Summary
Creating a relationship triggers after_create which creates the reverse, which triggers another after_create, leading to infinite recursion.

#### Scenario
Creating a relationship triggers after_create which creates the reverse, which triggers another after_create, leading to infinite recursion.

#### Root Cause
Bidirectional relationships need to create reverse relationships automatically without protection

#### Solution
Use Thread-local flag to prevent recursion: Thread.current[:creating_reverse_relationship]

#### Prevention
This pattern MUST be used for all bidirectional associations. See BIBLE RULE #3.2

**Component:** ContactRelationship


### 🔄 Contact Activity Log Growing Too Large (>10k Records)

**Status:** 🔄 MONITORING
**First Reported:** 2025-10-20
**Severity:** Low

#### Summary
Contacts with high Xero sync frequency accumulate thousands of ContactActivity records, slowing down activities endpoint

#### Scenario
Contacts with high Xero sync frequency accumulate thousands of ContactActivity records, slowing down activities endpoint

#### Root Cause
No archival or pagination for activity logs

#### Solution
Activities endpoint limits to 50 most recent records

#### Prevention
Consider adding archival for activities older than 6 months, implement pagination

**Component:** ContactActivity


### ⚡ Portal User Email Validation Too Strict

**Status:** ⚡ FIXED
**First Reported:** 2025-10-22
**Fixed Date:** 2025-10-25
**Severity:** Low

#### Summary
Portal user creation fails for valid email addresses with plus addressing or subdomains

#### Scenario
Portal user creation fails for valid email addresses with plus addressing or subdomains

#### Root Cause
Email validation regex was overly restrictive

#### Solution
Changed to use Ruby's built-in URI::MailTo::EMAIL_REGEXP

#### Prevention
Use standard email validation libraries instead of custom regex

**Component:** PortalUser


### ⚡ Contact Type Filter Returns Wrong Results for "Both"

**Status:** ⚡ FIXED
**First Reported:** 2025-10-15
**Fixed Date:** 2025-10-18
**Severity:** Medium

#### Summary
Filtering contacts with ?type=both returns contacts that are customer OR supplier instead of customer AND supplier

#### Scenario
Filtering contacts with ?type=both returns contacts that are customer OR supplier instead of customer AND supplier

#### Root Cause
Controller was using array overlap check (&&) instead of array containment (@>)

#### Solution
Changed to array containment operator: contact_types @> ARRAY['customer', 'supplier']::varchar[]

#### Prevention
Use @> for AND logic on PostgreSQL arrays, && for OR logic

**Component:** ContactsController


### ⚡ Deleting Contact Doesn't Clear Related Supplier References

**Status:** ⚡ FIXED
**First Reported:** 2025-09-25
**Fixed Date:** 2025-09-28
**Severity:** High

#### Summary
Deleting a contact that has linked suppliers leaves orphaned SupplierContact records

#### Scenario
Deleting a contact that has linked suppliers leaves orphaned SupplierContact records

#### Root Cause
Missing dependent: :destroy on has_many :supplier_contacts association

#### Solution
Added cascade delete: has_many :supplier_contacts, dependent: :destroy

#### Prevention
Added model test to verify cascade deletion

**Component:** Contact


### ⚠️ Xero Sync Rate Limiting Causes Timeout on Large Contact Lists

**Status:** ⚠️ BY_DESIGN
**First Reported:** 2025-11-08
**Severity:** Low

#### Summary
Syncing 500+ contacts from Xero takes over 10 minutes due to 1.2-second delay, causing Heroku timeout

#### Scenario
Syncing 500+ contacts from Xero takes over 10 minutes due to 1.2-second delay, causing Heroku timeout

#### Root Cause
Xero API has 60 requests/minute limit. With 500 contacts sync takes 600 seconds

#### Solution
Run Xero sync as background job: XeroContactSyncJob.perform_later

#### Prevention
Large syncs must use background jobs

**Component:** XeroContactSync


## 🏛️ Architecture

### Design Decisions & Rationale

### 1. Contact Type System

**Decision:** PostgreSQL array column for contact_types to support hybrid entities

**Details:**
Uses varchar[] to allow contacts to be both customers and suppliers simultaneously. GIN indexes provide fast querying.


### 2. Supplier Portal - Implementation Plan & Architecture

**Decision:** Complete plan for building supplier portal allowing external access to quotes, POs, and invoices. Features Planned: Separate portal_users authentication, Scoped access to contact data only, Quote approval workflow, PO confirmation, Invoice status tracking. Security Considerations: Separate auth tokens from admin, Row-level security checks, Email verification required, Password complexity requirements. Full plan archived in: PORTAL_IMPLEMENTATION_PLAN.md

**Trade-offs:**
Original file archived at: PORTAL_IMPLEMENTATION_PLAN.md (26.9 KB)


## 🎓 Developer Notes

### Supplier Portal Phase 1 - Completion Summary

Phase 1 completion report for supplier portal. Completed Features: Portal user authentication, Contact association, Quote viewing, Basic dashboard. Pending Features: PO confirmation workflow, Invoice upload, Email notifications, Advanced permissions. Full details in: PORTAL_PHASE1_COMPLETE.md



# Chapter 5: Price Books & Suppliers

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚡ Duplicate Price History Entries on Rapid Updates

**Status:** ⚡ FIXED
**First Reported:** Unknown
**Fixed Date:** 2024-10-12
**Severity:** Medium

#### Summary
When a user rapidly updates the same pricebook item's price multiple times in quick succession (e.g., correcting a typo), duplicate price history entries were created with identical timestamps, causing confusion in price tracking and bloating the database.

#### Scenario
When a user rapidly updates the same pricebook item's price multiple times in quick succession (e.g., correcting a typo), duplicate price history entries were created with identical timestamps, causing confusion in price tracking and bloating the database.

#### Root Cause
- `after_update` callback triggers immediately on each save
- Two saves within the same second create records with identical `created_at` timestamps
- No database constraint prevented duplicate (item_id, supplier_id, price, timestamp) combinations

#### Solution
1. **Database Constraint:** Added unique index on `[:pricebook_item_id, :supplier_id, :new_price, :created_at]` (see Bible RULE #4.2)
2. **5-Second Time Window:** `track_price_change` callback checks if identical price exists within 5 seconds before creating new history
3. **Race Condition Safe:** `rescue ActiveRecord::RecordNotUnique` handles concurrent saves gracefully

**Component:** PricebookItem


### ⚠️ SmartPoLookupService Missing Items Despite Fuzzy Match

**Status:** ⚠️ BY_DESIGN
**First Reported:** Unknown
**Severity:** Low

#### Summary
User creates estimate with item "2x4 Framing Lumber" but SmartPoLookupService doesn't match it to pricebook item "2x4 Douglas Fir Framing" even though Levenshtein distance is 72 (above 70 threshold).

#### Scenario
User creates estimate with item "2x4 Framing Lumber" but SmartPoLookupService doesn't match it to pricebook item "2x4 Douglas Fir Framing" even though Levenshtein distance is 72 (above 70 threshold).

#### Root Cause
- 6-strategy cascade prioritizes **exact match with supplier** and **fuzzy match with supplier** first
- If estimate line item has `preferred_supplier_id` set, strategies 4-6 (without supplier) never run
- User expects all fuzzy matches regardless of supplier constraint

#### Solution
**THIS IS BY DESIGN** - The cascade strategy intentionally respects supplier constraints to ensure:
1. Supplier relationships are honored (e.g., preferred vendors per job)
2. Pricing accuracy (different suppliers have different prices)
3. PO grouping efficiency (minimizes split orders)

**Component:** SmartPoLookupService


### ⚡ Price Volatility False Positives on New Items

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Low

#### Summary
New pricebook items with only 2-3 price history entries show "High Volatility" warnings even when prices are stable, because Coefficient of Variation (CV) is mathematically unreliable with small sample sizes.

#### Scenario
New pricebook items with only 2-3 price history entries show "High Volatility" warnings even when prices are stable, because Coefficient of Variation (CV) is mathematically unreliable with small sample sizes.

#### Root Cause
- CV = (Standard Deviation / Mean) × 100
- Small sample sizes (n < 5) exaggerate CV due to limited data
- First few price updates naturally have higher variance

#### Solution
1. **Minimum Sample Requirement:** `calculate_price_volatility` requires at least 5 price history entries before calculating CV
2. **Return nil for insufficient data:** UI shows "Insufficient Data" instead of misleading volatility score
3. **6-Month Rolling Window:** Only recent prices count, ensuring CV reflects current volatility

**Component:** PricebookItem


### ⚡ Supplier Name Normalization Overly Aggressive

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Low

#### Summary
Two distinct suppliers "ABC Supply LLC" and "ABC Supply Co." both normalize to "ABC SUPPLY", causing incorrect fuzzy matches in SmartPoLookupService.

#### Scenario
Two distinct suppliers "ABC Supply LLC" and "ABC Supply Co." both normalize to "ABC SUPPLY", causing incorrect fuzzy matches in SmartPoLookupService.

#### Root Cause
- Normalization removes common business suffixes: LLC, Inc, Corp, Ltd, Co., Company, Supply Co
- Edge case: "ABC Supply Co." has "Supply Co" suffix removed even though "Supply" is part of business name
- Levenshtein distance calculated on normalized names

#### Solution
**KNOWN LIMITATION** - Current normalization is intentionally broad to catch variations like:
- "Home Depot" vs "Home Depot Inc."
- "Lowes" vs "Lowe's Companies LLC"

**Component:** PricebookItem



# Chapter 6: Jobs & Construction Management

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚡ Task Cascade Infinite Loop Risk

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** High

#### Summary
When task dates change, `ScheduleCascadeService` recursively cascades to dependent tasks. Without proper safeguards, this could create infinite loops in cyclic schedules or repeatedly cascade to manually positioned tasks.

#### Scenario
When task dates change, `ScheduleCascadeService` recursively cascades to dependent tasks. Without proper safeguards, this could create infinite loops in cyclic schedules or repeatedly cascade to manually positioned tasks.

#### Root Cause
- Recursive cascade could revisit the same task multiple times
- Manually positioned tasks (user-set dates) should not be auto-updated
- Circular dependencies could cause infinite recursion

#### Solution
1. **Circular Dependency Prevention:** `TaskDependency` validates `no_circular_dependencies` using BFS graph traversal (see Bible RULE #5.3)
2. **Manual Position Respect:** Skip tasks with `manually_positioned?` flag in cascade
3. **Single Pass Per Task:** Each cascade operation processes downstream once only

**Component:** ScheduleCascadeService


### ⚠️ Profit Calculation Performance at Scale

**Status:** ⚠️ BY_DESIGN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
Construction profit is calculated dynamically via `calculate_live_profit` which sums all PO totals. For jobs with 100+ purchase orders, this can cause N+1 query issues or slow API responses.

#### Scenario
Construction profit is calculated dynamically via `calculate_live_profit` which sums all PO totals. For jobs with 100+ purchase orders, this can cause N+1 query issues or slow API responses.

#### Root Cause
- No caching of profit values (intentional per Bible RULE #5.2)
- Each API request recalculates: `purchase_orders.sum(:total)`
- Construction detail page requests profit multiple times

**Component:** Constructions


### ⚡ OneDrive Folder Creation Failures

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
**Status:** 🟢 HANDLED WITH RETRIES
**Severity:** Medium
**Common Failure Modes:** Token expiration, network timeout, duplicate folder names

**Common Errors:**


### ⚡ Task Spawning Duplicates (Photo/Cert Tasks)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
If parent task status is updated multiple times (e.g., `complete` → `in_progress` → `complete`), photo and certificate tasks could be spawned multiple times.

#### Scenario
If parent task status is updated multiple times (e.g., `complete` → `in_progress` → `complete`), photo and certificate tasks could be spawned multiple times.

#### Root Cause
- `after_save :spawn_child_tasks_on_status_change` fires on every save
- No check for existing spawned tasks before creating

#### Solution
```ruby
# Check which predecessors are blocking
task.blocked_by  # Returns array of incomplete predecessor tasks

# Complete predecessors first, then mark task in_progress

**Component:** ProjectTask



# Chapter 7: Estimates & Quoting

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚠️ Fuzzy Matching False Positives at 70-75% Threshold

**Status:** ⚠️ BY_DESIGN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
Job names like "Smith Residence" might auto-match to "Smith Commercial Building" at 72% confidence when they're completely different projects.

#### Scenario
Job names like "Smith Residence" might auto-match to "Smith Commercial Building" at 72% confidence when they're completely different projects.

#### Root Cause
- 70% auto-match threshold is aggressive
- Word-matching bonus (+15 per word) inflates scores
- "Smith" as common name boosts unrelated jobs

#### Solution
1. **Current:** Users can reject auto-match and manually select correct job
2. **Mitigation:** Threshold tuning based on production data
3. **Future:** Add address-based validation (if addresses available in estimate)


### ⚡ Levenshtein Performance with Very Long Job Names

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Low

#### Summary
Job names exceeding 150 characters (rare but possible) cause Levenshtein calculation to take 50-100ms.

#### Scenario
Job names exceeding 150 characters (rare but possible) cause Levenshtein calculation to take 50-100ms.

#### Root Cause
- O(m*n) complexity where m,n = string lengths
- Matrix allocation for long strings
- Pure Ruby implementation (no C extension)


### ⚡ Estimate Import Fails Silently on Malformed JSON

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** High

#### Summary
If Unreal Engine sends malformed JSON (e.g., trailing commas, unquoted keys), Rails parses it incorrectly and estimate import fails without clear error to user.

#### Scenario
If Unreal Engine sends malformed JSON (e.g., trailing commas, unquoted keys), Rails parses it incorrectly and estimate import fails without clear error to user.

#### Prevention
Validate JSON format before processing in Unreal Engine.

---


### ⚡ AI Review Timeout on Large PDFs

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
PDFs exceeding 50 pages cause Claude API calls to timeout (>5 minutes) even with pagination.

#### Scenario
PDFs exceeding 50 pages cause Claude API calls to timeout (>5 minutes) even with pagination.

#### Root Cause
- Claude has per-request token limits
- 50-page PDFs = 100k+ tokens
- Processing exceeds 5-minute timeout

#### Solution
1. Regenerate key: `integration.generate_api_key`
2. Copy new key to Unreal Engine config
3. Test with curl:
   ```bash
   curl -X POST https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/external/unreal_estimates \
     -H "X-API-Key: YOUR_KEY" \
     -H "Content-Type: application/json" \
     -d '{"job_name": "Test", "materials": [{"item": "Test", "quantity": 1}]}'
   ```

---

### "Estimate Auto-Matched to Wrong Job"

#### Prevention
If this happens frequently:
1. Increase auto-match threshold to 75%
2. Add address validation (if available)
3. Require manual confirmation for 70-75% matches

---

### "AI Review Stuck in 'Processing' Status"

**Component:** EstimateToPurchaseOrderService



# Chapter 8: AI Plan Review

**Last Updated:** 2025-11-17

## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 9: Purchase Orders

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚡ Race Condition in PO Number Generation

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
Two users create POs simultaneously → potential for duplicate PO numbers.

#### Scenario
Two users create POs simultaneously → potential for duplicate PO numbers.


### ⚡ Payment Status Calculation Confusion

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
User sets `amount_paid = $990` on PO with `total = $1000`.
Payment status shows "Part Payment" instead of "Complete".

#### Scenario
User sets `amount_paid = $990` on PO with `total = $1000`.
Payment status shows "Part Payment" instead of "Complete".


### ⚡ Smart Lookup Returns Wrong Supplier

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
User expects "ABC Supplier" but system selects "XYZ Supplier" for item.

#### Scenario
User expects "ABC Supplier" but system selects "XYZ Supplier" for item.

#### Solution
1. Check category default: Settings → Price Books → Categories
2. Update default supplier if needed
3. Or manually override after smart lookup


### ⚡ Price Drift Warning on First-Time Items

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Low

#### Summary
New item has no pricebook entry → shows "N/A" drift → confusing to users.

#### Scenario
New item has no pricebook entry → shows "N/A" drift → confusing to users.

#### Solution
```ruby
ActiveRecord::Base.transaction do
  # Step 1: Unlink old task
  if old_task = purchase_order.schedule_task
    old_task.update!(purchase_order_id: nil)
  end

  # Step 2: Link new task
  if new_task_id.present?
    new_task = ScheduleTask.find(new_task_id)
    new_task.update!(purchase_order_id: purchase_order.id)
  end
end


## 🏛️ Architecture

### Design Decisions & Rationale

### 1. Task Management System - Comprehensive Architecture Investigation

**Decision:** Complete investigation of ProjectTask and ScheduleTask models, Gantt visualization, and user assignment system

**Details:**
# TEEEM Task Management, Gantt Chart & User Assignment - Comprehensive Investigation Report

## Executive Summary

The TEEEM application has a **comprehensive task management and scheduling system** with two distinct architectures:

1. **Project Tasks (Master Schedule)** - For detailed project planning with dependencies, critical path analysis, and granular user assignment
2. **Schedule Tasks (Construction Schedule)** - For tracking supplier deliveries and linking to purchase orders

Both systems include Gantt chart visualizations and task status tracking. The application is architecturally sound with clear separation between frontend components and backend models.

---

## 1. TASK/TODO MODELS

### 1.1 ProjectTask Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/project_task.rb`

**Key Attributes:**
- `name` (string, required) - Task name
- `task_type` (string, required) - Task classification (ORDER, DO, GET, CLAIM, CERTIFICATE, PHOTO, FIT)
- `category` (string, required) - Trade/category (ADMIN, CARPENTER, ELECTRICAL, PLUMBER, etc.)
- `status` (string, default: 'not_started') - States: `not_started`, `in_progress`, `complete`, `on_hold`
- `progress_percentage` (integer, 0-100, default: 0)
- `duration_days` (integer, required) - Task duration in days
- `planned_start_date` (date) - Scheduled start
- `planned_end_date` (date) - Scheduled end
- `actual_start_date` (date) - Actual start when moved to in_progress
- `actual_end_date` (date) - Actual completion date
- `is_milestone` (boolean, default: false) - Mark as project milestone
- `is_critical_path` (boolean, default: false) - On critical path
- `task_code` (string) - Code for dependency references
- `supplier_name` (string) - External supplier name

**Relationships:**
```ruby
belongs_to :project
belongs_to :task_template, optional: true
belongs_to :purchase_order, optional: true
belongs_to :assigned_to, class_name: 'User', optional: true  # User assignment

has_many :successor_dependencies    # Tasks that depend on this
has_many :predecessor_dependencies  # Tasks this depends on
has_many :successor_tasks, through: :successor_dependencies
has_many :predecessor_tasks, through: :predecessor_dependencies
has_many :task_updates, dependent: :destroy  # Status history
```

**Key Methods:**
- `complete!` - Mark task as complete with 100% progress
- `start!` - Move task to in_progress
- `can_start?` - Check if all predecessors are complete
- `blocked_by` - Returns incomplete predecessor tasks
- `total_float` - Calculates slack time (simplified)
- `is_on_critical_path?` - Check critical path status
- `materials_status` - Returns 'no_po', 'on_time', or 'delayed'
- `materials_on_time?` - Check if linked PO will arrive before task start

**Database:** `/Users/jakebaird/teeem/backend/db/migrate/20251104053318_create_project_tasks.rb`

---

### 1.2 ScheduleTask Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/schedule_task.rb`

**Key Attributes:**
- `title` (string, required) - Task name
- `status` (string) - Task status
- `start_date` (datetime) - Start date
- `complete_date` (datetime) - Completion date
- `duration` (string) - Duration string (e.g., "5d", "21d")
- `duration_days` (integer) - Parsed duration in days
- `supplier_category` (string) - Supplier category
- `supplier_name` (string) - Supplier name
- `paid_internal` (boolean)
- `confirm` (boolean) - Confirmation flag
- `supplier_confirm` (boolean) - Supplier confirmation
- `task_started` (datetime)
- `completed` (datetime)
- `predecessors` (jsonb, array) - Task dependencies as IDs
- `attachments` (text) - File attachments
- `matched_to_po` (boolean) - Is matched to a purchase order
- `sequence_order` (integer) - Original order from spreadsheet import

**Relationships:**
```ruby
belongs_to :construction
belongs_to :purchase_order, optional: true
```

**Key Methods:**
- `match_to_purchase_order!(po)` - Link to a purchase order
- `unmatch_from_purchase_order!` - Remove purchase order link
- `to_gantt_format` - Returns data formatted for Gantt chart display
- `calculate_end_date` - Computes end date from start + duration
- `calculate_progress` - Returns progress percentage (0, 50, or 100)
- `suggested_purchase_orders(limit = 5)` - Suggests matching POs based on title

**Database:** `/Users/jakebaird/teeem/backend/db/migrate/20251105051002_create_schedule_tasks.rb`

---

### 1.3 TaskTemplate Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/task_template.rb`

**Purpose:** Standard NDIS construction task templates used to create ProjectTasks

**Key Attributes:**
- `name` (string) - Template name
- `task_type` (string) - Task type code
- `category` (string) - Trade category
- `default_duration_days` (integer) - Default duration
- `sequence_order` (integer) - Execution sequence
- `predecessor_template_codes` (integer array) - Dependency references
- `is_milestone` (boolean)
- `requires_photo` (boolean)
- `is_standard` (boolean) - Standard vs custom template

**Relationships:**
```ruby
has_many :project_tasks
```

**Scopes:**
- `standard` - Filter to standard templates
- `custom` - Filter to custom templates
- `by_sequence` - Order by sequence
- `milestones` - Templates marked as milestones

**Database:** `/Users/jakebaird/teeem/backend/db/migrate/20251104053317_create_task_templates.rb`

---

### 1.4 TaskDependency Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/task_dependency.rb`

**Purpose:** Define task relationships and constraints

**Key Attributes:**
- `successor_task_id` (required) - Task that depends on predecessor
- `predecessor_task_id` (required) - Task that must complete first
- `dependency_type` (string) - Relationship type
- `lag_days` (integer, default: 0) - Time gap between tasks

**Dependency Types:**
```ruby
DEPENDENCY_TYPES = {
  'fs' => 'finish_to_start',    # Standard: predecessor finishes, successor starts
  'ss' => 'start_to_start',     # Tasks start together
  'ff' => 'finish_to_finish',   # Tasks finish together
  'sf' => 'start_to_finish'     # Rare: predecessor starts, successor finishes
}
```

**Validations:**
- Prevents circular dependencies
- Prevents self-dependencies
- Ensures tasks are in same project
- Unique constraint on (successor_task_id, predecessor_task_id) pair

**Key Methods:**
- `creates_circular_dependency?` - DFS-based cycle detection

**Database:** `/Users/jakebaird/teeem/backend/db/migrate/20251104053320_create_task_dependencies.rb`

---

### 1.5 TaskUpdate Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/task_update.rb`

**Purpose:** Track task status changes and progress updates over time

**Key Attributes:**
- `project_task_id` (required) - Associated task
- `user_id` (required) - User who made update
- `status_before` (string) - Previous status
- `status_after` (string) - New status
- `progress_before` (integer) - Previous progress %
- `progress_after` (integer) - New progress %
- `notes` (text) - Update notes
- `photo_urls` (text array) - Attached photos
- `update_date` (date) - When update occurred

**Relationships:**
```ruby
belongs_to :project_task
belongs_to :user
```

**Key Methods:**
- `status_changed?` - Check if status changed
- `progress_changed?` - Check if progress changed
- `has_photos?` - Check if photos attached
- `summary` - Generate update summary

**Database:** `/Users/jakebaird/teeem/backend/db/migrate/20251104053321_create_task_updates.rb`

---

### 1.6 User Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/user.rb`

**Key Attributes:**
- `email` (string, unique)
- `name` (string)
- `password_digest` - bcrypt hashed password

**Relationships:**
```ruby
has_many :grok_plans, dependent: :destroy
```

**Note:** User model is minimal. Frontend maintains hardcoded team members for assignment UI.

---

## 2. GANTT CHART IMPLEMENTATION

### 2.1 Backend API Endpoints

#### ProjectTasks Gantt Data
**Route:** `GET /api/v1/projects/:id/gantt`  
**File:** `/Users/jakebaird/teeem/backend/app/controllers/api/v1/projects_controller.rb`

**Response:**
```json
{
  "project": {
    "id": 1,
    "name": "Project Name",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "status": "active"
  },
  "tasks": [
    {
      "id": 1,
      "name": "Task Name",
      "task_type": "DO",
      "category": "CONCRETE",
      "status": "not_started",
      "progress": 0,
      "start_date": "2025-01-15",
      "end_date": "2025-01-20",
      "actual_start": null,
      "actual_end": null,
      "duration": 5,
      "is_milestone": false,
      "is_critical_path": false,
      "assigned_to": "Rob Harder",
      "supplier": "Supplier Name",
      "predecessors": [5, 6],
      "successors": [10, 11],
      "purchase_order": {
        "id": 42,
        "number": "PO-001",
        "total": 5000.00
      }
    }
  ],
  "dependencies": [
    {
      "id": 1,
      "source": 5,
      "target": 1,
      "type": "finish_to_start",
      "lag": 0
    }
  ]
}
```

**Controller:** `ProjectTasksController#index`
- Includes task_template, purchase_order, assigned_to
- Ordered by planned_start_date, sequence_order
- Returns materials_status for each task

---

#### ScheduleTasks Gantt Data
**Route:** `GET /api/v1/constructions/:construction_id/schedule_tasks/gantt_data`  
**File:** `/Users/jakebaird/teeem/backend/app/controllers/api/v1/schedule_tasks_controller.rb`

**Response:**
```json
{
  "success": true,
  "gantt_tasks": [
    {
      "id": 1,
      "title": "Pour Concrete",
      "start_date": "2025-01-15",
      "end_date": "2025-01-20",
      "duration_days": 5,
      "status": "in_progress",
      "supplier_category": "CONCRETE",
      "supplier_name": "ABC Concrete",
      "purchase_order_id": 42,
      "purchase_order_number": "PO-001",
      "predecessors": [5, 6],
      "progress": 50
    }
  ],
  "count": 15
}
```

---

### 2.2 Frontend Components

#### GanttChart Component
**Location:** `/Users/jakebaird/teeem/frontend/src/components/gantt/GanttChart.jsx`

**Props:**
```javascript
{
  tasks: Array,           // Task data array
  projectInfo: Object,    // Project metadata
  colorBy: String,        // 'status', 'category', or 'type'
  colorConfig: Object     // Color scheme customization
}
```

**Features:**
- **Zoom Levels:** Days, weeks, months
- **Date Navigation:** Previous/Next period, "Today" button
- **Dynamic Pixels Per Day:**
  - Days: 40px/day
  - Weeks: 6px/day
  - Months: 2px/day
- **Components Used:**
  - `GanttHeader` - Date headers
  - `GanttGrid` - Background grid
  - `TaskRow` - Individual task bars

**State Management:**
- `zoomLevel` - Current zoom
- `showWeekends` - Weekend visibility toggle
- `currentDate` - Navigation date

---

#### TaskTable Component
**Location:** `/Users/jakebaird/teeem/frontend/src/components/gantt/TaskTable.jsx`

**Features:**
- **Inline Editing:** Click any field to edit
- **Sortable Columns:** Click headers to sort (asc/desc/unsorted)
- **Dropdowns:** Team member and supplier assignment
- **Progress Bars:** Visual representation with percentage
- **Color Coding:** By status, category, or type
- **Special Badges:** Milestone (M) and Critical Path indicators

**Columns:**
1. Task Name
2. Status
3. Category
4. Start Date
5. End Date
6. Duration
7. Progress (bar + percentage)
8. Assigned To (dropdown)
9. Supplier (dropdown)
10. Type

**Supported Edits:**
- Text fields: name, notes
- Date fields: planned_start_date, planned_end_date
- Number fields: duration_days, progress_percentage
- Dropdowns: assigned_to, supplier_name

---

#### ScheduleGanttChart Component
**Location:** `/Users/jakebaird/teeem/frontend/src/components/schedule-master/ScheduleGanttChart.jsx`

**Purpose:** Displays supplier delivery schedule Gantt view  
**Props:** `ganttData` (from backend)

---

#### ScheduleMasterTab Component
**Location:** `/Users/jakebaird/teeem/frontend/src/components/schedule-master/ScheduleMasterTab.jsx`

**Features:**
- **Task Import:** Excel file upload for schedule
- **Task Matching:** Link schedule tasks to purchase orders
- **Statistics:** Matched vs unmatched task counts
- **Gantt Display:** Only shows matched tasks in timeline view

**Sub-components:**
- `ScheduleImporter` - File upload
- `ScheduleStats` - Summary cards
- `ScheduleTaskList` - Task listing and matching UI
- `ScheduleGanttChart` - Timeline view
- `TaskMatchModal` - PO selection dialog

---

### 2.3 Color Schemes
**File:** `/Users/jakebaird/teeem/frontend/src/components/gantt/utils/colorSchemes.js`

**Status Colors:**
- Not Started: #C4C4C4 (Gray)
- In Progress: #579BFC (Blue)
- Complete: #00C875 (Green)
- On Hold/Blocked: #E44258 (Red)

**Customizable Color Config:**
```javascript
{
  status: {
    'not_started': { badge: 'bg-gray-100 text-gray-900', bar: '#C4C4C4' },
    'in_progress': { badge: 'bg-blue-100 text-blue-900', bar: '#579BFC' },
    'complete': { badge: 'bg-green-100 text-green-900', bar: '#00C875' },
    // ... more
  },
  category: { /* colors by category */ },
  type: { /* colors by type */ }
}
```

---

## 3. USER ASSIGNMENT

### 3.1 Current Implementation

#### Backend Assignment
**Model:** `ProjectTask` has `assigned_to_id` foreign key to User

**Field:**
```ruby
belongs_to :assigned_to, class_name: 'User', optional: true
```

**API Update:**
```
PATCH /api/v1/projects/:project_id/tasks/:id
{
  "project_task": {
    "assigned_to_id": 5  # User ID
  }
}
```

---

#### Frontend Team Selection
**Location:** `/Users/jakebaird/teeem/frontend/src/components/gantt/TaskTable.jsx`

**Hardcoded Team Members:**
```javascript
const teamMembers = [
  { name: 'Rob Harder', avatar: 'https://images.unsplash.com/...' },
  { name: 'Andrew Clement', avatar: 'https://images.unsplash.com/...' },
  { name: 'Sam Harder', avatar: 'https://images.unsplash.com/...' },
  { name: 'Sophie Harder', avatar: 'https://images.unsplash.com/...' },
  { name: 'Jake Baird', avatar: 'https://images.unsplash.com/...' },
]
```

**Component:** `AssignedUserDropdown`
- Headless UI Listbox
- Avatar display
- Unassigned option
- Calls `onTaskUpdate(taskId, 'assigned_to', memberName)`

---

### 3.2 What's Missing

1. **Dynamic User Fetching** - Users hardcoded in frontend
2. **User API Endpoint** - No endpoint to fetch active team members
3. **User Roles/Permissions** - No role-based assignments
4. **Workload Tracking** - No capacity planning
5. **Team Structure** - No team/department organization
6. **Assignment Notifications** - No notification system

---

## 4. PROJECT/SCHEDULE MANAGEMENT ARCHITECTURE

### 4.1 Hierarchy
```
Organization
  └─ Construction (Job)
      ├─ Project (Master Schedule)
      │   └─ ProjectTasks (with dependencies, users, POs)
      ├─ ScheduleTasks (supplier deliveries)
      └─ PurchaseOrders
```

---

### 4.2 Construction Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/construction.rb`

**Key Attributes:**
- `title` (string, required)
- `status` (string)
- `contract_value` (decimal)
- `site_supervisor_name` (string)
- `site_supervisor_email` (string)
- `site_supervisor_phone` (string)
- `profit_percentage` (decimal)
- `live_profit` (decimal)

**Relationships:**
```ruby
has_many :purchase_orders, dependent: :destroy
has_many :schedule_tasks, dependent: :destroy
has_many :estimates, dependent: :nullify
has_one :project, dependent: :destroy
has_one :one_drive_credential, dependent: :destroy
belongs_to :design, optional: true
```

**Key Methods:**
- `create_project!(project_manager:, name: nil)` - Create Master Schedule
- `schedule_ready?` - Check if has POs for schedule
- `calculate_live_profit` - Contract value minus all POs
- `create_folders_if_needed!` - Trigger OneDrive folder creation

---

### 4.3 Project Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/project.rb`

**Key Attributes:**
- `name` (string)
- `project_code` (string, unique)
- `status` (string, one of: planning, active, complete, on_hold)
- `start_date` (date)
- `planned_end_date` (date)
- `actual_end_date` (date)
- `project_manager_id` (references User)

**Relationships:**
```ruby
belongs_to :project_manager, class_name: 'User'
belongs_to :construction
has_many :project_tasks, dependent: :destroy
has_many :purchase_orders, through: :construction
```

**Key Methods:**
- `progress_percentage` - Average of all task progress (cached 5 min)
- `days_remaining` - Days until planned_end_date
- `on_schedule?` - Critical path vs. planned end
- `critical_path_tasks` - Tasks on critical path
- `overdue_tasks` - Past end date, not complete
- `upcoming_tasks` - Due within 1 week, not started

---

### 4.4 Schedule Generation Service
**Location:** `/Users/jakebaird/teeem/backend/app/services/schedule/generator_service.rb`

**Purpose:** Generate complete Master Schedule from templates and purchase orders

**Workflow:**
1. **Create Tasks from Templates** - Instantiate all NDIS task templates
2. **Map Purchase Orders** - Link POs to matching tasks by category
3. **Establish Dependencies** - Create task relationships from template hierarchy
4. **Calculate Timeline** - Forward pass algorithm for dates
5. **Identify Critical Path** - Find longest path through network
6. **Update Project Status** - Mark as active with generation timestamp

**Category Mapping:**
```ruby
{
  'CONCRETE' => { categories: ['CONCRETE'], types: ['DO', 'ORDER'] },
  'CARPENTER' => { categories: ['CARPENTER'], types: ['DO', 'ORDER'] },
  # ... 20+ trades mapped
}
```

**Timeline Calculation:**
- Topological sort for execution order
- Forward pass for earliest start/finish
- Supports all 4 dependency types
- Lag days for task overlap

**Critical Path:**
- Uses longest path algorithm
- Currently simplified (needs backward pass for accuracy)

---

## 5. EXISTING FEATURES

### 5.1 What's Working

#### Task Creation & Management
- [x] Create tasks from templates
- [x] Manual task creation
- [x] Duplicate/clone tasks
- [x] Delete tasks
- [x] Task status tracking (4 states)
- [x] Progress percentage (0-100)
- [x] Duration planning in days

#### Scheduling & Planning
- [x] Planned start/end dates
- [x] Actual start/end dates (auto-set on status change)
- [x] Task dependencies (4 types)
- [x] Circular dependency prevention
- [x] Dependency lag/overlap support
- [x] Critical path identification
- [x] Milestone marking

#### User Assignment
- [x] Assign users to tasks
- [x] Unassigned state
- [x] User display with name

#### Purchase Order Linking
- [x] Link PO to task
- [x] Materials status tracking (no_po/on_time/delayed)
- [x] Delivery timing validation
- [x] On-site date requirements

#### Gantt Visualization
- [x] Grid-based visual timeline
- [x] Zoom levels (day/week/month)
- [x] Date navigation
- [x] Color by status/category/type
- [x] Custom color schemes
- [x] Task bar for each activity
- [x] Legend display

#### Table View
- [x] Spreadsheet-like interface
- [x] Inline editing (click-to-edit)
- [x] Sortable columns
- [x] User dropdown selection
- [x] Date picker inputs
- [x] Progress bars with percentage
- [x] Special badges (milestone, critical)

#### Schedule Import
- [x] Excel file upload
- [x] Automatic schedule task creation
- [x] Match to purchase orders
- [x] Supplier tracking
- [x] Task linking (predecessors)

#### Status Tracking
- [x] Task updates with history
- [x] Status change logging
- [x] Progress tracking
- [x] Photo attachments
- [x] Notes/comments

---

### 5.2 What Needs Development

#### User Management
- [ ] Dynamic user list from database (currently hardcoded)
- [ ] User roles and permissions
- [ ] Team management
- [ ] User workload/capacity planning
- [ ] User availability calendar

#### Advanced Scheduling
- [ ] Backward pass for accurate float calculation
- [ ] True critical path with float values
- [ ] Resource-leveling
- [ ] Constraint handling (external, mandatory milestones)
- [ ] Multi-project scheduling
- [ ] Schedule optimization

#### Collaboration
- [ ] Task comments/discussions
- [ ] @mentions and notifications
- [ ] Change tracking (who changed what, when)
- [ ] Real-time updates (WebSockets)
- [ ] Document attachments per task

#### Analytics & Reporting
- [ ] Schedule variance (planned vs actual)
- [ ] Performance metrics
- [ ] Burn-down charts
- [ ] Resource utilization reports
- [ ] Cost-to-schedule tracking

#### Mobile Support
- [ ] Mobile Gantt view
- [ ] Task updates from site
- [ ] Photo uploads from mobile
- [ ] Offline capability

#### Advanced Features
- [ ] Template task dependencies (for reuse)
- [ ] Recurring tasks
- [ ] Task allocation to multiple users
- [ ] Sub-task hierarchies
- [ ] Effort/cost estimation
- [ ] Risk register integration

---

## 6. KEY FILE LOCATIONS REFERENCE

### Backend Models
| File | Purpose |
|------|---------|
| `/Users/jakebaird/teeem/backend/app/models/project_task.rb` | Main task model |
| `/Users/jakebaird/teeem/backend/app/models/schedule_task.rb` | Supplier schedule model |
| `/Users/jakebaird/teeem/backend/app/models/task_template.rb` | Template base |
| `/Users/jakebaird/teeem/backend/app/models/task_dependency.rb` | Task relationships |
| `/Users/jakebaird/teeem/backend/app/models/task_update.rb` | Change history |
| `/Users/jakebaird/teeem/backend/app/models/project.rb` | Master schedule container |
| `/Users/jakebaird/teeem/backend/app/models/construction.rb` | Job/project container |
| `/Users/jakebaird/teeem/backend/app/models/user.rb` | User accounts |

### Backend Controllers
| File | Purpose |
|------|---------|
| `/Users/jakebaird/teeem/backend/app/controllers/api/v1/project_tasks_controller.rb` | Task CRUD API |
| `/Users/jakebaird/teeem/backend/app/controllers/api/v1/schedule_tasks_controller.rb` | Schedule task API |
| `/Users/jakebaird/teeem/backend/app/controllers/api/v1/projects_controller.rb` | Project & Gantt API |

### Backend Services
| File | Purpose |
|------|---------|
| `/Users/jakebaird/teeem/backend/app/services/schedule/generator_service.rb` | Schedule generation |
| `/Users/jakebaird/teeem/backend/app/services/spreadsheet_parser.rb` | Excel import |

### Frontend Components
| File | Purpose |
|------|---------|
| `/Users/jakebaird/teeem/frontend/src/components/gantt/GanttChart.jsx` | Main Gantt visualization |
| `/Users/jakebaird/teeem/frontend/src/components/gantt/TaskTable.jsx` | Task table with inline edit |
| `/Users/jakebaird/teeem/frontend/src/components/gantt/TaskRow.jsx` | Individual task bar |
| `/Users/jakebaird/teeem/frontend/src/components/gantt/GanttHeader.jsx` | Date header |
| `/Users/jakebaird/teeem/frontend/src/components/gantt/GanttGrid.jsx` | Background grid |
| `/Users/jakebaird/teeem/frontend/src/components/schedule-master/ScheduleMasterTab.jsx` | Schedule UI container |
| `/Users/jakebaird/teeem/frontend/src/components/schedule-master/ScheduleGanttChart.jsx` | Supplier Gantt |
| `/Users/jakebaird/teeem/frontend/src/components/schedule-master/ScheduleImporter.jsx` | Excel upload |
| `/Users/jakebaird/teeem/frontend/src/components/schedule-master/TaskMatchModal.jsx` | PO matching dialog |
| `/Users/jakebaird/teeem/frontend/src/pages/MasterSchedulePage.jsx` | Master schedule page |
| `/Users/jakebaird/teeem/frontend/src/pages/JobDetailPage.jsx` | Job detail tabs |

### Frontend Pages
| File | Purpose |
|------|---------|
| `/Users/jakebaird/teeem/frontend/src/pages/MasterSchedulePage.jsx` | Full schedule view |
| `/Users/jakebaird/teeem/frontend/src/pages/JobDetailPage.jsx` | Job with "Schedule Master" tab |

### Database Migrations
| File | Tables |
|------|--------|
| `20251104053317_create_task_templates.rb` | task_templates |
| `20251104053318_create_project_tasks.rb` | project_tasks |
| `20251104053320_create_task_dependencies.rb` | task_dependencies |
| `20251104053321_create_task_updates.rb` | task_updates |
| `20251105051002_create_schedule_tasks.rb` | schedule_tasks |

### Routes
**Main Routes:** `/Users/jakebaird/teeem/backend/config/routes.rb`

**Task Endpoints:**
```
GET     /api/v1/projects/:project_id/tasks               (index)
POST    /api/v1/projects/:project_id/tasks               (create)
GET     /api/v1/projects/:project_id/tasks/:id           (show)
PATCH   /api/v1/projects/:project_id/tasks/:id           (update)
DELETE  /api/v1/projects/:project_id/tasks/:id           (destroy)
GET     /api/v1/projects/:id/gantt                       (gantt data)

GET     /api/v1/constructions/:construction_id/schedule_tasks
POST    /api/v1/constructions/:construction_id/schedule_tasks/import
GET     /api/v1/constructions/:construction_id/schedule_tasks/gantt_data
PATCH   /api/v1/schedule_tasks/:id/match_po
DELETE  /api/v1/schedule_tasks/:id/unmatch_po
```

---

## 7. DATA RELATIONSHIPS DIAGRAM

```
User
  ├── created projects (project_manager_id)
  └── created task_updates

Construction (Job)
  ├── has one Project (Master Schedule)
  │   ├── has many ProjectTasks
  │   │   ├── assigned_to → User
  │   │   ├── task_template → TaskTemplate
  │   │   ├── purchase_order → PurchaseOrder
  │   │   ├── has many successor_dependencies (as predecessor)
  │   │   ├── has many predecessor_dependencies (as successor)
  │   │   ├── has many successor_tasks
  │   │   ├── has many predecessor_tasks
  │   │   └── has many task_updates
  │   └── has many purchase_orders (through construction)
  │
  ├── has many ScheduleTasks
  │   └── purchase_order → PurchaseOrder
  │
  └── has many PurchaseOrders
      └── required_on_site_date (delivery date)

TaskTemplate
  ├── has many ProjectTasks
  └── predecessor_template_codes (references other templates)

TaskDependency
  ├── successor_task → ProjectTask
  └── predecessor_task → ProjectTask
```

---

## 8. API CONTRACT SUMMARY

### ProjectTask Update
```
PATCH /api/v1/projects/:project_id/tasks/:id
{
  "project_task": {
    "name": "string",
    "status": "not_started|in_progress|complete|on_hold",
    "planned_start_date": "2025-01-15",
    "planned_end_date": "2025-01-20",
    "duration_days": 5,
    "progress_percentage": 50,
    "assigned_to_id": 3,
    "supplier_name": "string",
    "is_milestone": false,
    "is_critical_path": false,
    "notes": "string"
  }
}
```

### ScheduleTask Import
```
POST /api/v1/constructions/:construction_id/schedule_tasks/import
Content-Type: multipart/form-data
{
  "file": <Excel file>
}
```

**Expected Excel Columns:**
- Title, Status, Start, Complete, Duration
- Supplier Category, Supplier, Paid Internal
- Approx Date, Confirm, Supplier Confirm
- Task Started, Completed, Predecessors, Attachments

---

## 9. KEY STATISTICS

### Database Tables
- **Total Task-Related Tables:** 5 (ProjectTask, ScheduleTask, TaskTemplate, TaskDependency, TaskUpdate)
- **Total Relationships:** 12+
- **Supported Dependency Types:** 4
- **Task Statuses:** 4
- **Task Types:** 7+
- **Trade Categories:** 20+

### Frontend Components
- **Gantt-Related:** 8 components
- **Schedule Management:** 5 components
- **UI Pages:** 2 main pages for scheduling

### Code Statistics
- **Backend Models:** ~500 lines
- **Backend Controllers:** ~300 lines
- **Backend Services:** ~350 lines
- **Frontend Components:** ~2000+ lines
- **Migrations:** 5 task-related migrations

---

## 10. RECOMMENDATIONS & NEXT STEPS

### Immediate (High Priority)
1. **Fetch Users Dynamically** - Create `/api/v1/users` endpoint to populate team dropdown
2. **User Profiles** - Add avatar URLs to User model
3. **Task CRUD Forms** - Create modal for adding/editing tasks instead of inline edit

### Short-term (Medium Priority)
1. **Backward Pass Algorithm** - Implement for accurate critical path calculation
2. **Float Calculation** - Calculate slack time per task
3. **Export Functionality** - Export Gantt chart as PDF/PNG
4. **Notifications** - Task assignment notifications to users
5. **Comments/Notes** - Per-task discussion threads

### Medium-term (Nice to Have)
1. **Resource Leveling** - Optimize schedule for resource constraints
2. **Cost Integration** - Track task costs and budget
3. **Mobile App** - Responsive Gantt view
4. **Real-time Sync** - WebSocket updates for multi-user editing
5. **Advanced Analytics** - Schedule variance reports

### Long-term (Strategic)
1. **Multi-project Management** - Portfolio-level scheduling
2. **Risk Management** - Risk register integration
3. **AI Assistant** - Schedule optimization recommendations
4. **Third-party Integration** - MS Project, Primavera import
5. **Capacity Planning** - Resource pool management

---

## CONCLUSION

TEEEM has a **solid, well-architected task management foundation** with:
- ✅ Comprehensive data models with proper relationships
- ✅ Working Gantt chart visualization with multiple zoom levels
- ✅ Task dependency tracking with circular dependency prevention
- ✅ Critical path identification
- ✅ Purchase order integration
- ✅ Excel schedule import capability
- ✅ Flexible inline editing UI

The system is **production-ready for basic to intermediate project scheduling** but needs enhancement for advanced resource management and multi-project portfolio planning. The separation between ProjectTasks (detailed planning) and ScheduleTasks (supplier tracking) is well-designed and allows for flexible use cases.



# Chapter 9: Gantt & Schedule Master

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚡ Race Condition in PO Number Generation

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
Two users create POs simultaneously → potential for duplicate PO numbers.

#### Scenario
Two users create POs simultaneously → potential for duplicate PO numbers.


### ⚡ Payment Status Calculation Confusion

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
User sets `amount_paid = $990` on PO with `total = $1000`.
Payment status shows "Part Payment" instead of "Complete".

#### Scenario
User sets `amount_paid = $990` on PO with `total = $1000`.
Payment status shows "Part Payment" instead of "Complete".


### ⚡ Smart Lookup Returns Wrong Supplier

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
User expects "ABC Supplier" but system selects "XYZ Supplier" for item.

#### Scenario
User expects "ABC Supplier" but system selects "XYZ Supplier" for item.

#### Solution
1. Check category default: Settings → Price Books → Categories
2. Update default supplier if needed
3. Or manually override after smart lookup


### ⚡ Price Drift Warning on First-Time Items

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Low

#### Summary
New item has no pricebook entry → shows "N/A" drift → confusing to users.

#### Scenario
New item has no pricebook entry → shows "N/A" drift → confusing to users.

#### Solution
```ruby
ActiveRecord::Base.transaction do
  # Step 1: Unlink old task
  if old_task = purchase_order.schedule_task
    old_task.update!(purchase_order_id: nil)
  end

  # Step 2: Link new task
  if new_task_id.present?
    new_task = ScheduleTask.find(new_task_id)
    new_task.update!(purchase_order_id: purchase_order.id)
  end
end


## 🏛️ Architecture

### Design Decisions & Rationale

### 1. Task Management System - Comprehensive Architecture Investigation

**Decision:** Complete investigation of ProjectTask and ScheduleTask models, Gantt visualization, and user assignment system

**Details:**
# TEEEM Task Management, Gantt Chart & User Assignment - Comprehensive Investigation Report

## Executive Summary

The TEEEM application has a **comprehensive task management and scheduling system** with two distinct architectures:

1. **Project Tasks (Master Schedule)** - For detailed project planning with dependencies, critical path analysis, and granular user assignment
2. **Schedule Tasks (Construction Schedule)** - For tracking supplier deliveries and linking to purchase orders

Both systems include Gantt chart visualizations and task status tracking. The application is architecturally sound with clear separation between frontend components and backend models.

---

## 1. TASK/TODO MODELS

### 1.1 ProjectTask Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/project_task.rb`

**Key Attributes:**
- `name` (string, required) - Task name
- `task_type` (string, required) - Task classification (ORDER, DO, GET, CLAIM, CERTIFICATE, PHOTO, FIT)
- `category` (string, required) - Trade/category (ADMIN, CARPENTER, ELECTRICAL, PLUMBER, etc.)
- `status` (string, default: 'not_started') - States: `not_started`, `in_progress`, `complete`, `on_hold`
- `progress_percentage` (integer, 0-100, default: 0)
- `duration_days` (integer, required) - Task duration in days
- `planned_start_date` (date) - Scheduled start
- `planned_end_date` (date) - Scheduled end
- `actual_start_date` (date) - Actual start when moved to in_progress
- `actual_end_date` (date) - Actual completion date
- `is_milestone` (boolean, default: false) - Mark as project milestone
- `is_critical_path` (boolean, default: false) - On critical path
- `task_code` (string) - Code for dependency references
- `supplier_name` (string) - External supplier name

**Relationships:**
```ruby
belongs_to :project
belongs_to :task_template, optional: true
belongs_to :purchase_order, optional: true
belongs_to :assigned_to, class_name: 'User', optional: true  # User assignment

has_many :successor_dependencies    # Tasks that depend on this
has_many :predecessor_dependencies  # Tasks this depends on
has_many :successor_tasks, through: :successor_dependencies
has_many :predecessor_tasks, through: :predecessor_dependencies
has_many :task_updates, dependent: :destroy  # Status history
```

**Key Methods:**
- `complete!` - Mark task as complete with 100% progress
- `start!` - Move task to in_progress
- `can_start?` - Check if all predecessors are complete
- `blocked_by` - Returns incomplete predecessor tasks
- `total_float` - Calculates slack time (simplified)
- `is_on_critical_path?` - Check critical path status
- `materials_status` - Returns 'no_po', 'on_time', or 'delayed'
- `materials_on_time?` - Check if linked PO will arrive before task start

**Database:** `/Users/jakebaird/teeem/backend/db/migrate/20251104053318_create_project_tasks.rb`

---

### 1.2 ScheduleTask Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/schedule_task.rb`

**Key Attributes:**
- `title` (string, required) - Task name
- `status` (string) - Task status
- `start_date` (datetime) - Start date
- `complete_date` (datetime) - Completion date
- `duration` (string) - Duration string (e.g., "5d", "21d")
- `duration_days` (integer) - Parsed duration in days
- `supplier_category` (string) - Supplier category
- `supplier_name` (string) - Supplier name
- `paid_internal` (boolean)
- `confirm` (boolean) - Confirmation flag
- `supplier_confirm` (boolean) - Supplier confirmation
- `task_started` (datetime)
- `completed` (datetime)
- `predecessors` (jsonb, array) - Task dependencies as IDs
- `attachments` (text) - File attachments
- `matched_to_po` (boolean) - Is matched to a purchase order
- `sequence_order` (integer) - Original order from spreadsheet import

**Relationships:**
```ruby
belongs_to :construction
belongs_to :purchase_order, optional: true
```

**Key Methods:**
- `match_to_purchase_order!(po)` - Link to a purchase order
- `unmatch_from_purchase_order!` - Remove purchase order link
- `to_gantt_format` - Returns data formatted for Gantt chart display
- `calculate_end_date` - Computes end date from start + duration
- `calculate_progress` - Returns progress percentage (0, 50, or 100)
- `suggested_purchase_orders(limit = 5)` - Suggests matching POs based on title

**Database:** `/Users/jakebaird/teeem/backend/db/migrate/20251105051002_create_schedule_tasks.rb`

---

### 1.3 TaskTemplate Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/task_template.rb`

**Purpose:** Standard NDIS construction task templates used to create ProjectTasks

**Key Attributes:**
- `name` (string) - Template name
- `task_type` (string) - Task type code
- `category` (string) - Trade category
- `default_duration_days` (integer) - Default duration
- `sequence_order` (integer) - Execution sequence
- `predecessor_template_codes` (integer array) - Dependency references
- `is_milestone` (boolean)
- `requires_photo` (boolean)
- `is_standard` (boolean) - Standard vs custom template

**Relationships:**
```ruby
has_many :project_tasks
```

**Scopes:**
- `standard` - Filter to standard templates
- `custom` - Filter to custom templates
- `by_sequence` - Order by sequence
- `milestones` - Templates marked as milestones

**Database:** `/Users/jakebaird/teeem/backend/db/migrate/20251104053317_create_task_templates.rb`

---

### 1.4 TaskDependency Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/task_dependency.rb`

**Purpose:** Define task relationships and constraints

**Key Attributes:**
- `successor_task_id` (required) - Task that depends on predecessor
- `predecessor_task_id` (required) - Task that must complete first
- `dependency_type` (string) - Relationship type
- `lag_days` (integer, default: 0) - Time gap between tasks

**Dependency Types:**
```ruby
DEPENDENCY_TYPES = {
  'fs' => 'finish_to_start',    # Standard: predecessor finishes, successor starts
  'ss' => 'start_to_start',     # Tasks start together
  'ff' => 'finish_to_finish',   # Tasks finish together
  'sf' => 'start_to_finish'     # Rare: predecessor starts, successor finishes
}
```

**Validations:**
- Prevents circular dependencies
- Prevents self-dependencies
- Ensures tasks are in same project
- Unique constraint on (successor_task_id, predecessor_task_id) pair

**Key Methods:**
- `creates_circular_dependency?` - DFS-based cycle detection

**Database:** `/Users/jakebaird/teeem/backend/db/migrate/20251104053320_create_task_dependencies.rb`

---

### 1.5 TaskUpdate Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/task_update.rb`

**Purpose:** Track task status changes and progress updates over time

**Key Attributes:**
- `project_task_id` (required) - Associated task
- `user_id` (required) - User who made update
- `status_before` (string) - Previous status
- `status_after` (string) - New status
- `progress_before` (integer) - Previous progress %
- `progress_after` (integer) - New progress %
- `notes` (text) - Update notes
- `photo_urls` (text array) - Attached photos
- `update_date` (date) - When update occurred

**Relationships:**
```ruby
belongs_to :project_task
belongs_to :user
```

**Key Methods:**
- `status_changed?` - Check if status changed
- `progress_changed?` - Check if progress changed
- `has_photos?` - Check if photos attached
- `summary` - Generate update summary

**Database:** `/Users/jakebaird/teeem/backend/db/migrate/20251104053321_create_task_updates.rb`

---

### 1.6 User Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/user.rb`

**Key Attributes:**
- `email` (string, unique)
- `name` (string)
- `password_digest` - bcrypt hashed password

**Relationships:**
```ruby
has_many :grok_plans, dependent: :destroy
```

**Note:** User model is minimal. Frontend maintains hardcoded team members for assignment UI.

---

## 2. GANTT CHART IMPLEMENTATION

### 2.1 Backend API Endpoints

#### ProjectTasks Gantt Data
**Route:** `GET /api/v1/projects/:id/gantt`  
**File:** `/Users/jakebaird/teeem/backend/app/controllers/api/v1/projects_controller.rb`

**Response:**
```json
{
  "project": {
    "id": 1,
    "name": "Project Name",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "status": "active"
  },
  "tasks": [
    {
      "id": 1,
      "name": "Task Name",
      "task_type": "DO",
      "category": "CONCRETE",
      "status": "not_started",
      "progress": 0,
      "start_date": "2025-01-15",
      "end_date": "2025-01-20",
      "actual_start": null,
      "actual_end": null,
      "duration": 5,
      "is_milestone": false,
      "is_critical_path": false,
      "assigned_to": "Rob Harder",
      "supplier": "Supplier Name",
      "predecessors": [5, 6],
      "successors": [10, 11],
      "purchase_order": {
        "id": 42,
        "number": "PO-001",
        "total": 5000.00
      }
    }
  ],
  "dependencies": [
    {
      "id": 1,
      "source": 5,
      "target": 1,
      "type": "finish_to_start",
      "lag": 0
    }
  ]
}
```

**Controller:** `ProjectTasksController#index`
- Includes task_template, purchase_order, assigned_to
- Ordered by planned_start_date, sequence_order
- Returns materials_status for each task

---

#### ScheduleTasks Gantt Data
**Route:** `GET /api/v1/constructions/:construction_id/schedule_tasks/gantt_data`  
**File:** `/Users/jakebaird/teeem/backend/app/controllers/api/v1/schedule_tasks_controller.rb`

**Response:**
```json
{
  "success": true,
  "gantt_tasks": [
    {
      "id": 1,
      "title": "Pour Concrete",
      "start_date": "2025-01-15",
      "end_date": "2025-01-20",
      "duration_days": 5,
      "status": "in_progress",
      "supplier_category": "CONCRETE",
      "supplier_name": "ABC Concrete",
      "purchase_order_id": 42,
      "purchase_order_number": "PO-001",
      "predecessors": [5, 6],
      "progress": 50
    }
  ],
  "count": 15
}
```

---

### 2.2 Frontend Components

#### GanttChart Component
**Location:** `/Users/jakebaird/teeem/frontend/src/components/gantt/GanttChart.jsx`

**Props:**
```javascript
{
  tasks: Array,           // Task data array
  projectInfo: Object,    // Project metadata
  colorBy: String,        // 'status', 'category', or 'type'
  colorConfig: Object     // Color scheme customization
}
```

**Features:**
- **Zoom Levels:** Days, weeks, months
- **Date Navigation:** Previous/Next period, "Today" button
- **Dynamic Pixels Per Day:**
  - Days: 40px/day
  - Weeks: 6px/day
  - Months: 2px/day
- **Components Used:**
  - `GanttHeader` - Date headers
  - `GanttGrid` - Background grid
  - `TaskRow` - Individual task bars

**State Management:**
- `zoomLevel` - Current zoom
- `showWeekends` - Weekend visibility toggle
- `currentDate` - Navigation date

---

#### TaskTable Component
**Location:** `/Users/jakebaird/teeem/frontend/src/components/gantt/TaskTable.jsx`

**Features:**
- **Inline Editing:** Click any field to edit
- **Sortable Columns:** Click headers to sort (asc/desc/unsorted)
- **Dropdowns:** Team member and supplier assignment
- **Progress Bars:** Visual representation with percentage
- **Color Coding:** By status, category, or type
- **Special Badges:** Milestone (M) and Critical Path indicators

**Columns:**
1. Task Name
2. Status
3. Category
4. Start Date
5. End Date
6. Duration
7. Progress (bar + percentage)
8. Assigned To (dropdown)
9. Supplier (dropdown)
10. Type

**Supported Edits:**
- Text fields: name, notes
- Date fields: planned_start_date, planned_end_date
- Number fields: duration_days, progress_percentage
- Dropdowns: assigned_to, supplier_name

---

#### ScheduleGanttChart Component
**Location:** `/Users/jakebaird/teeem/frontend/src/components/schedule-master/ScheduleGanttChart.jsx`

**Purpose:** Displays supplier delivery schedule Gantt view  
**Props:** `ganttData` (from backend)

---

#### ScheduleMasterTab Component
**Location:** `/Users/jakebaird/teeem/frontend/src/components/schedule-master/ScheduleMasterTab.jsx`

**Features:**
- **Task Import:** Excel file upload for schedule
- **Task Matching:** Link schedule tasks to purchase orders
- **Statistics:** Matched vs unmatched task counts
- **Gantt Display:** Only shows matched tasks in timeline view

**Sub-components:**
- `ScheduleImporter` - File upload
- `ScheduleStats` - Summary cards
- `ScheduleTaskList` - Task listing and matching UI
- `ScheduleGanttChart` - Timeline view
- `TaskMatchModal` - PO selection dialog

---

### 2.3 Color Schemes
**File:** `/Users/jakebaird/teeem/frontend/src/components/gantt/utils/colorSchemes.js`

**Status Colors:**
- Not Started: #C4C4C4 (Gray)
- In Progress: #579BFC (Blue)
- Complete: #00C875 (Green)
- On Hold/Blocked: #E44258 (Red)

**Customizable Color Config:**
```javascript
{
  status: {
    'not_started': { badge: 'bg-gray-100 text-gray-900', bar: '#C4C4C4' },
    'in_progress': { badge: 'bg-blue-100 text-blue-900', bar: '#579BFC' },
    'complete': { badge: 'bg-green-100 text-green-900', bar: '#00C875' },
    // ... more
  },
  category: { /* colors by category */ },
  type: { /* colors by type */ }
}
```

---

## 3. USER ASSIGNMENT

### 3.1 Current Implementation

#### Backend Assignment
**Model:** `ProjectTask` has `assigned_to_id` foreign key to User

**Field:**
```ruby
belongs_to :assigned_to, class_name: 'User', optional: true
```

**API Update:**
```
PATCH /api/v1/projects/:project_id/tasks/:id
{
  "project_task": {
    "assigned_to_id": 5  # User ID
  }
}
```

---

#### Frontend Team Selection
**Location:** `/Users/jakebaird/teeem/frontend/src/components/gantt/TaskTable.jsx`

**Hardcoded Team Members:**
```javascript
const teamMembers = [
  { name: 'Rob Harder', avatar: 'https://images.unsplash.com/...' },
  { name: 'Andrew Clement', avatar: 'https://images.unsplash.com/...' },
  { name: 'Sam Harder', avatar: 'https://images.unsplash.com/...' },
  { name: 'Sophie Harder', avatar: 'https://images.unsplash.com/...' },
  { name: 'Jake Baird', avatar: 'https://images.unsplash.com/...' },
]
```

**Component:** `AssignedUserDropdown`
- Headless UI Listbox
- Avatar display
- Unassigned option
- Calls `onTaskUpdate(taskId, 'assigned_to', memberName)`

---

### 3.2 What's Missing

1. **Dynamic User Fetching** - Users hardcoded in frontend
2. **User API Endpoint** - No endpoint to fetch active team members
3. **User Roles/Permissions** - No role-based assignments
4. **Workload Tracking** - No capacity planning
5. **Team Structure** - No team/department organization
6. **Assignment Notifications** - No notification system

---

## 4. PROJECT/SCHEDULE MANAGEMENT ARCHITECTURE

### 4.1 Hierarchy
```
Organization
  └─ Construction (Job)
      ├─ Project (Master Schedule)
      │   └─ ProjectTasks (with dependencies, users, POs)
      ├─ ScheduleTasks (supplier deliveries)
      └─ PurchaseOrders
```

---

### 4.2 Construction Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/construction.rb`

**Key Attributes:**
- `title` (string, required)
- `status` (string)
- `contract_value` (decimal)
- `site_supervisor_name` (string)
- `site_supervisor_email` (string)
- `site_supervisor_phone` (string)
- `profit_percentage` (decimal)
- `live_profit` (decimal)

**Relationships:**
```ruby
has_many :purchase_orders, dependent: :destroy
has_many :schedule_tasks, dependent: :destroy
has_many :estimates, dependent: :nullify
has_one :project, dependent: :destroy
has_one :one_drive_credential, dependent: :destroy
belongs_to :design, optional: true
```

**Key Methods:**
- `create_project!(project_manager:, name: nil)` - Create Master Schedule
- `schedule_ready?` - Check if has POs for schedule
- `calculate_live_profit` - Contract value minus all POs
- `create_folders_if_needed!` - Trigger OneDrive folder creation

---

### 4.3 Project Model
**Location:** `/Users/jakebaird/teeem/backend/app/models/project.rb`

**Key Attributes:**
- `name` (string)
- `project_code` (string, unique)
- `status` (string, one of: planning, active, complete, on_hold)
- `start_date` (date)
- `planned_end_date` (date)
- `actual_end_date` (date)
- `project_manager_id` (references User)

**Relationships:**
```ruby
belongs_to :project_manager, class_name: 'User'
belongs_to :construction
has_many :project_tasks, dependent: :destroy
has_many :purchase_orders, through: :construction
```

**Key Methods:**
- `progress_percentage` - Average of all task progress (cached 5 min)
- `days_remaining` - Days until planned_end_date
- `on_schedule?` - Critical path vs. planned end
- `critical_path_tasks` - Tasks on critical path
- `overdue_tasks` - Past end date, not complete
- `upcoming_tasks` - Due within 1 week, not started

---

### 4.4 Schedule Generation Service
**Location:** `/Users/jakebaird/teeem/backend/app/services/schedule/generator_service.rb`

**Purpose:** Generate complete Master Schedule from templates and purchase orders

**Workflow:**
1. **Create Tasks from Templates** - Instantiate all NDIS task templates
2. **Map Purchase Orders** - Link POs to matching tasks by category
3. **Establish Dependencies** - Create task relationships from template hierarchy
4. **Calculate Timeline** - Forward pass algorithm for dates
5. **Identify Critical Path** - Find longest path through network
6. **Update Project Status** - Mark as active with generation timestamp

**Category Mapping:**
```ruby
{
  'CONCRETE' => { categories: ['CONCRETE'], types: ['DO', 'ORDER'] },
  'CARPENTER' => { categories: ['CARPENTER'], types: ['DO', 'ORDER'] },
  # ... 20+ trades mapped
}
```

**Timeline Calculation:**
- Topological sort for execution order
- Forward pass for earliest start/finish
- Supports all 4 dependency types
- Lag days for task overlap

**Critical Path:**
- Uses longest path algorithm
- Currently simplified (needs backward pass for accuracy)

---

## 5. EXISTING FEATURES

### 5.1 What's Working

#### Task Creation & Management
- [x] Create tasks from templates
- [x] Manual task creation
- [x] Duplicate/clone tasks
- [x] Delete tasks
- [x] Task status tracking (4 states)
- [x] Progress percentage (0-100)
- [x] Duration planning in days

#### Scheduling & Planning
- [x] Planned start/end dates
- [x] Actual start/end dates (auto-set on status change)
- [x] Task dependencies (4 types)
- [x] Circular dependency prevention
- [x] Dependency lag/overlap support
- [x] Critical path identification
- [x] Milestone marking

#### User Assignment
- [x] Assign users to tasks
- [x] Unassigned state
- [x] User display with name

#### Purchase Order Linking
- [x] Link PO to task
- [x] Materials status tracking (no_po/on_time/delayed)
- [x] Delivery timing validation
- [x] On-site date requirements

#### Gantt Visualization
- [x] Grid-based visual timeline
- [x] Zoom levels (day/week/month)
- [x] Date navigation
- [x] Color by status/category/type
- [x] Custom color schemes
- [x] Task bar for each activity
- [x] Legend display

#### Table View
- [x] Spreadsheet-like interface
- [x] Inline editing (click-to-edit)
- [x] Sortable columns
- [x] User dropdown selection
- [x] Date picker inputs
- [x] Progress bars with percentage
- [x] Special badges (milestone, critical)

#### Schedule Import
- [x] Excel file upload
- [x] Automatic schedule task creation
- [x] Match to purchase orders
- [x] Supplier tracking
- [x] Task linking (predecessors)

#### Status Tracking
- [x] Task updates with history
- [x] Status change logging
- [x] Progress tracking
- [x] Photo attachments
- [x] Notes/comments

---

### 5.2 What Needs Development

#### User Management
- [ ] Dynamic user list from database (currently hardcoded)
- [ ] User roles and permissions
- [ ] Team management
- [ ] User workload/capacity planning
- [ ] User availability calendar

#### Advanced Scheduling
- [ ] Backward pass for accurate float calculation
- [ ] True critical path with float values
- [ ] Resource-leveling
- [ ] Constraint handling (external, mandatory milestones)
- [ ] Multi-project scheduling
- [ ] Schedule optimization

#### Collaboration
- [ ] Task comments/discussions
- [ ] @mentions and notifications
- [ ] Change tracking (who changed what, when)
- [ ] Real-time updates (WebSockets)
- [ ] Document attachments per task

#### Analytics & Reporting
- [ ] Schedule variance (planned vs actual)
- [ ] Performance metrics
- [ ] Burn-down charts
- [ ] Resource utilization reports
- [ ] Cost-to-schedule tracking

#### Mobile Support
- [ ] Mobile Gantt view
- [ ] Task updates from site
- [ ] Photo uploads from mobile
- [ ] Offline capability

#### Advanced Features
- [ ] Template task dependencies (for reuse)
- [ ] Recurring tasks
- [ ] Task allocation to multiple users
- [ ] Sub-task hierarchies
- [ ] Effort/cost estimation
- [ ] Risk register integration

---

## 6. KEY FILE LOCATIONS REFERENCE

### Backend Models
| File | Purpose |
|------|---------|
| `/Users/jakebaird/teeem/backend/app/models/project_task.rb` | Main task model |
| `/Users/jakebaird/teeem/backend/app/models/schedule_task.rb` | Supplier schedule model |
| `/Users/jakebaird/teeem/backend/app/models/task_template.rb` | Template base |
| `/Users/jakebaird/teeem/backend/app/models/task_dependency.rb` | Task relationships |
| `/Users/jakebaird/teeem/backend/app/models/task_update.rb` | Change history |
| `/Users/jakebaird/teeem/backend/app/models/project.rb` | Master schedule container |
| `/Users/jakebaird/teeem/backend/app/models/construction.rb` | Job/project container |
| `/Users/jakebaird/teeem/backend/app/models/user.rb` | User accounts |

### Backend Controllers
| File | Purpose |
|------|---------|
| `/Users/jakebaird/teeem/backend/app/controllers/api/v1/project_tasks_controller.rb` | Task CRUD API |
| `/Users/jakebaird/teeem/backend/app/controllers/api/v1/schedule_tasks_controller.rb` | Schedule task API |
| `/Users/jakebaird/teeem/backend/app/controllers/api/v1/projects_controller.rb` | Project & Gantt API |

### Backend Services
| File | Purpose |
|------|---------|
| `/Users/jakebaird/teeem/backend/app/services/schedule/generator_service.rb` | Schedule generation |
| `/Users/jakebaird/teeem/backend/app/services/spreadsheet_parser.rb` | Excel import |

### Frontend Components
| File | Purpose |
|------|---------|
| `/Users/jakebaird/teeem/frontend/src/components/gantt/GanttChart.jsx` | Main Gantt visualization |
| `/Users/jakebaird/teeem/frontend/src/components/gantt/TaskTable.jsx` | Task table with inline edit |
| `/Users/jakebaird/teeem/frontend/src/components/gantt/TaskRow.jsx` | Individual task bar |
| `/Users/jakebaird/teeem/frontend/src/components/gantt/GanttHeader.jsx` | Date header |
| `/Users/jakebaird/teeem/frontend/src/components/gantt/GanttGrid.jsx` | Background grid |
| `/Users/jakebaird/teeem/frontend/src/components/schedule-master/ScheduleMasterTab.jsx` | Schedule UI container |
| `/Users/jakebaird/teeem/frontend/src/components/schedule-master/ScheduleGanttChart.jsx` | Supplier Gantt |
| `/Users/jakebaird/teeem/frontend/src/components/schedule-master/ScheduleImporter.jsx` | Excel upload |
| `/Users/jakebaird/teeem/frontend/src/components/schedule-master/TaskMatchModal.jsx` | PO matching dialog |
| `/Users/jakebaird/teeem/frontend/src/pages/MasterSchedulePage.jsx` | Master schedule page |
| `/Users/jakebaird/teeem/frontend/src/pages/JobDetailPage.jsx` | Job detail tabs |

### Frontend Pages
| File | Purpose |
|------|---------|
| `/Users/jakebaird/teeem/frontend/src/pages/MasterSchedulePage.jsx` | Full schedule view |
| `/Users/jakebaird/teeem/frontend/src/pages/JobDetailPage.jsx` | Job with "Schedule Master" tab |

### Database Migrations
| File | Tables |
|------|--------|
| `20251104053317_create_task_templates.rb` | task_templates |
| `20251104053318_create_project_tasks.rb` | project_tasks |
| `20251104053320_create_task_dependencies.rb` | task_dependencies |
| `20251104053321_create_task_updates.rb` | task_updates |
| `20251105051002_create_schedule_tasks.rb` | schedule_tasks |

### Routes
**Main Routes:** `/Users/jakebaird/teeem/backend/config/routes.rb`

**Task Endpoints:**
```
GET     /api/v1/projects/:project_id/tasks               (index)
POST    /api/v1/projects/:project_id/tasks               (create)
GET     /api/v1/projects/:project_id/tasks/:id           (show)
PATCH   /api/v1/projects/:project_id/tasks/:id           (update)
DELETE  /api/v1/projects/:project_id/tasks/:id           (destroy)
GET     /api/v1/projects/:id/gantt                       (gantt data)

GET     /api/v1/constructions/:construction_id/schedule_tasks
POST    /api/v1/constructions/:construction_id/schedule_tasks/import
GET     /api/v1/constructions/:construction_id/schedule_tasks/gantt_data
PATCH   /api/v1/schedule_tasks/:id/match_po
DELETE  /api/v1/schedule_tasks/:id/unmatch_po
```

---

## 7. DATA RELATIONSHIPS DIAGRAM

```
User
  ├── created projects (project_manager_id)
  └── created task_updates

Construction (Job)
  ├── has one Project (Master Schedule)
  │   ├── has many ProjectTasks
  │   │   ├── assigned_to → User
  │   │   ├── task_template → TaskTemplate
  │   │   ├── purchase_order → PurchaseOrder
  │   │   ├── has many successor_dependencies (as predecessor)
  │   │   ├── has many predecessor_dependencies (as successor)
  │   │   ├── has many successor_tasks
  │   │   ├── has many predecessor_tasks
  │   │   └── has many task_updates
  │   └── has many purchase_orders (through construction)
  │
  ├── has many ScheduleTasks
  │   └── purchase_order → PurchaseOrder
  │
  └── has many PurchaseOrders
      └── required_on_site_date (delivery date)

TaskTemplate
  ├── has many ProjectTasks
  └── predecessor_template_codes (references other templates)

TaskDependency
  ├── successor_task → ProjectTask
  └── predecessor_task → ProjectTask
```

---

## 8. API CONTRACT SUMMARY

### ProjectTask Update
```
PATCH /api/v1/projects/:project_id/tasks/:id
{
  "project_task": {
    "name": "string",
    "status": "not_started|in_progress|complete|on_hold",
    "planned_start_date": "2025-01-15",
    "planned_end_date": "2025-01-20",
    "duration_days": 5,
    "progress_percentage": 50,
    "assigned_to_id": 3,
    "supplier_name": "string",
    "is_milestone": false,
    "is_critical_path": false,
    "notes": "string"
  }
}
```

### ScheduleTask Import
```
POST /api/v1/constructions/:construction_id/schedule_tasks/import
Content-Type: multipart/form-data
{
  "file": <Excel file>
}
```

**Expected Excel Columns:**
- Title, Status, Start, Complete, Duration
- Supplier Category, Supplier, Paid Internal
- Approx Date, Confirm, Supplier Confirm
- Task Started, Completed, Predecessors, Attachments

---

## 9. KEY STATISTICS

### Database Tables
- **Total Task-Related Tables:** 5 (ProjectTask, ScheduleTask, TaskTemplate, TaskDependency, TaskUpdate)
- **Total Relationships:** 12+
- **Supported Dependency Types:** 4
- **Task Statuses:** 4
- **Task Types:** 7+
- **Trade Categories:** 20+

### Frontend Components
- **Gantt-Related:** 8 components
- **Schedule Management:** 5 components
- **UI Pages:** 2 main pages for scheduling

### Code Statistics
- **Backend Models:** ~500 lines
- **Backend Controllers:** ~300 lines
- **Backend Services:** ~350 lines
- **Frontend Components:** ~2000+ lines
- **Migrations:** 5 task-related migrations

---

## 10. RECOMMENDATIONS & NEXT STEPS

### Immediate (High Priority)
1. **Fetch Users Dynamically** - Create `/api/v1/users` endpoint to populate team dropdown
2. **User Profiles** - Add avatar URLs to User model
3. **Task CRUD Forms** - Create modal for adding/editing tasks instead of inline edit

### Short-term (Medium Priority)
1. **Backward Pass Algorithm** - Implement for accurate critical path calculation
2. **Float Calculation** - Calculate slack time per task
3. **Export Functionality** - Export Gantt chart as PDF/PNG
4. **Notifications** - Task assignment notifications to users
5. **Comments/Notes** - Per-task discussion threads

### Medium-term (Nice to Have)
1. **Resource Leveling** - Optimize schedule for resource constraints
2. **Cost Integration** - Track task costs and budget
3. **Mobile App** - Responsive Gantt view
4. **Real-time Sync** - WebSocket updates for multi-user editing
5. **Advanced Analytics** - Schedule variance reports

### Long-term (Strategic)
1. **Multi-project Management** - Portfolio-level scheduling
2. **Risk Management** - Risk register integration
3. **AI Assistant** - Schedule optimization recommendations
4. **Third-party Integration** - MS Project, Primavera import
5. **Capacity Planning** - Resource pool management

---

## CONCLUSION

TEEEM has a **solid, well-architected task management foundation** with:
- ✅ Comprehensive data models with proper relationships
- ✅ Working Gantt chart visualization with multiple zoom levels
- ✅ Task dependency tracking with circular dependency prevention
- ✅ Critical path identification
- ✅ Purchase order integration
- ✅ Excel schedule import capability
- ✅ Flexible inline editing UI

The system is **production-ready for basic to intermediate project scheduling** but needs enhancement for advanced resource management and multi-project portfolio planning. The separation between ProjectTasks (detailed planning) and ScheduleTasks (supplier tracking) is well-designed and allows for flexible use cases.



# Chapter 10: Gantt & Schedule Master

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚡ Gantt Shaking During Cascade Operations

**Status:** ⚡ FIXED
**First Reported:** 2025-11-16
**Fixed Date:** 2025-11-16
**Severity:** Medium

#### Summary
Visual flickering caused by excessive Gantt reloads during cascade operations

#### Scenario
Gantt chart displayed visual shaking or slow flickering during cascade operations. Console logs showed 5+ Gantt reloads within 2-3 seconds during a single drag operation.

#### Root Cause
The signature-based reload fix (implemented to show cascade updates visually) was triggering a reload for EVERY cascade batch update. Each cascade wave created multiple signature changes, and there was no throttling mechanism during multi-wave cascade operations.

#### Solution
Three-part fix using cascade depth tracking: 1) Pass cascadeDepthRef to DHtmlxGanttView, 2) Throttle signature-based reloads when cascade depth > 0, 3) Trigger one final reload when cascade depth returns to 0

#### Prevention
Always check cascade depth before allowing signature-based reloads. Batch all cascade updates into one final reload after operations complete.

**Component:** DHtmlxGanttView + ScheduleTemplateEditor



# Chapter 11: Project Tasks & Checklists

**Last Updated:** 2025-11-17

## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 12: Weather & Public Holidays

**Last Updated:** 2025-11-17

## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 13: OneDrive Integration

**Last Updated:** 2025-11-17

## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 14: Outlook/Email Integration

**Last Updated:** 2025-11-17

## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 15: Chat & Communications

**Last Updated:** 2025-11-17

## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 16: Xero Accounting Integration

**Last Updated:** 2025-11-17

## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 17: Payments & Financials

**Last Updated:** 2025-11-17

## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 18: Workflows & Automation

**Last Updated:** 2025-11-17

## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 19: Custom Tables & Formulas

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚡ Table Deletion Bug Investigation - Complete Analysis

**Status:** ⚡ FIXED
**First Reported:** Unknown
**Severity:** High

#### Scenario
Custom table deletion was failing with cascade errors and orphaned records. Investigation uncovered multiple issues in deletion flow.

#### Root Cause
1. Foreign key constraints not properly handled. 2. Records component not clearing deleted table from state. 3. Cascade deletion not following dependency chain. 4. Formula columns referencing deleted tables.

#### Solution
1. Added proper dependency checking before deletion. 2. Implemented cascade deletion for all related records. 3. Updated Records component to remove deleted table. 4. Added validation to prevent deletion of referenced tables. Full investigation in 5 files: TABLE_DELETION_ANALYSIS_*.md


## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 19: UI/UX Standards & Patterns

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚡ Table Deletion Bug Investigation - Complete Analysis

**Status:** ⚡ FIXED
**First Reported:** Unknown
**Severity:** High

#### Scenario
Custom table deletion was failing with cascade errors and orphaned records. Investigation uncovered multiple issues in deletion flow.

#### Root Cause
1. Foreign key constraints not properly handled. 2. Records component not clearing deleted table from state. 3. Cascade deletion not following dependency chain. 4. Formula columns referencing deleted tables.

#### Solution
1. Added proper dependency checking before deletion. 2. Implemented cascade deletion for all related records. 3. Updated Records component to remove deleted table. 4. Added validation to prevent deletion of referenced tables. Full investigation in 5 files: TABLE_DELETION_ANALYSIS_*.md


## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.



# Chapter 20: Trinity Table - Gold Standard

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚡ Search Boxes Missing Clear Buttons (73 components)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** High

#### Summary
**Impact:** 73 search boxes across codebase
**Severity:** HIGH - UX regression
**Rule Violation:** RULE #19.20 (Search Functionality Standards)

**Problem:** Search inputs lack clear button (X icon) to quickly reset search

**Automation:** YES - Script can add clear button to all search boxes (30-40 min)

**Affected Pages:** ContactsPage, PriceBooksPage, SuppliersPage, PurchaseOrdersPage, +40 more


### ⚡ Modals Missing Close Buttons (58 components)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** High

#### Summary
**Impact:** 58 modals across codebase
**Severity:** HIGH - Accessibility issue
**Rule Violation:** RULE #19.22 (Modal Rules)
**Current State:** 78 modals have close button, 58 do not

**Problem:** Modals lack visible close button in top-right corner

**Automation:** YES - Template can be applied to all modals (20-30 min)

**Affected Modals:** NewJobModal, EditJobModal, PurchaseOrderModal, +50 more


### ⚡ Empty States Missing Action Buttons (66 components)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** High

#### Summary
**Impact:** 66 empty states
**Severity:** HIGH - UX conversion issue
**Rule Violation:** RULE #19.27 (Empty State Rules)
**Current State:** 14 with action buttons, 66 without

**Problem:** Empty states show message but no call-to-action button

**Automation:** PARTIAL - Manual work required (1-2 hours total)


### ⚡ Table Headers Not Sticky (36 tables)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** High

#### Summary
**Impact:** 36 tables
**Severity:** HIGH - Scrolling UX
**Rule Violation:** RULE #19.2 (Sticky Headers)
**Current State:** 18 with sticky headers, 36 without

**Problem:** Headers scroll out of view in large tables

**Automation:** YES - Add `sticky top-0 z-10` to thead (15-20 min)


### ⚡ Inline Column Filters Missing (44 tables)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
**Impact:** 44 tables
**Severity:** MEDIUM - Feature completeness
**Rule Violation:** RULE #19.3 (Table Standards)

**Problem:** No filter inputs in column headers for power users

**Automation:** NO - Manual work (3-5 hours)

**Affected Pages:** PriceBooksPage (2 tables), SuppliersPage, JobDetailPage (3 tables), ContactDetailPage (3 tables)


### ⚡ Icon Buttons Missing aria-label (50 components)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
**Impact:** ~50 icon buttons
**Severity:** MEDIUM - Screen reader support
**Rule Violation:** RULE #19.12 (Accessibility)

**Problem:** Icon-only buttons have no label for screen readers

**Automation:** PARTIAL - Requires semantic label for each button (1-2 hours)


### ⚡ Search Results Count Not Displayed (53 components)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
**Impact:** 53 search boxes
**Severity:** MEDIUM - User feedback/clarity
**Rule Violation:** RULE #19.20 (Search Standards)

**Problem:** No count of results shown when user searches

**Automation:** YES - Template addition (30 min)


### ⚡ Scrollbar Overlapping Content and Header

**Status:** ⚡ FIXED
**First Reported:** 2025-11-17
**Fixed Date:** 2025-11-17
**Severity:** Medium

#### Summary
## Bug Summary

The Bible table had two scrollbar-related visual bugs:

1. **Vertical scrollbar overlapping table content** - The native scrollbar was taking up space but appearing broken
2. **Content scrolling under sticky header** - Table rows were scrolling underneath the header instead of below it

#### Scenario
## How to Reproduce

1. Open Documentation page → 📖 Bible
2. Scroll down the table
3. **Bug 1:** Notice right edge of table is cut off by scrollbar gutter
4. **Bug 2:** Notice table rows scroll under the header (header z-index too low)

#### Root Cause
## Root Cause

### Bug 1: Scrollbar Overlap

**Problem:** Conflicting scrollbar CSS rules

```css
/* Lines 579-613: Defined custom webkit scrollbar */
.bible-table-scroll::-webkit-scrollbar {
  width: 16px !important;  /* Reserves 16px space */
}

/* Lines 750-751: Tried to hide scrollbar */
style={{
  scrollbarWidth: 'none',      /* Hides scrollbar */
  msOverflowStyle: 'none'
}}
```

**Result:** Space reserved but scrollbar hidden = broken layout

### Bug 2: Header Overlap

**Problem:** Insufficient z-index on sticky header

```jsx
<thead className="sticky top-0 z-20 ...">
```

**Result:** Content scrolling at z-index 1 (default) doesn't stay below header at z-20 properly

#### Solution
## Solution

### Fix 1: Hide ALL Native Scrollbars

Removed conflicting webkit scrollbar styles and properly hid all scrollbars:

```css
/* Hide ALL native scrollbars (we use custom sticky scrollbar for horizontal) */
.bible-table-scroll::-webkit-scrollbar {
  display: none !important;
}
.bible-table-scroll {
  -ms-overflow-style: none !important;  /* IE and Edge */
  scrollbar-width: none !important;  /* Firefox */
}
```

**Removed:**
- Custom webkit scrollbar width/styling (lines 579-613)
- Inline style conflicting rules

**Why:** Table uses custom sticky horizontal scrollbar at bottom (RULE #19.33). Native scrollbars should be completely hidden.

### Fix 2: Increase Header Z-Index

```jsx
<thead className="sticky top-0 z-30 backdrop-blur-md bg-white/95 dark:bg-gray-900/95 shadow-sm border-b-2 border-gray-200 dark:border-gray-700">
```

**Changes:**
- `z-20` → `z-30` (higher stacking context)
- Added `border-b-2` for clearer separation

**Why:** Ensures header stays visually above scrolling content

#### Prevention
## Prevention

**RULE:** When using custom sticky scrollbars (RULE #19.33):

❌ **NEVER:**
- Style native scrollbars with webkit/moz rules
- Mix `scrollbarWidth: 'none'` with webkit scrollbar width
- Use z-index < 30 for sticky headers

✅ **ALWAYS:**
- Completely hide native scrollbars with `display: none`
- Use z-30+ for sticky headers over scrolling content
- Add clear border separation between header and content

**Related Rules:**
- RULE #19.33: Sticky Horizontal Scrollbar Pattern
- RULE #19.34: Modern Table Header Aesthetics

**Component:** BibleTableView.jsx


### ⚡ Scrollbar Overlapping Content and Header

**Status:** ⚡ FIXED
**First Reported:** 2025-11-17
**Fixed Date:** 2025-11-17
**Severity:** Medium

#### Summary
## Bug Summary

The Bible table had two scrollbar-related visual bugs:

1. **Vertical scrollbar overlapping table content** - The native scrollbar was taking up space but appearing broken
2. **Content scrolling under sticky header** - Table rows were scrolling underneath the header instead of below it

#### Scenario
## How to Reproduce

1. Open Documentation page → 📖 Bible
2. Scroll down the table
3. **Bug 1:** Notice right edge of table is cut off by scrollbar gutter
4. **Bug 2:** Notice table rows scroll under the header (header z-index too low)

#### Root Cause
## Root Cause

### Bug 1: Scrollbar Overlap

**Problem:** Conflicting scrollbar CSS rules

```css
/* Lines 579-613: Defined custom webkit scrollbar */
.bible-table-scroll::-webkit-scrollbar {
  width: 16px !important;  /* Reserves 16px space */
}

/* Lines 750-751: Tried to hide scrollbar */
style={{
  scrollbarWidth: 'none',      /* Hides scrollbar */
  msOverflowStyle: 'none'
}}
```

**Result:** Space reserved but scrollbar hidden = broken layout

### Bug 2: Header Overlap

**Problem:** Insufficient z-index on sticky header

```jsx
<thead className="sticky top-0 z-20 ...">
```

**Result:** Content scrolling at z-index 1 (default) doesn't stay below header at z-20 properly

#### Solution
## Solution

### Fix 1: Hide ALL Native Scrollbars

Removed conflicting webkit scrollbar styles and properly hid all scrollbars:

```css
/* Hide ALL native scrollbars (we use custom sticky scrollbar for horizontal) */
.bible-table-scroll::-webkit-scrollbar {
  display: none !important;
}
.bible-table-scroll {
  -ms-overflow-style: none !important;  /* IE and Edge */
  scrollbar-width: none !important;  /* Firefox */
}
```

**Removed:**
- Custom webkit scrollbar width/styling (lines 579-613)
- Inline style conflicting rules

**Why:** Table uses custom sticky horizontal scrollbar at bottom (RULE #19.33). Native scrollbars should be completely hidden.

### Fix 2: Increase Header Z-Index

```jsx
<thead className="sticky top-0 z-30 backdrop-blur-md bg-white/95 dark:bg-gray-900/95 shadow-sm border-b-2 border-gray-200 dark:border-gray-700">
```

**Changes:**
- `z-20` → `z-30` (higher stacking context)
- Added `border-b-2` for clearer separation

**Why:** Ensures header stays visually above scrolling content

#### Prevention
## Prevention

**RULE:** When using custom sticky scrollbars (RULE #19.33):

❌ **NEVER:**
- Style native scrollbars with webkit/moz rules
- Mix `scrollbarWidth: 'none'` with webkit scrollbar width
- Use z-index < 30 for sticky headers

✅ **ALWAYS:**
- Completely hide native scrollbars with `display: none`
- Use z-30+ for sticky headers over scrolling content
- Add clear border separation between header and content

**Related Rules:**
- RULE #19.33: Sticky Horizontal Scrollbar Pattern
- RULE #19.34: Modern Table Header Aesthetics

**Component:** BibleTableView.jsx


## 🏛️ Architecture

### Design Decisions & Rationale

### 1. HeadlessUI + Heroicons Architecture Decision

**Decision:** **Decision:** Use HeadlessUI for component composition + Heroicons for consistent icons

**Rationale:**
- Composability: HeadlessUI provides unstyled, accessible components styled with TailwindCSS
- Accessibility Built-in: ARIA attributes handled automatically
- Icon Consistency: Heroicons (24-outline style) across all 200+ icon usages
- Package Integration: Both officially maintained by Tailwind Labs

**Evidence:**
- 20+ component files import HeadlessUI (Tab, Dialog, Menu, etc.)
- All icons from `@heroicons/react/24/outline`
- Packages: `@headlessui/react: ^2.2.9`, `@heroicons/react: ^2.2.0`

**Protected Pattern:** HeadlessUI patterns must be preserved in all modals/dropdowns


### 2. TailwindCSS Styling Strategy (No CSS-in-JS)

**Decision:** **Decision:** Pure TailwindCSS with dark mode via `dark:` prefix (no CSS-in-JS)

**Rationale:**
- Performance: No runtime style generation (compiled at build time)
- Type Safety: ClassName strings catch typos at development time
- Dark Mode Built-In: Tailwind's `dark:` prefix requires no additional libraries
- Predictable Output: CSS generated once, not recalculated per component

**Evidence:**
- 5,920+ `dark:` prefixed classes throughout codebase
- Zero CSS-in-JS libraries (no styled-components, emotion)
- Minimal tailwind.config.js (no custom plugins)

**Protected Pattern:** No CSS-in-JS conversions planned


### 3. ContactsPage as Gold Standard Reference

**Decision:** **Decision:** ContactsPage.jsx designated as primary reference implementation

**Rationale - Feature Complete:**
- Sticky headers ✅
- Column resize with drag handles ✅
- Column reorder (drag-drop) ✅
- Inline column filters ✅
- Search with clear button ✅
- Multi-level sort ✅
- localStorage persistence ✅
- Dark mode support ✅
- Row actions ✅
- Empty states with action buttons ✅

**File:** `frontend/src/pages/ContactsPage.jsx` (372 lines)

**Use As Reference For:**
- Column state management patterns
- URL-based tab sync
- Table feature implementation


### 4. Dark Mode Implementation Strategy

**Decision:** **Decision:** CSS-first dark mode using `prefers-color-scheme` media query

**Rationale:**
- No JavaScript Overhead: Applied via CSS, not JS state
- Respects User Preferences: Automatically responds to OS dark mode
- Manual Toggle Possible: Can be enhanced later if needed
- Accessibility Compliant: Respects `prefers-color-scheme` WCAG requirement

**Evidence:**
- Tailwind config uses default dark mode strategy (media query)
- 5,920+ dark mode class usages
- Consistent pattern: `bg-white dark:bg-gray-800`, `text-gray-900 dark:text-white`
- COLOR_SYSTEM.md documents standardized dark colors

**Protected Pattern:** All dark mode classes must be preserved


### 5. HeadlessUI + Heroicons Architecture Decision

**Decision:** **Decision:** Use HeadlessUI for component composition + Heroicons for consistent icons

**Rationale:**
- Composability: HeadlessUI provides unstyled, accessible components styled with TailwindCSS
- Accessibility Built-in: ARIA attributes handled automatically
- Icon Consistency: Heroicons (24-outline style) across all 200+ icon usages
- Package Integration: Both officially maintained by Tailwind Labs

**Evidence:**
- 20+ component files import HeadlessUI (Tab, Dialog, Menu, etc.)
- All icons from `@heroicons/react/24/outline`
- Packages: `@headlessui/react: ^2.2.9`, `@heroicons/react: ^2.2.0`

**Protected Pattern:** HeadlessUI patterns must be preserved in all modals/dropdowns


### 6. TailwindCSS Styling Strategy (No CSS-in-JS)

**Decision:** **Decision:** Pure TailwindCSS with dark mode via `dark:` prefix (no CSS-in-JS)

**Rationale:**
- Performance: No runtime style generation (compiled at build time)
- Type Safety: ClassName strings catch typos at development time
- Dark Mode Built-In: Tailwind's `dark:` prefix requires no additional libraries
- Predictable Output: CSS generated once, not recalculated per component

**Evidence:**
- 5,920+ `dark:` prefixed classes throughout codebase
- Zero CSS-in-JS libraries (no styled-components, emotion)
- Minimal tailwind.config.js (no custom plugins)

**Protected Pattern:** No CSS-in-JS conversions planned


### 7. ContactsPage as Gold Standard Reference

**Decision:** **Decision:** ContactsPage.jsx designated as primary reference implementation

**Rationale - Feature Complete:**
- Sticky headers ✅
- Column resize with drag handles ✅
- Column reorder (drag-drop) ✅
- Inline column filters ✅
- Search with clear button ✅
- Multi-level sort ✅
- localStorage persistence ✅
- Dark mode support ✅
- Row actions ✅
- Empty states with action buttons ✅

**File:** `frontend/src/pages/ContactsPage.jsx` (372 lines)

**Use As Reference For:**
- Column state management patterns
- URL-based tab sync
- Table feature implementation


### 8. Dark Mode Implementation Strategy

**Decision:** **Decision:** CSS-first dark mode using `prefers-color-scheme` media query

**Rationale:**
- No JavaScript Overhead: Applied via CSS, not JS state
- Respects User Preferences: Automatically responds to OS dark mode
- Manual Toggle Possible: Can be enhanced later if needed
- Accessibility Compliant: Respects `prefers-color-scheme` WCAG requirement

**Evidence:**
- Tailwind config uses default dark mode strategy (media query)
- 5,920+ dark mode class usages
- Consistent pattern: `bg-white dark:bg-gray-800`, `text-gray-900 dark:text-white`
- COLOR_SYSTEM.md documents standardized dark colors

**Protected Pattern:** All dark mode classes must be preserved


### 9. Chapter 19 Table Compliance Implementation

**Related Rule:** Bible Bible Chapter 19 (RULES #19.2, #19.3, #19.5B, #19.7, #19.8, #19.9, #19.11A, #19.13, #19.14, #19.16)

**Decision:** Implemented full Chapter 19 table compliance for Claude Code shortcuts management, including column reordering, visual drag indicators, and proper event separation.

**Details:**
**Features Implemented:**

1. **Column Reordering** - HTML5 drag-and-drop API with state management
2. **Visual Drag Indicators** - Bars3Icon (≡) on all draggable columns
3. **Toolbar Layout** - Search left, bulk actions + edit buttons right
4. **Event Separation** - Drag handle does not trigger sorting
5. **Vertical Alignment** - Fixed with minHeight: 44px

**Technical Implementation:**
- Added columnOrderCommands/columnOrderSlang state arrays
- Added draggingColumnCommands/draggingColumnSlang state
- Implemented onDragStart, onDragOver, onDrop, onDragEnd handlers
- Separated drag handle (Bars3Icon) from sortable area
- Added e.stopPropagation() to prevent event conflicts

**Files Modified:**
- frontend/src/components/settings/AgentShortcutsTab.jsx (lines 14, 35-36, 49-50, 633-660, 823-850)

**Trade-offs:**
**Trade-offs:**
- State complexity: Dual table state requires separate variables
- Column persistence: Currently in-memory only (could add localStorage)
- Performance: Drag-drop re-renders entire header (acceptable for small tables)

**Future Enhancements:**
- Add localStorage persistence for column order
- Add keyboard shortcuts for column reordering
- Add column order reset button


## 📊 Test Catalog

### UI Testing Infrastructure State

**Current State:**

✅ **E2E Tests:**
- Framework: Playwright v1.56.1
- Tests: 1 Gantt cascade test with bug-hunter diagnostics
- Location: `frontend/tests/e2e/gantt-cascade.spec.js`
- Features: API monitoring, state tracking, console log monitoring, screenshots

✅ **Unit Test Setup:**
- Framework: Vitest v4.0.8
- Configuration: Exists but no tests written

**Missing Tests:**
❌ Visual regression tests (Percy, BackstopJS)
❌ Accessibility tests (axe-core, jest-axe)
❌ UI component unit tests (Vitest unused)
❌ Browser compatibility (only Chromium)
❌ Responsive/mobile tests
❌ Dark mode screenshot tests
❌ Performance tests (Lighthouse)

**High Value Quick Wins:**
1. Dark mode rendering (screenshot tests)
2. Accessibility scan (axe-core automated)
3. Responsive layouts (viewport testing)
4. Color contrast (automated a11y check)
5. Search clear button functionality
6. Modal close button functionality


## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.


### UI/UX Enhancement Roadmap

**Priority Matrix:**

**Quick Wins (1-2 hours total):**
- ✅ Fix deprecated color classes: amber→yellow, emerald→green (COMPLETED 2025-11-16)
- [ ] Add clear buttons to 73 search boxes (30-40 min, automatable)
- [ ] Add close buttons to 58 modals (20-30 min, automatable)
- [ ] Add sticky headers to 36 tables (15-20 min, automatable)

**High Impact (3-5 hours):**
- [ ] Add action buttons to 66 empty states (1-2 hours, manual)
- [ ] Add inline filters to 44 tables (3-5 hours, manual)
- [ ] Add aria-labels to 50 icon buttons (1-2 hours, manual)
- [ ] Add search result counts to 53 search boxes (30 min, automatable)

**Medium Impact (5-10 hours):**
- [ ] Badge icon enhancement (95 badges, 2-3 hours)
- [ ] URL state sync for 20 tab components (2 hours)
- [ ] Loading spinners for 12 pages (1 hour)
- [ ] Button hierarchy audit (100 buttons, 3 hours)

**Future Enhancements:**
- [ ] Storybook integration (component showcase)
- [ ] Accessibility scanning (axe-core in CI/CD)
- [ ] Performance optimization (memoization audit)
- [ ] Responsive design system documentation
- [ ] Design tokens export (Figma integration)


### Test Entry - Dummy Run

This is a test entry to verify the unified API works correctly


### Trinity Table Visual Updates - Blue Theme and Borders

Complete visual refresh of Trinity table component with blue theme throughout

CHANGES MADE:
1. Scrollbars: Changed from gray to blue (#2563EB) matching header
   - WebKit: Custom ::-webkit-scrollbar styling with 12px size
   - Firefox: scrollbarColor property for cross-browser support
   - Dark mode: Uses blue-800 (#1E40AF) for thumb
   
2. Table Borders: Changed from border-l border-r to full border
   - Now has top, right, bottom, left borders
   - Creates complete bordered box around table
   - Maintains mx-4 margin for search bar alignment
   
3. Alternating Rows: Kept light blue (bg-blue-50)
   - Even rows: white
   - Odd rows: bg-blue-50 (light blue)
   - Hover: bg-blue-100
   - Initially tried bg-blue-600 matching header but too dark
   
4. Removed Sticky Scrollbar: 
   - Previously had custom sticky horizontal scrollbar at bottom
   - Caused duplicate scrollbar display issue
   - Now uses only native browser scrollbars
   
SPECIFICATION UPDATES:
- RULE #20.19: Native scrollbars with blue theme
- RULE #20.18: Full border on all sides
- Updated section 10 with complete CSS examples
- Documented removal of sticky scrollbar and reasoning


### Trinity Table Complete - Modal and All Features

Complete gold standard implementation. Modal opens ONLY on Content/Title columns. Dedicated resize handles prevent conflicts. Bold 18px headers, 14px rows. All interactions work independently: resize, drag, sort, filter, select, modal.


## 🔍 Common Issues

### Sticky Horizontal Scrollbar Implementation Bugs

Common issues encountered when implementing sticky horizontal scrollbars for wide tables

#### Scenario
When implementing a sticky horizontal scrollbar at the bottom of a table view (BibleTableView), multiple issues were encountered with scroll synchronization, visibility, and positioning.

#### Root Cause
1. **Scroll loop prevention**: Bidirectional scroll sync causes infinite loops without proper flags
2. **Table width detection**: Container scrollWidth !== actual table width when table has minWidth
3. **Native scrollbar conflict**: Both native and custom scrollbars visible simultaneously
4. **Overflow detection**: Default column widths too small to trigger horizontal scroll on wide monitors

#### Solution
**Scroll Loop Prevention:**
```javascript
const isScrollingStickyRef = useRef(false)
const isScrollingMainRef = useRef(false)

const handleScroll = (e) => {
  if (isScrollingStickyRef.current) {
    isScrollingStickyRef.current = false
    return
  }
  isScrollingMainRef.current = true
  // Sync sticky scrollbar
  if (stickyScrollbarRef.current) {
    stickyScrollbarRef.current.scrollLeft = e.target.scrollLeft
  }
  setTimeout(() => { isScrollingMainRef.current = false }, 0)
}
```

**Actual Table Width Detection:**
```javascript
const table = container.querySelector('table')
const actualTableWidth = table ? table.offsetWidth : scrollWidth
setTableScrollWidth(actualTableWidth)
```

**Hide Native Scrollbar:**
```css
.bible-table-scroll::-webkit-scrollbar:horizontal {
  display: none !important;
  height: 0 !important;
}
```
```javascript
style={{
  scrollbarWidth: 'none',
  msOverflowStyle: 'none'
}}
```

**Force Horizontal Overflow:**
```javascript
const COLUMNS = [
  { key: 'content', width: 1200 }, // Increased from 600
  // Total: 2400px > most screens
]
```

#### Prevention
1. **Always use ref flags** to prevent scroll loops in bidirectional sync
2. **Measure actual table element** not container for accurate width
3. **Hide native scrollbars** when implementing custom ones (CSS + inline styles)
4. **Test on wide monitors** - ensure default column widths force overflow
5. **Use ResizeObserver** to update scrollbar on column resize
6. **Position sticky with bottom: 0** to keep scrollbar visible at viewport bottom



# Chapter 20: UI/UX Standards & Patterns

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚡ Search Boxes Missing Clear Buttons (73 components)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** High

#### Summary
**Impact:** 73 search boxes across codebase
**Severity:** HIGH - UX regression
**Rule Violation:** RULE #19.20 (Search Functionality Standards)

**Problem:** Search inputs lack clear button (X icon) to quickly reset search

**Automation:** YES - Script can add clear button to all search boxes (30-40 min)

**Affected Pages:** ContactsPage, PriceBooksPage, SuppliersPage, PurchaseOrdersPage, +40 more


### ⚡ Modals Missing Close Buttons (58 components)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** High

#### Summary
**Impact:** 58 modals across codebase
**Severity:** HIGH - Accessibility issue
**Rule Violation:** RULE #19.22 (Modal Rules)
**Current State:** 78 modals have close button, 58 do not

**Problem:** Modals lack visible close button in top-right corner

**Automation:** YES - Template can be applied to all modals (20-30 min)

**Affected Modals:** NewJobModal, EditJobModal, PurchaseOrderModal, +50 more


### ⚡ Empty States Missing Action Buttons (66 components)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** High

#### Summary
**Impact:** 66 empty states
**Severity:** HIGH - UX conversion issue
**Rule Violation:** RULE #19.27 (Empty State Rules)
**Current State:** 14 with action buttons, 66 without

**Problem:** Empty states show message but no call-to-action button

**Automation:** PARTIAL - Manual work required (1-2 hours total)


### ⚡ Table Headers Not Sticky (36 tables)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** High

#### Summary
**Impact:** 36 tables
**Severity:** HIGH - Scrolling UX
**Rule Violation:** RULE #19.2 (Sticky Headers)
**Current State:** 18 with sticky headers, 36 without

**Problem:** Headers scroll out of view in large tables

**Automation:** YES - Add `sticky top-0 z-10` to thead (15-20 min)


### ⚡ Inline Column Filters Missing (44 tables)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
**Impact:** 44 tables
**Severity:** MEDIUM - Feature completeness
**Rule Violation:** RULE #19.3 (Table Standards)

**Problem:** No filter inputs in column headers for power users

**Automation:** NO - Manual work (3-5 hours)

**Affected Pages:** PriceBooksPage (2 tables), SuppliersPage, JobDetailPage (3 tables), ContactDetailPage (3 tables)


### ⚡ Icon Buttons Missing aria-label (50 components)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
**Impact:** ~50 icon buttons
**Severity:** MEDIUM - Screen reader support
**Rule Violation:** RULE #19.12 (Accessibility)

**Problem:** Icon-only buttons have no label for screen readers

**Automation:** PARTIAL - Requires semantic label for each button (1-2 hours)


### ⚡ Search Results Count Not Displayed (53 components)

**Status:** ⚡ OPEN
**First Reported:** Unknown
**Severity:** Medium

#### Summary
**Impact:** 53 search boxes
**Severity:** MEDIUM - User feedback/clarity
**Rule Violation:** RULE #19.20 (Search Standards)

**Problem:** No count of results shown when user searches

**Automation:** YES - Template addition (30 min)


### ⚡ Scrollbar Overlapping Content and Header

**Status:** ⚡ FIXED
**First Reported:** 2025-11-17
**Fixed Date:** 2025-11-17
**Severity:** Medium

#### Summary
## Bug Summary

The Bible table had two scrollbar-related visual bugs:

1. **Vertical scrollbar overlapping table content** - The native scrollbar was taking up space but appearing broken
2. **Content scrolling under sticky header** - Table rows were scrolling underneath the header instead of below it

#### Scenario
## How to Reproduce

1. Open Documentation page → 📖 Bible
2. Scroll down the table
3. **Bug 1:** Notice right edge of table is cut off by scrollbar gutter
4. **Bug 2:** Notice table rows scroll under the header (header z-index too low)

#### Root Cause
## Root Cause

### Bug 1: Scrollbar Overlap

**Problem:** Conflicting scrollbar CSS rules

```css
/* Lines 579-613: Defined custom webkit scrollbar */
.bible-table-scroll::-webkit-scrollbar {
  width: 16px !important;  /* Reserves 16px space */
}

/* Lines 750-751: Tried to hide scrollbar */
style={{
  scrollbarWidth: 'none',      /* Hides scrollbar */
  msOverflowStyle: 'none'
}}
```

**Result:** Space reserved but scrollbar hidden = broken layout

### Bug 2: Header Overlap

**Problem:** Insufficient z-index on sticky header

```jsx
<thead className="sticky top-0 z-20 ...">
```

**Result:** Content scrolling at z-index 1 (default) doesn't stay below header at z-20 properly

#### Solution
## Solution

### Fix 1: Hide ALL Native Scrollbars

Removed conflicting webkit scrollbar styles and properly hid all scrollbars:

```css
/* Hide ALL native scrollbars (we use custom sticky scrollbar for horizontal) */
.bible-table-scroll::-webkit-scrollbar {
  display: none !important;
}
.bible-table-scroll {
  -ms-overflow-style: none !important;  /* IE and Edge */
  scrollbar-width: none !important;  /* Firefox */
}
```

**Removed:**
- Custom webkit scrollbar width/styling (lines 579-613)
- Inline style conflicting rules

**Why:** Table uses custom sticky horizontal scrollbar at bottom (RULE #19.33). Native scrollbars should be completely hidden.

### Fix 2: Increase Header Z-Index

```jsx
<thead className="sticky top-0 z-30 backdrop-blur-md bg-white/95 dark:bg-gray-900/95 shadow-sm border-b-2 border-gray-200 dark:border-gray-700">
```

**Changes:**
- `z-20` → `z-30` (higher stacking context)
- Added `border-b-2` for clearer separation

**Why:** Ensures header stays visually above scrolling content

#### Prevention
## Prevention

**RULE:** When using custom sticky scrollbars (RULE #19.33):

❌ **NEVER:**
- Style native scrollbars with webkit/moz rules
- Mix `scrollbarWidth: 'none'` with webkit scrollbar width
- Use z-index < 30 for sticky headers

✅ **ALWAYS:**
- Completely hide native scrollbars with `display: none`
- Use z-30+ for sticky headers over scrolling content
- Add clear border separation between header and content

**Related Rules:**
- RULE #19.33: Sticky Horizontal Scrollbar Pattern
- RULE #19.34: Modern Table Header Aesthetics

**Component:** BibleTableView.jsx


### ⚡ Scrollbar Overlapping Content and Header

**Status:** ⚡ FIXED
**First Reported:** 2025-11-17
**Fixed Date:** 2025-11-17
**Severity:** Medium

#### Summary
## Bug Summary

The Bible table had two scrollbar-related visual bugs:

1. **Vertical scrollbar overlapping table content** - The native scrollbar was taking up space but appearing broken
2. **Content scrolling under sticky header** - Table rows were scrolling underneath the header instead of below it

#### Scenario
## How to Reproduce

1. Open Documentation page → 📖 Bible
2. Scroll down the table
3. **Bug 1:** Notice right edge of table is cut off by scrollbar gutter
4. **Bug 2:** Notice table rows scroll under the header (header z-index too low)

#### Root Cause
## Root Cause

### Bug 1: Scrollbar Overlap

**Problem:** Conflicting scrollbar CSS rules

```css
/* Lines 579-613: Defined custom webkit scrollbar */
.bible-table-scroll::-webkit-scrollbar {
  width: 16px !important;  /* Reserves 16px space */
}

/* Lines 750-751: Tried to hide scrollbar */
style={{
  scrollbarWidth: 'none',      /* Hides scrollbar */
  msOverflowStyle: 'none'
}}
```

**Result:** Space reserved but scrollbar hidden = broken layout

### Bug 2: Header Overlap

**Problem:** Insufficient z-index on sticky header

```jsx
<thead className="sticky top-0 z-20 ...">
```

**Result:** Content scrolling at z-index 1 (default) doesn't stay below header at z-20 properly

#### Solution
## Solution

### Fix 1: Hide ALL Native Scrollbars

Removed conflicting webkit scrollbar styles and properly hid all scrollbars:

```css
/* Hide ALL native scrollbars (we use custom sticky scrollbar for horizontal) */
.bible-table-scroll::-webkit-scrollbar {
  display: none !important;
}
.bible-table-scroll {
  -ms-overflow-style: none !important;  /* IE and Edge */
  scrollbar-width: none !important;  /* Firefox */
}
```

**Removed:**
- Custom webkit scrollbar width/styling (lines 579-613)
- Inline style conflicting rules

**Why:** Table uses custom sticky horizontal scrollbar at bottom (RULE #19.33). Native scrollbars should be completely hidden.

### Fix 2: Increase Header Z-Index

```jsx
<thead className="sticky top-0 z-30 backdrop-blur-md bg-white/95 dark:bg-gray-900/95 shadow-sm border-b-2 border-gray-200 dark:border-gray-700">
```

**Changes:**
- `z-20` → `z-30` (higher stacking context)
- Added `border-b-2` for clearer separation

**Why:** Ensures header stays visually above scrolling content

#### Prevention
## Prevention

**RULE:** When using custom sticky scrollbars (RULE #19.33):

❌ **NEVER:**
- Style native scrollbars with webkit/moz rules
- Mix `scrollbarWidth: 'none'` with webkit scrollbar width
- Use z-index < 30 for sticky headers

✅ **ALWAYS:**
- Completely hide native scrollbars with `display: none`
- Use z-30+ for sticky headers over scrolling content
- Add clear border separation between header and content

**Related Rules:**
- RULE #19.33: Sticky Horizontal Scrollbar Pattern
- RULE #19.34: Modern Table Header Aesthetics

**Component:** BibleTableView.jsx


## 🏛️ Architecture

### Design Decisions & Rationale

### 1. HeadlessUI + Heroicons Architecture Decision

**Decision:** **Decision:** Use HeadlessUI for component composition + Heroicons for consistent icons

**Rationale:**
- Composability: HeadlessUI provides unstyled, accessible components styled with TailwindCSS
- Accessibility Built-in: ARIA attributes handled automatically
- Icon Consistency: Heroicons (24-outline style) across all 200+ icon usages
- Package Integration: Both officially maintained by Tailwind Labs

**Evidence:**
- 20+ component files import HeadlessUI (Tab, Dialog, Menu, etc.)
- All icons from `@heroicons/react/24/outline`
- Packages: `@headlessui/react: ^2.2.9`, `@heroicons/react: ^2.2.0`

**Protected Pattern:** HeadlessUI patterns must be preserved in all modals/dropdowns


### 2. TailwindCSS Styling Strategy (No CSS-in-JS)

**Decision:** **Decision:** Pure TailwindCSS with dark mode via `dark:` prefix (no CSS-in-JS)

**Rationale:**
- Performance: No runtime style generation (compiled at build time)
- Type Safety: ClassName strings catch typos at development time
- Dark Mode Built-In: Tailwind's `dark:` prefix requires no additional libraries
- Predictable Output: CSS generated once, not recalculated per component

**Evidence:**
- 5,920+ `dark:` prefixed classes throughout codebase
- Zero CSS-in-JS libraries (no styled-components, emotion)
- Minimal tailwind.config.js (no custom plugins)

**Protected Pattern:** No CSS-in-JS conversions planned


### 3. ContactsPage as Gold Standard Reference

**Decision:** **Decision:** ContactsPage.jsx designated as primary reference implementation

**Rationale - Feature Complete:**
- Sticky headers ✅
- Column resize with drag handles ✅
- Column reorder (drag-drop) ✅
- Inline column filters ✅
- Search with clear button ✅
- Multi-level sort ✅
- localStorage persistence ✅
- Dark mode support ✅
- Row actions ✅
- Empty states with action buttons ✅

**File:** `frontend/src/pages/ContactsPage.jsx` (372 lines)

**Use As Reference For:**
- Column state management patterns
- URL-based tab sync
- Table feature implementation


### 4. Dark Mode Implementation Strategy

**Decision:** **Decision:** CSS-first dark mode using `prefers-color-scheme` media query

**Rationale:**
- No JavaScript Overhead: Applied via CSS, not JS state
- Respects User Preferences: Automatically responds to OS dark mode
- Manual Toggle Possible: Can be enhanced later if needed
- Accessibility Compliant: Respects `prefers-color-scheme` WCAG requirement

**Evidence:**
- Tailwind config uses default dark mode strategy (media query)
- 5,920+ dark mode class usages
- Consistent pattern: `bg-white dark:bg-gray-800`, `text-gray-900 dark:text-white`
- COLOR_SYSTEM.md documents standardized dark colors

**Protected Pattern:** All dark mode classes must be preserved


### 5. HeadlessUI + Heroicons Architecture Decision

**Decision:** **Decision:** Use HeadlessUI for component composition + Heroicons for consistent icons

**Rationale:**
- Composability: HeadlessUI provides unstyled, accessible components styled with TailwindCSS
- Accessibility Built-in: ARIA attributes handled automatically
- Icon Consistency: Heroicons (24-outline style) across all 200+ icon usages
- Package Integration: Both officially maintained by Tailwind Labs

**Evidence:**
- 20+ component files import HeadlessUI (Tab, Dialog, Menu, etc.)
- All icons from `@heroicons/react/24/outline`
- Packages: `@headlessui/react: ^2.2.9`, `@heroicons/react: ^2.2.0`

**Protected Pattern:** HeadlessUI patterns must be preserved in all modals/dropdowns


### 6. TailwindCSS Styling Strategy (No CSS-in-JS)

**Decision:** **Decision:** Pure TailwindCSS with dark mode via `dark:` prefix (no CSS-in-JS)

**Rationale:**
- Performance: No runtime style generation (compiled at build time)
- Type Safety: ClassName strings catch typos at development time
- Dark Mode Built-In: Tailwind's `dark:` prefix requires no additional libraries
- Predictable Output: CSS generated once, not recalculated per component

**Evidence:**
- 5,920+ `dark:` prefixed classes throughout codebase
- Zero CSS-in-JS libraries (no styled-components, emotion)
- Minimal tailwind.config.js (no custom plugins)

**Protected Pattern:** No CSS-in-JS conversions planned


### 7. ContactsPage as Gold Standard Reference

**Decision:** **Decision:** ContactsPage.jsx designated as primary reference implementation

**Rationale - Feature Complete:**
- Sticky headers ✅
- Column resize with drag handles ✅
- Column reorder (drag-drop) ✅
- Inline column filters ✅
- Search with clear button ✅
- Multi-level sort ✅
- localStorage persistence ✅
- Dark mode support ✅
- Row actions ✅
- Empty states with action buttons ✅

**File:** `frontend/src/pages/ContactsPage.jsx` (372 lines)

**Use As Reference For:**
- Column state management patterns
- URL-based tab sync
- Table feature implementation


### 8. Dark Mode Implementation Strategy

**Decision:** **Decision:** CSS-first dark mode using `prefers-color-scheme` media query

**Rationale:**
- No JavaScript Overhead: Applied via CSS, not JS state
- Respects User Preferences: Automatically responds to OS dark mode
- Manual Toggle Possible: Can be enhanced later if needed
- Accessibility Compliant: Respects `prefers-color-scheme` WCAG requirement

**Evidence:**
- Tailwind config uses default dark mode strategy (media query)
- 5,920+ dark mode class usages
- Consistent pattern: `bg-white dark:bg-gray-800`, `text-gray-900 dark:text-white`
- COLOR_SYSTEM.md documents standardized dark colors

**Protected Pattern:** All dark mode classes must be preserved


### 9. Chapter 19 Table Compliance Implementation

**Related Rule:** Bible Bible Chapter 19 (RULES #19.2, #19.3, #19.5B, #19.7, #19.8, #19.9, #19.11A, #19.13, #19.14, #19.16)

**Decision:** Implemented full Chapter 19 table compliance for Claude Code shortcuts management, including column reordering, visual drag indicators, and proper event separation.

**Details:**
**Features Implemented:**

1. **Column Reordering** - HTML5 drag-and-drop API with state management
2. **Visual Drag Indicators** - Bars3Icon (≡) on all draggable columns
3. **Toolbar Layout** - Search left, bulk actions + edit buttons right
4. **Event Separation** - Drag handle does not trigger sorting
5. **Vertical Alignment** - Fixed with minHeight: 44px

**Technical Implementation:**
- Added columnOrderCommands/columnOrderSlang state arrays
- Added draggingColumnCommands/draggingColumnSlang state
- Implemented onDragStart, onDragOver, onDrop, onDragEnd handlers
- Separated drag handle (Bars3Icon) from sortable area
- Added e.stopPropagation() to prevent event conflicts

**Files Modified:**
- frontend/src/components/settings/AgentShortcutsTab.jsx (lines 14, 35-36, 49-50, 633-660, 823-850)

**Trade-offs:**
**Trade-offs:**
- State complexity: Dual table state requires separate variables
- Column persistence: Currently in-memory only (could add localStorage)
- Performance: Drag-drop re-renders entire header (acceptable for small tables)

**Future Enhancements:**
- Add localStorage persistence for column order
- Add keyboard shortcuts for column reordering
- Add column order reset button


## 📊 Test Catalog

### UI Testing Infrastructure State

**Current State:**

✅ **E2E Tests:**
- Framework: Playwright v1.56.1
- Tests: 1 Gantt cascade test with bug-hunter diagnostics
- Location: `frontend/tests/e2e/gantt-cascade.spec.js`
- Features: API monitoring, state tracking, console log monitoring, screenshots

✅ **Unit Test Setup:**
- Framework: Vitest v4.0.8
- Configuration: Exists but no tests written

**Missing Tests:**
❌ Visual regression tests (Percy, BackstopJS)
❌ Accessibility tests (axe-core, jest-axe)
❌ UI component unit tests (Vitest unused)
❌ Browser compatibility (only Chromium)
❌ Responsive/mobile tests
❌ Dark mode screenshot tests
❌ Performance tests (Lighthouse)

**High Value Quick Wins:**
1. Dark mode rendering (screenshot tests)
2. Accessibility scan (axe-core automated)
3. Responsive layouts (viewport testing)
4. Color contrast (automated a11y check)
5. Search clear button functionality
6. Modal close button functionality


## 🎓 Developer Notes

### Chapter Documentation Pending

This chapter requires comprehensive documentation. Bug fixes and architecture decisions should be added as they are discovered.


### UI/UX Enhancement Roadmap

**Priority Matrix:**

**Quick Wins (1-2 hours total):**
- ✅ Fix deprecated color classes: amber→yellow, emerald→green (COMPLETED 2025-11-16)
- [ ] Add clear buttons to 73 search boxes (30-40 min, automatable)
- [ ] Add close buttons to 58 modals (20-30 min, automatable)
- [ ] Add sticky headers to 36 tables (15-20 min, automatable)

**High Impact (3-5 hours):**
- [ ] Add action buttons to 66 empty states (1-2 hours, manual)
- [ ] Add inline filters to 44 tables (3-5 hours, manual)
- [ ] Add aria-labels to 50 icon buttons (1-2 hours, manual)
- [ ] Add search result counts to 53 search boxes (30 min, automatable)

**Medium Impact (5-10 hours):**
- [ ] Badge icon enhancement (95 badges, 2-3 hours)
- [ ] URL state sync for 20 tab components (2 hours)
- [ ] Loading spinners for 12 pages (1 hour)
- [ ] Button hierarchy audit (100 buttons, 3 hours)

**Future Enhancements:**
- [ ] Storybook integration (component showcase)
- [ ] Accessibility scanning (axe-core in CI/CD)
- [ ] Performance optimization (memoization audit)
- [ ] Responsive design system documentation
- [ ] Design tokens export (Figma integration)


### Test Entry - Dummy Run

This is a test entry to verify the unified API works correctly


### Trinity Table Visual Updates - Blue Theme and Borders

Complete visual refresh of Trinity table component with blue theme throughout

CHANGES MADE:
1. Scrollbars: Changed from gray to blue (#2563EB) matching header
   - WebKit: Custom ::-webkit-scrollbar styling with 12px size
   - Firefox: scrollbarColor property for cross-browser support
   - Dark mode: Uses blue-800 (#1E40AF) for thumb
   
2. Table Borders: Changed from border-l border-r to full border
   - Now has top, right, bottom, left borders
   - Creates complete bordered box around table
   - Maintains mx-4 margin for search bar alignment
   
3. Alternating Rows: Kept light blue (bg-blue-50)
   - Even rows: white
   - Odd rows: bg-blue-50 (light blue)
   - Hover: bg-blue-100
   - Initially tried bg-blue-600 matching header but too dark
   
4. Removed Sticky Scrollbar: 
   - Previously had custom sticky horizontal scrollbar at bottom
   - Caused duplicate scrollbar display issue
   - Now uses only native browser scrollbars
   
SPECIFICATION UPDATES:
- RULE #20.19: Native scrollbars with blue theme
- RULE #20.18: Full border on all sides
- Updated section 10 with complete CSS examples
- Documented removal of sticky scrollbar and reasoning


### Trinity Table Complete - Modal and All Features

Complete gold standard implementation. Modal opens ONLY on Content/Title columns. Dedicated resize handles prevent conflicts. Bold 18px headers, 14px rows. All interactions work independently: resize, drag, sort, filter, select, modal.


## 🔍 Common Issues

### Sticky Horizontal Scrollbar Implementation Bugs

Common issues encountered when implementing sticky horizontal scrollbars for wide tables

#### Scenario
When implementing a sticky horizontal scrollbar at the bottom of a table view (BibleTableView), multiple issues were encountered with scroll synchronization, visibility, and positioning.

#### Root Cause
1. **Scroll loop prevention**: Bidirectional scroll sync causes infinite loops without proper flags
2. **Table width detection**: Container scrollWidth !== actual table width when table has minWidth
3. **Native scrollbar conflict**: Both native and custom scrollbars visible simultaneously
4. **Overflow detection**: Default column widths too small to trigger horizontal scroll on wide monitors

#### Solution
**Scroll Loop Prevention:**
```javascript
const isScrollingStickyRef = useRef(false)
const isScrollingMainRef = useRef(false)

const handleScroll = (e) => {
  if (isScrollingStickyRef.current) {
    isScrollingStickyRef.current = false
    return
  }
  isScrollingMainRef.current = true
  // Sync sticky scrollbar
  if (stickyScrollbarRef.current) {
    stickyScrollbarRef.current.scrollLeft = e.target.scrollLeft
  }
  setTimeout(() => { isScrollingMainRef.current = false }, 0)
}
```

**Actual Table Width Detection:**
```javascript
const table = container.querySelector('table')
const actualTableWidth = table ? table.offsetWidth : scrollWidth
setTableScrollWidth(actualTableWidth)
```

**Hide Native Scrollbar:**
```css
.bible-table-scroll::-webkit-scrollbar:horizontal {
  display: none !important;
  height: 0 !important;
}
```
```javascript
style={{
  scrollbarWidth: 'none',
  msOverflowStyle: 'none'
}}
```

**Force Horizontal Overflow:**
```javascript
const COLUMNS = [
  { key: 'content', width: 1200 }, // Increased from 600
  // Total: 2400px > most screens
]
```

#### Prevention
1. **Always use ref flags** to prevent scroll loops in bidirectional sync
2. **Measure actual table element** not container for accurate width
3. **Hide native scrollbars** when implementing custom ones (CSS + inline styles)
4. **Test on wide monitors** - ensure default column widths force overflow
5. **Use ResizeObserver** to update scrollbar on column resize
6. **Position sticky with bottom: 0** to keep scrollbar visible at viewport bottom



# Chapter 21: Agent System & Automation

**Last Updated:** 2025-11-17

## 🐛 Bug Hunter

### ⚡ Agent Shortcuts Not Case-Insensitive

**Status:** ⚡ OPEN
**First Reported:** 2025-11-16
**Severity:** Low

#### Scenario
User types 'Backend Dev' (capital B) but system expects 'backend dev'.

#### Root Cause
Shortcut parsing is case-sensitive in CLAUDE.md

#### Solution
Update shortcut parser to normalize input: .toLowerCase().trim()

#### Prevention
Add test cases for case variations

**Component:** CLAUDE.md agent recognition


## 🏛️ Architecture

### Design Decisions & Rationale

### 1. Database-Primary Agent Configuration

**Decision:** Agent configurations are stored in database, not markdown files.

**Rationale:**
Needed structured data for run tracking, filtering, and real-time updates. Markdown files are read-only snapshots.

**Implementation:**
Created agent_definitions table with JSONB fields for metadata and run details. API endpoints for CRUD operations.

**Trade-offs:**
Trade-off: Requires database migration when adding new agents. Benefit: Live run tracking, success rates, recently_run? checks.


### 2. Run History Tracking with JSONB

**Decision:** Agent run history stored in JSONB fields for flexibility.

**Rationale:**
Run details vary by agent type (files_created, tests_passed, duration_seconds, etc.). Fixed schema would be too rigid.

**Implementation:**
Used JSONB columns: last_run_details and metadata for flexible storage.

**Trade-offs:**
Trade-off: No strict validation on JSONB structure. Benefit: Each agent can track custom metrics.


### 3. Agent Type Taxonomy (4 Types)

**Decision:** Agents categorized into 4 types: development, diagnostic, deployment, planning.

**Details:**
development: backend-developer, frontend-developer | diagnostic: production-bug-hunter, gantt-bug-hunter | deployment: deploy-manager | planning: planning-collaborator

**Rationale:**
Needed clear separation of concerns. Backend work vs frontend work vs bug hunting vs planning.

**Implementation:**
Created agent_type enum with 4 values. Each agent assigned single type.

**Trade-offs:**
Trade-off: Agents can only have one type. Benefit: Clear responsibility boundaries.


### 4. recently_run? Smart Test Skipping

**Decision:** Diagnostic agents check if tests ran recently to avoid redundant runs.

**Details:**
Logic: Returns false if never run | Returns false if last run failed (always re-test failures) | Returns true if last_run_at > 60 minutes ago AND last_status == 'success'

**Rationale:**
Gantt Bug Hunter runs 12 automated tests (30-60 seconds). Wasteful to re-run if nothing changed.

**Implementation:**
AgentDefinition#recently_run?(minutes = 60) returns true if last successful run was within threshold.

**Trade-offs:**
Trade-off: Stale results if threshold too high. Benefit: Faster iteration during development.


## 📊 Test Catalog

### Agent System Test Coverage

Testing status for Agent System components.

**Tests:**
Unit Tests Needed: AgentDefinition#record_success, AgentDefinition#record_failure, AgentDefinition#success_rate, AgentDefinition#recently_run? | Integration Tests Needed: POST /api/v1/agent_definitions/:id/record_run, GET /api/v1/agent_definitions (priority sorting), Agent invocation protocol (end-to-end) | Current Coverage: 0% (no tests written yet)


## 🎓 Developer Notes

### Syncing .claude/agents/*.md with Database

Two sources of agent config: .claude/agents/*.md files and agent_definitions table.

Developer updates .md file but forgets to update database, causing drift.


### Claude Code Commands Configuration

25 commands configured for Claude Code

- **Run all agents in parallel**: /ag, all agents, allagent
- **Run Backend Developer agent**: /backend, backend, backend dev
- **Run Frontend Developer agent**: /frontend, frontend, frontend dev
- **Run Production Bug Hunter agent**: /bug-hunter, bug hunter, production bug hunter
- **Run Deploy Manager agent**: /deploy, deploy
- **Run Planning Collaborator agent**: /plan, plan, planning
- **Run Gantt Bug Hunter agent**: /gantt, gantt
- **Create new API endpoint**: /api, create api
- **Add database migration**: /migration, add migration
- **Fix N+1 query**: /n+1, fix n+1
- **Create new React component**: /component, create component
- **Add dark mode support**: /darkmode, dark mode
- **Fix responsive layout**: /responsive, fix responsive
- **Analyze Heroku logs**: /logs, heroku logs
- **Debug production error**: /debug, debug error
- **Check deployment health**: /health, check health
- **Run database migrations on staging**: /migrate, run migrations
- **Plan new feature**: /feature, plan feature
- **Design database schema**: /schema, design schema
- **Run Gantt visual tests**: /gantt-test, test gantt
- **Verify timezone compliance**: /timezone, check timezone
- **Test cascade behavior**: /cascade, test cascade
- **Check working days enforcement**: /workdays, working days
- **Create service object**: /service, create service
- **Add background job**: /job, background job


### Claude Code Slang Configuration

10 slang shortcuts configured for Claude Code

- **sm**: Schedule Master
- **po**: Purchase Order
- **est**: Estimate
- **inv**: Invoice
- **sup**: Supplier
- **cont**: Contact
- **pb**: Price Book
- **wf**: Workflow
- **gantt**: Gantt Chart
- **sched**: Schedule


### Claude Code Slang Configuration

10 slang shortcuts configured for Claude Code

- **sm**: Schedule Master
- **po**: Purchase Order
- **est**: Estimate
- **inv**: Invoice
- **sup**: Supplier
- **cont**: Contact
- **pb**: Price Book
- **wf**: Workflow
- **gantt**: Gantt Chart
- **sched**: Schedule


### Claude Code Slang Configuration

12 slang shortcuts configured for Claude Code

- **sm**: Schedule Master
- **po**: Purchase Order
- **est**: Estimate
- **inv**: Invoice
- **sup**: Supplier
- **con**: Contact
- **pb**: Price Book
- **wf**: Workflow
- **gantt**: Gantt Chart
- **sched**: Schedule
- **ub**: Update Bible
- **task**: Is the Actual PArt that has a duration on the Gantt


### Claude Code Slang Configuration

12 slang shortcuts configured for Claude Code

- **sm**: Schedule Master
- **po**: Purchase Order
- **est**: Estimate
- **inv**: Invoice
- **sup**: Supplier
- **con**: Contact
- **pb**: Price Book
- **wf**: Workflow
- **gantt**: Gantt Chart
- **sched**: Schedule
- **ub**: Update Bible
- **c19**: Chapter 19


### Claude Code Commands Configuration

26 commands configured for Claude Code

- **Run all agents in parallel**: /ag, all agents, allagent
- **Run Backend Developer agent**: /backend, backend, backend dev
- **Run Frontend Developer agent**: /frontend, frontend, frontend dev
- **Run Production Bug Hunter agent**: /bug-hunter, bug hunter, production bug hunter
- **Run Deploy Manager agent**: /deploy, deploy
- **Run Planning Collaborator agent**: /plan, plan, planning
- **Run Gantt Bug Hunter agent**: /gantt, gantt
- **Create new API endpoint**: /api, create api
- **Add database migration**: /migration, add migration
- **Fix N+1 query**: /n+1, fix n+1
- **Create new React component**: /component, create component
- **Add dark mode support**: /darkmode, dark mode
- **Fix responsive layout**: /responsive, fix responsive
- **Analyze Heroku logs**: /logs, heroku logs
- **Debug production error**: /debug, debug error
- **Check deployment health**: /health, check health
- **Run database migrations on staging**: /migrate, run migrations
- **Plan new feature**: /feature, plan feature
- **Design database schema**: /schema, design schema
- **Run Gantt visual tests**: /gantt-test, test gantt
- **Verify timezone compliance**: /timezone, check timezone
- **Test cascade behavior**: /cascade, test cascade
- **Check working days enforcement**: /workdays, working days
- **Create service object**: /service, create service
- **Add background job**: /job, background job
- **Update the Bible , Update Teacher and UPdate Lexicon with any Bugs we fixed**: /ub, ub



**Last Generated:** 2025-11-17 22:56 AEST
**Generated By:** `rake teeem:export_lexicon`
**Maintained By:** Development Team via Database UI
**Review Schedule:** After each bug fix or knowledge entry