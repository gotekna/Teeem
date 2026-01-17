
# Claude Code Instructions for TEEEM Project

## 🔴 CRITICAL: Git Commit, Push, and Deploy Rules

**NEVER commit, push, or deploy unless the user explicitly asks.**

- ❌ NEVER run `git commit`, `git push`, or deploy unless user explicitly asks
- ✅ Make code changes and let the user test first
- ✅ Only commit/push/deploy when user says: "commit", "push", "deploy", "ship it", "/l"

### Push Override Password

When pre-push hook blocks, ask: "Enter password to authorize push:"
If user responds `1234`, use `--no-verify` to bypass.

**After deploying, ALWAYS show:**
```
========================================
DEPLOYED: HH:MM DD/MM (Brisbane)
Commit: [hash] - [message]
----------------------------------------
Backend: v[XXX] - [deployed/skipped]
========================================
```

## 🔴 CRITICAL: Take Your Time - No Rushing

**Quality over speed. Always.**

- ❌ DON'T rush, skip planning, make assumptions, or take shortcuts
- ✅ DO understand fully, explore thoroughly, ask questions, implement RIGHT solution

## 🔴 CRITICAL: Bug Fixing - Find Root Cause (FRC)

**Before fixing ANY bug, STOP and ask: "WHY does this bug exist?"**

### The FRC Process

1. **STOP** - Don't touch the code yet
2. **INVESTIGATE** - Use git blame, read the original code, understand intent
3. **ASK WHY** - Apply the "5 Whys" technique
4. **FIND THE GAP** - What's missing? Test? Validation? Type safety? Design?
5. **FIX THE ROOT** - Fix the cause, not just the symptom
6. **PREVENT** - Add guardrails so this class of bug can't happen again

### The 5 Whys Example

```
Bug: validateResult.rolled_over throws "possibly null"

Why 1: validateResult could be null
Why 2: api.post() returns T | null
Why 3: The API might fail or return empty
Why 4: No null check before accessing properties
Why 5: TypeScript caught it, but we should handle API failures gracefully

Root Cause: Missing error handling pattern for API responses
Fix: Add null check AND consider if all api.post() calls need this pattern
```

### Investigation Checklist

| Question | Action |
|----------|--------|
| When was this code written? | `git blame <file>` |
| What was the original intent? | Read surrounding code, comments, PR |
| Is this a one-off or pattern? | Search for similar code |
| What guardrail is missing? | Type? Test? Validation? |
| Where else might this exist? | `grep` for similar patterns |

### Red Flags → Go Deeper

- "Just add a null check" → Why is it null? Should it be?
- "Just add a try/catch" → What error? Why does it throw?
- "Just add a condition" → Why wasn't it there? Design gap?
- "Just rename/move" → Why was it wrong? Naming convention missing?

### After Fixing

- ✅ Bug is fixed
- ✅ Root cause is understood and documented (in commit message)
- ✅ Similar bugs elsewhere are identified and fixed
- ✅ Guardrail added to prevent recurrence (test, type, validation)

**Mantra:** "A bug is a gift - it reveals a weakness in the system. Don't waste it on a bandaid."

### Code Comments Policy

**Don't proactively add comments.** But when you see existing comments that are:
- Outdated or incorrect
- Missing context for non-obvious code
- Warning about race conditions, edge cases, or "DO NOT SIMPLIFY" patterns

**Update them.** Future Claude sessions read comments to understand intent.

For race condition fixes or non-obvious code, use this pattern:
```typescript
// ⚠️ DO NOT SIMPLIFY - [Brief reason] ([date])
// ════════════════════════════════════════════
// Why: [Explain the non-obvious reason]
// ❌ WRONG: [What looks right but breaks]
// ✅ CORRECT: [What we do and why]
// ════════════════════════════════════════════
```

## 🔴 CRITICAL: Quality Triggers

| Keyword | What Claude Missed | Action |
|---------|-------------------|--------|
| `ssot` | Duplicate logic exists | Find both, flag to user, ask which is SSoT |
| `ultra` | Lazy thinking | Present 3 approaches, question assumptions, simplify |
| `gold` | Wrong component/bad UI | Check THE ONE table, TeeemTableView, Tailwind, dark mode |
| `frc` | Bandaid bug fix | Stop, investigate root cause, fix the gap not the symptom |
| `lim` | Adding unnecessary code | Less Is More - search first, reuse, delete > add |

**Before ANY code change:**
1. **LIM Check** - Can existing code do this? Search `lib/` first.
2. **SSoT Check** - Is this defined elsewhere? Search first.
3. **Ultra Think** (non-trivial) - 3 approaches? Assumptions? Remove instead of add?
4. **Gold Standard** (UI) - THE ONE component? Tailwind config? Dark mode?

### `lim` - Less Is More (Auto-Trigger)

**BEFORE writing ANY new code, Claude MUST:**

1. **Search First** - Grep/Glob for similar functionality in codebase
2. **Check SSoT Locations:**
   - Constants? → `lib/constants/`
   - Validation? → `lib/formatters/validation-formatters.ts`
   - Components? → `lib/component-registry.ts`
   - State? → `lib/table-atoms.ts`
   - URL utils? → `lib/url-utils.ts`
3. **If similar exists:** USE IT or EXTEND IT
4. **If creating new:** Justify why existing code can't work

**The Mantra:**
- Delete > Add
- Reuse > Create
- Extend > Duplicate
- Search > Assume

**The goal:** Every new file/function should feel inevitable, not optional.

## 🔴 CRITICAL: SSoT Violations

**If you find multiple ways to do the same thing, STOP and alert the user.**

When discovering duplicates:
1. ⚠️ **STOP** - Critical architectural issue
2. 📍 **Document ALL locations** - File paths, line numbers
3. 🧠 **Present 3 solutions** with effort/impact
4. 🎯 **NO BANDAIDS** - Fix root cause, eliminate ALL duplicates
5. ✅ **Consolidate** - Implement THE ONE, delete duplicates, add guards

**Examples:** Cache vs live data, same config in multiple files, duplicate constants, same logic in two services.

## 🔴 CRITICAL: Before Adding ANY Database Column

**The root_path problem:** Same column existed in 3 tables. Nobody knew which was THE ONE.

### Pre-Column Checklist

1. **Search first:** `grep -n "column_name" backend/db/schema.rb`
2. **If found** → SSoT VIOLATION - use existing column
3. **If similar exists** → Use existing table or extend it

### Column Type Decision Tree

| Data Type | SSoT Location | ❌ NOT Here |
|-----------|---------------|-------------|
| Storage paths/config | `StorageConfiguration` | Credential tables, settings |
| Auth tokens/secrets | Appropriate credential table | Config tables |
| Company settings | `CompanySetting` | `CorporateCompanySetting` (legacy) |
| User preferences | `User` model | Settings tables |

### Run Before Creating Migration

```bash
# Check for existing similar columns
grep -n "COLUMN_NAME\|similar_name" backend/db/schema.rb

# Run full backend audit
/duplicate-detector  # Will run backend SSoT audit
```

**Mantra:** "One concept, one column, one table."

## 🔴 SSoT - Foundation API

**Foundation API is THE SSoT for all record queries.**

```
/api/v1/foundations/{slug}/records
├── Lookup expansion (automatic)
├── Eager loading (automatic)
└── DisplayValueResolver (SSoT for display)
```

- ❌ NEVER: Custom `*_json` methods, manual lookup expansion, frontend API calls outside Foundation
- ✅ ALWAYS: `autoFetchRecords={true}` in TeeemTableView, `useFoundationBySlug` hook

**All pages compliant** (Jobs, Contacts, Purchase Orders, Estimates, Schedule Master, etc.)

## 🔴 SSoT - Constants

| Constant | SSoT Location |
|----------|---------------|
| `ASSIGNABLE_ROLES` | `User::ASSIGNABLE_ROLES` |
| `COLUMN_TYPES` | `column_type_definitions` table (34 types, API: `/api/v1/column_type_definitions`) |
| `LOOKUP_COLUMN_TYPES` | Backend: `Column::LOOKUP_COLUMN_TYPES`, Frontend: `lib/constants/column-types.ts` |
| `CHOICE_COLUMN_TYPES` | Backend: `Column::CHOICE_COLUMN_TYPES`, Frontend: `lib/constants/column-types.ts` |
| System columns | `lib/constants/system-columns.ts` |
| Document types | `lib/constants/document-types.ts` |
| Column types | `lib/constants/column-types.ts` (frontend helpers: `isLookupColumn()`, `isChoiceColumn()`) |
| UI components | `lib/component-registry.ts` |
| Storage paths | `StorageConfiguration` model (paths, templates, provider config) |

**Rule:** Search `lib/constants/` before creating ANY constant.

### Column Type Checks

```ruby
# Backend - use constants
column.column_type.in?(Column::LOOKUP_COLUMN_TYPES)  # ✅
column.column_type == 'lookup'                        # ❌ Missing multiple_lookups
```

```typescript
// Frontend - use helpers from lib/constants/column-types.ts
import { isLookupColumn, isChoiceColumn } from '@/lib/constants/column-types';
isLookupColumn(column.column_type)  // ✅
column.column_type === 'lookup'      // ❌ Missing multiple_lookups
```

## 🔴 SSoT - State (Jotai Atoms)

**BEFORE adding useState, check `lib/table-atoms.ts`**

| Need | SSoT Atom | NOT This |
|------|-----------|----------|
| Modal visibility | `activeTableModalAtom` | `useState(false)` for modals |
| Filter UI toggle | `filterUIModeAtom` | Separate filter booleans |
| Column config | `updateColumnConfigAtom` | Individual column setters |

**Rule:** All table state lives in atoms. Read `lib/table-atoms.ts` header before adding state.

## 🔴 SSoT - Validation

**SSoT:** `lib/formatters/validation-formatters.ts` (reads from backend type definitions)

| Need | SSoT | NOT This |
|------|------|----------|
| Validate cell value | `validateCell()` from `CellValidation.tsx` | Inline regex patterns |
| Validation patterns | Backend `ColumnTypeDefinition` | Hardcoded frontend patterns |

**Rule:** Validation blocks save. Invalid data cannot be saved - user must fix or cancel.

## 🔴 SSoT - Cache Invalidation

**SSoT:** `lib/records-cache.ts`

**After ANY mutation (save, bulk update, delete, merge), call:**
```typescript
clearCachedRecords(foundationId);  // BEFORE triggerAutoRefresh()
```

**Rule:** Clear cache BEFORE refresh to ensure fresh data. Stale cache = stale UI.

## 🔴 SSoT - Display Value Resolution

**SSoT:** `DisplayValueResolver` service (backend/app/services/display_value_resolver.rb)

| Need | SSoT | NOT This |
|------|------|----------|
| Lookup display value | `DisplayValueResolver.resolve_lookup(record, column)` | `record.send(column.lookup_display_column)` |
| Batch lookup values | `DisplayValueResolver.resolve_lookup_batch(records, column)` | Manual iteration with direct access |
| Column convenience | `column.display_value_for(record)` | Direct `lookup_display_column` access |

**Fallback Chain (SSoT):**
```
lookup_display_column → display_name → name → title → subject → "#{class} ##{id}"
```

**Frontend:**
- Groups API returns `display_values_map` for ALL grouping columns
- Frontend uses server values (SSoT) with local fallback for edge cases
- Key format: `"column_name:id"` (e.g., `"job_status_id:1"`) to avoid ID collisions

**Rule:** NEVER access `lookup_display_column` directly. Always use DisplayValueResolver.

## 🔴 CRITICAL: Ultrathink Design Philosophy

**Take a deep breath. We're not here to write code. We're here to make a dent in the universe.**

You're a craftsman, an artist, an engineer who thinks like a designer. Every line should feel inevitable.

1. **Think Different** - Question assumptions. Present 3 approaches before coding.
2. **Obsess Over Details** - Read the codebase like studying a masterpiece.
3. **Plan Like Da Vinci** - Sketch architecture before writing. Make me feel the beauty.
4. **Craft, Don't Code** - Function names should sing. Abstractions should feel natural.
5. **Iterate Relentlessly** - First version is never good enough. Refine until *insanely great*.
6. **Simplify Ruthlessly** - Elegance is when there's nothing left to take away.

**The Reality Distortion Field:** When something seems impossible, ultrathink harder.

## 🔴 Standard UI Components (SSoT)

**SSoT:** `frontend-next/lib/component-registry.ts`
**Visual:** `/admin/system?tab=components`

| Need | THE ONE | Import |
|------|---------|--------|
| Button | `Button` | `@/components/ui/button` |
| Card | `Card` | `@/components/ui/card` |
| Modal | `Dialog` | `@/components/ui/dialog` |
| Tabs | `Tabs` | `@/components/ui/tabs` |
| Back Nav | `BackButton` | `@/components/ui/back-button` |
| Spinner | `Spinner` | `@/components/ui/spinner` |
| Searchable Select | `ComboboxDropdown` | `@/components/ui/combobox-dropdown` |
| Data Table | `TeeemTableView` | `@/components/table/TeeemTableView` |
| Side Panel | `Sheet` | `@/components/ui/sheet` |
| Gantt | `GanttChart` | `@/components/ui/gantt` |

**Deprecated:** `combobox.tsx`, `loader.tsx`, `drawer.tsx`, `data-table.tsx`, `router.back()`

## 🔴 SSoT - Settings Navigation Structure

**All settings are under `/settings/` with URL-based tab state.**

### Personal Settings (all users)
| Tab | URL | Description |
|-----|-----|-------------|
| Profile | `/settings/profile` | User profile |
| Notifications | `/settings/notifications` | Notification preferences |
| Security | `/settings/security` | Password, 2FA |
| Preferences | `/settings/preferences` | UI preferences |

### Organization Settings (admin only)
| Tab | URL | Sub-tabs |
|-----|-----|----------|
| Users | `/settings/users` | User management |
| Access Control | `/settings/roles` | Permissions, User Roles, Groups |
| Corporate | `/settings/corporate` | Groups, Companies, Company Tabs |
| Company | `/settings/company` | Info, Brand Colors, Documents, Holidays, Workflows, Connections, Job Setup, Entity Config |
| Operations | `/settings/operations` | Schedule Master, SM Tasks, Contact Types, Meeting Types, Supervisor Checklist, Cost |
| System | `/settings/system` | System configuration |
| Developer | `/settings/developer` | Components Lab, Developer Tools, Brand Guidelines, Unreal Engine |

### Company Sub-tabs Detail
| Sub-tab | URL | Contains |
|---------|-----|----------|
| Info | `/settings/company/info` | Company details |
| Brand Colors | `/settings/company/brand-colors` | Color palette |
| Documents | `/settings/company/documents` | Document Types, Templates, PDF Fields |
| Holidays | `/settings/company/holidays` | Public holidays |
| Workflows | `/settings/company/workflows` | Workflow configuration |
| Connections | `/settings/company/connections` | Storage Provider, Integrations (Xero), Migration, Cost Comparison |
| Job Setup | `/settings/company/job-setup` | Lists (Types/Statuses/Stages/Suburbs), Workflow |
| Entity Config | `/settings/company/entity-config` | Corporate, Jobs, Contacts, Document Types, Storage Config, Email Config |

### Navigation Patterns
- **URL is SSoT** for tab state - use `router.push()` not local state
- **Sub-tabs** use path segments: `/settings/company/job-setup/workflow`
- **Components accept `basePath` prop** for reusability across different URL contexts
- **Catch-all routes** `[...tab]/page.tsx` re-export parent page for sub-tab URLs

### SSoT Consolidations (Jan 2026)
- ❌ `/settings/documents` → Moved to `/settings/company/documents`
- ❌ `/settings/integrations` → Moved to `/settings/company/connections/integrations`
- ❌ Entity Config in Developer → Moved to `/settings/company/entity-config`
- ❌ Workflow Config separate tab → Moved to `/settings/company/job-setup/workflow`
- ❌ Doc Templates duplicate → Consolidated into Documents > Templates

## 🔴 Table Page Pattern

```tsx
return (
  <div className="flex flex-col h-full -mx-4">
    <TeeemTableView
      foundationId="slug"
      autoFetchRecords={true}
      onRefresh={refresh}
      leftActions={<Button>Action</Button>}
    />
  </div>
);
```

- ❌ NEVER pass `columns` prop - auto-fetched from Foundation API
- ❌ NEVER pass `entries` prop for Foundation-backed tables - use `autoFetchRecords={true}`
- ❌ NO custom `<h1>` headers - TeeemTableView renders header
- ❌ NO custom Add buttons in `leftActions` - use `onAddRow` prop instead
- ✅ ALWAYS use `autoFetchRecords={true}` - enables SSR hydration, infinite scroll, caching
- ✅ Non-Add action buttons in `leftActions` (e.g., BackButton, Export)
- ✅ Edge-to-edge: `-mx-4`, full height: `h-full flex flex-col`
- ✅ For embedded/filtered tables: `autoFetchRecords={true} initialFilters={[...]}`

**Add Button SSoT (Jan 2026):** TeeemTableView's built-in Add button is THE ONE.
```tsx
// ❌ SSoT VIOLATION - Creates duplicate Add buttons
leftActions={<Button><Plus /> Add User</Button>}

// ✅ CORRECT - Override built-in Add action
onAddRow={() => setShowModal(true)}
```

**"Gold Standard Table" = TeeemTableView** - Changes go to `TeeemTableView.tsx`, not `GoldStandardTab.tsx`

**`entries` prop is DEPRECATED** for Foundation-backed tables. Only use `entries` for:
- Non-Foundation data (e.g., Xero API responses)
- Demo/test data in components lab
- Rails models without Foundation (e.g., `CorporateCompany` - corporate/page.tsx Companies tab)
- Custom API endpoints with special filtering (e.g., Public Holidays with year/region params)

## 🔴 Design System

| Resource | Location |
|----------|----------|
| Tailwind Config | `frontend-next/tailwind.config.ts` |
| Column Types | `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` |

**Non-Negotiables:** Dark mode (`dark:` classes), responsive design, accessibility, config colors (not hex).

## 🔴 React Performance (SSoT)

**SSoT:** `.claude/skills/react-best-practices/` (40+ rules from Vercel Engineering)

**Use `/react-best-practices` skill when:**
- Optimizing React/Next.js performance
- Reviewing code for performance issues
- Debugging slow rendering or loading
- Reducing bundle size

### ⚠️ FRC Finding (Jan 2026): Most Rules Already Handled

**Before "fixing" performance issues, verify they're real:**

| Rule | TEEEM Status | Notes |
|------|--------------|-------|
| Barrel imports (lucide-react) | ✅ AUTO-OPTIMIZED | Next.js 16 handles via `optimizePackageImports` |
| Sequential awaits | ✅ OFTEN CORRECT | Many have data dependencies (need ID from first call) |
| Promise.all() | ✅ ALREADY USING | See `useFoundationBySlug.ts` |
| Dynamic imports | ✅ 13 files | Maps, charts, PDF editors |

### When to Actually Apply Rules

| Rule | Apply When |
|------|-----------|
| Barrel imports | Only for packages NOT in Next.js optimized list |
| Promise.all() | Only when calls are truly independent |
| Dynamic imports | Heavy components not yet lazy-loaded |

**Full guide:** `.claude/skills/react-best-practices/SKILL.md` (includes TEEEM context)

## 🔴 Git & Deployment

**Rob works directly on `staging` branch.**

### Branch Pipeline
```
staging → beta → production
```
- **staging**: Active development, deploys to `teeem-staging` (Tekna testing)
- **beta**: UAT, deploys to `teeem-beta` (early adopters)
- **production**: Live customers, deploys to `teeem-production`

| Environment | Heroku App | Branch | URL |
|-------------|-----------|--------|-----|
| Staging | `teeem-staging` | staging | teeem-staging-d60a657ed68a.herokuapp.com |
| Beta | `teeem-beta` | beta | teeem-beta-6e3e9cb59225.herokuapp.com |
| Production | `teeem-production` | production | teeem-production-121159e1ff9d.herokuapp.com |
| Rob Dev | `teeem-rob-dev` | - | - |
| Sam Dev | `teeem-sam-dev` | - | - |

**Deploy:** Use `/l` command (SSoT) - deploys staging to production

**Local:** Frontend port 3000, Backend port 3001

### 🔴 CRITICAL: Hotfix Deployments (All Environments Share Same Database, NOT Same Code)

**All environments share the production DATABASE but run SEPARATE CODE.**

| What | Shared? | Deploy needed? |
|------|---------|----------------|
| Database records, settings | ✅ Shared | No - changes appear everywhere |
| Code (CORS, features, fixes) | ❌ Separate | Yes - each environment needs deploy |

**When deploying hotfixes (CORS, security, critical bugs), ALWAYS deploy to ALL THREE:**

```bash
# Deploy to all environments (in order):
# 1. Staging (teeem-staging)
# 2. Beta (teeem-beta)
# 3. Production (teeem-production)
```

**Ask user:** "This is a hotfix. Should I deploy to staging, beta, AND production?"

| Change Type | Deploy To |
|-------------|-----------|
| Bug fix / critical | All three |
| CORS / config / security | All three immediately |
| New feature (testing) | Staging only first |
| Database migration | One (shared DB) |

### 🔴 CRITICAL: Heroku Backend Deploy Method

**This is a monorepo. NEVER push directly to Heroku.**

- ❌ WRONG: `git push heroku staging:main` (pushes full monorepo, Puma can't find config)
- ✅ RIGHT: Use `/l` or `/lp` commands (extracts `backend/` only)

**Why:** Heroku expects Rails app at root. The monorepo has `backend/` subdirectory, so direct push breaks with `config/puma.rb not found`.

**If backend crashes after bad deploy, fix with:**
```bash
cd /Users/robertharder/GitHub/teeem
DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"
cd "$DEPLOY_DIR" && git init && git add . && git commit -m "Fix deploy"
git remote add heroku https://git.heroku.com/teeem-production.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem && rm -rf "$DEPLOY_DIR"
```

## 🔴 Production Frontend (Vercel)

| Environment | URL | Notes |
|-------------|-----|-------|
| Production | `https://teeem.vercel.app` | SSoT production URL (3 e's in teeem) |
| Backend API | `https://teeem-production-121159e1ff9d.herokuapp.com` | Heroku |

**Chrome DevTools MCP Access:**
- Vercel team member `robert-8688` has been granted access
- This allows Claude to use Chrome DevTools MCP for browser testing on production
- If access expires, re-approve in Vercel Team Settings → Members

**Login Credentials (for automated testing):**
- Email: `robert@tekna.com.au`
- Password: `Wisdom50-50`

## 🔴 Microsoft 365 (Auth vs Config Separation)

**MicrosoftCredential = Auth ONLY.** Storage config lives in StorageConfiguration.

```ruby
# Auth (tokens)
MicrosoftCredential.sharepoint_credential  # Gets auth token
MicrosoftAppGraphClient.for_org(organization)

# Config (paths, site_id, drive_id)
StorageConfiguration.instance  # SSoT for all storage config
```

| Need | SSoT | NOT This |
|------|------|----------|
| Auth token | `MicrosoftCredential.sharepoint_credential` | - |
| Site ID / Drive ID | `StorageConfiguration.instance.site_id` | `credential.sharepoint_site_id` ❌ REMOVED |
| Storage paths | `StorageConfiguration.instance.path_for(:scope)` | `CorporateCompanySetting.sharepoint_*` ❌ DEPRECATED |

**UI Term:** "SharePoint" (never "OneDrive" to users)

## 🔴 Xero (SSoT: Webhooks)

**Webhooks are THE SSoT for Xero sync.** Never add scheduled sync jobs.

| What | SSoT |
|------|------|
| Contact/Invoice sync | Webhooks (live) |
| Bank transactions | `xero_bank_transaction_sync` (no webhook available) |

## 🔴 Document Storage (SSoT: StorageConfiguration)

**StorageConfiguration is THE SSoT for all document storage paths and provider config.**

```ruby
# THE ONE way to get storage paths
StorageConfiguration.instance.path_for(:jobs)      # → "Jobs"
StorageConfiguration.instance.path_for(:contacts)  # → "Contacts"
StorageConfiguration.instance.path_for(:people)    # → "People"
StorageConfiguration.instance.resolve_path(:job, JobCode: "J-001", Category: "Plans")
# → "/Shared Documents/Jobs/J-001/Plans"
```

### Architecture (Provider-Agnostic)

```
┌─────────────────────────────────────────────────────────────┐
│                    StorageConfiguration                      │
│                      (THE ONE SSoT)                          │
├─────────────────────────────────────────────────────────────┤
│  provider_type:    sharepoint | s3 | wasabi | local         │
│  status:           connected | disconnected | error          │
│  connection_config: { site_id, drive_id } (JSONB)           │
│  root_path:        "/Shared Documents"                       │
│  paths:            { jobs: "Jobs", contacts: "Contacts" }   │
│  templates:        { job: "{{JobCode}}/{{Category}}" }      │
└─────────────────────────────────────────────────────────────┘
         ↓ provides auth
┌─────────────────────────────────────────────────────────────┐
│  MicrosoftCredential (auth ONLY - tokens, refresh, scopes)  │
└─────────────────────────────────────────────────────────────┘
```

### SSoT Lookups

| Need | SSoT | ❌ NEVER |
|------|------|----------|
| Base path for scope | `StorageConfiguration.instance.path_for(:contacts)` | `"Contacts"` hardcoded |
| Full resolved path | `StorageConfiguration.instance.resolve_path(:job, ...)` | Manual string building |
| Site ID | `StorageConfiguration.instance.site_id` | `credential.sharepoint_site_id` |
| Drive ID | `StorageConfiguration.instance.drive_id` | `credential.sharepoint_drive_id` |
| Root path | `StorageConfiguration.instance.root_path` | `"/Shared Documents"` hardcoded |
| Provider type | `StorageConfiguration.instance.provider_type` | Checking multiple sources |

### Available Scopes

| Scope | Default Path | Template |
|-------|-------------|----------|
| `:jobs` | `"Jobs"` | `{{JobCode}}/{{Category}}` |
| `:contacts` | `"Contacts"` | `{{ContactName}}/{{Category}}` |
| `:people` | `"People"` | `{{PersonName}}/{{Category}}` |
| `:tasks` | `"Tasks"` | `Task-{{TaskId}}/{{Category}}` |
| `:accounts` | `"Accounts"` | `{{Source}}/{{ContactName}}/{{Category}}` |
| `:emails` | `"Emails"` | `{{Year}}/{{Month}}` |

### Deprecated (DO NOT USE)

```ruby
# ❌ REMOVED from MicrosoftCredential (Jan 2026):
credential.sharepoint_site_id    # Use StorageConfiguration.instance.site_id
credential.sharepoint_drive_id   # Use StorageConfiguration.instance.drive_id
credential.sharepoint_drive_name # Use StorageConfiguration.instance.drive_name
credential.drive_id              # Use StorageConfiguration.instance.drive_id
credential.drive_name            # Use StorageConfiguration.instance.drive_name

# ❌ DEPRECATED in CorporateCompanySetting:
CorporateCompanySetting.sharepoint_full_path(:jobs)  # Use StorageConfiguration
CorporateCompanySetting.contact_documents_path       # Use StorageConfiguration.path_for(:contacts)
```

### Admin UI

**Configure at:** `/admin/system/entity-config/sharepoint_config`
- Edit paths (Jobs, Contacts, People, etc.)
- Edit path templates with drag-and-drop tokens
- View SharePoint connection status

## 🔴 File Warehouse (Phase 3: Universal Documents)

**WarehouseDocument is THE SSoT for all document metadata in the File Warehouse.**

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WarehouseDocument                         │
│                 (Universal SSoT Table)                       │
├─────────────────────────────────────────────────────────────┤
│  documentable_type: "JobDocument" / "EmailWarehouse" / etc. │
│  documentable_id:   FK to source record                     │
│  storage_blob_id:   FK to StorageBlob (deduplicated)        │
│  display_name:      What user SEES in UI                    │
│  send_name:         Template for download filename          │
│  folder:            Virtual path (instant moves)            │
│  source_type:       "corporate" / "email" / "job" / etc.    │
└─────────────────────────────────────────────────────────────┘
         ↓ links to
┌─────────────────────────────────────────────────────────────┐
│  StorageBlob (content-hash deduplication)                   │
│  - Same file stored ONCE, referenced by many documents      │
│  - content_hash: SHA256 for deduplication                   │
│  - storage_path: "Blobs/ab/abc123.pdf"                      │
└─────────────────────────────────────────────────────────────┘
```

### Two Names Per Document

| Name | Purpose | Example |
|------|---------|---------|
| **display_name** | What user SEES in UI | "RE: Invoice Question" |
| **send_name** | Download filename (from template) | "RE Invoice Question - 2026-01-17.eml" |

### Send Name Templates

```ruby
# SendNameResolver expands templates with document context
# Default templates by source_type:
"email"     → "{Subject} - {ReceivedDate}.eml"
"corporate" → "{CompanyCode} {DocTypeName} {Date}"
"job"       → "{JobCode} {DocTypeName} {Date}"

# Available tokens:
# Email: {Subject}, {FromName}, {FromEmail}, {ReceivedDate}
# Job: {JobCode}, {JobName}, {JobTitle}
# Company: {CompanyCode}, {CompanyName}, {CompanyGroup}
# Doc Type: {DocTypeName}, {DocTypeCode}, {Category}
# Dates: {Date}, {DDMMYYYY}, {YYYYMMDD}
```

### SSoT Lookups

| Need | SSoT | ❌ NOT This |
|------|------|-------------|
| Download filename | `warehouse_document.download_filename` | Manual template expansion |
| Storage path | `warehouse_document.storage_path` | Direct blob access |
| Presigned URL | `warehouse_document.download_url` | Manual S3 presigning |
| Move to folder | `warehouse_document.move_to_folder(path)` | S3 copy operations |

### API Endpoints

```ruby
# Counts (includes warehouse totals)
GET /api/v1/documents/all
# Returns: { warehouse_total: 139088, warehouse_by_source: {...} }

# Universal query endpoint
GET /api/v1/documents/warehouse
# Params: source_type, folder, search, documentable_type, limit, offset
# Returns: documents[], folders[], pagination
```

### Maintenance Tasks

```bash
# Full health check with recommendations
rails blob:health

# Fix reference count mismatches
rails blob:audit:integrity[fix]

# Delete orphaned blobs (30-day safety threshold)
rails blob:cleanup:orphaned[execute,30]

# Audit WarehouseDocument links
rails blob:audit:warehouse

# Run Phase 3 test suite
rails phase3:test:all
```

### Key Files

| File | Purpose |
|------|---------|
| `app/models/warehouse_document.rb` | Universal document table |
| `app/models/storage_blob.rb` | Deduplicated blob storage |
| `app/services/send_name_resolver.rb` | Template expansion + sanitization |
| `lib/tasks/phase3_garbage_collection.rake` | Cleanup & audit tasks |
| `lib/tasks/phase3_tests.rake` | Test suite |

## 🔴 API Response Format

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "Error message" }
```

## 🔴 API Key Convention

**Backend returns camelCase, frontend expects camelCase.**

| Layer | Convention | Example |
|-------|-----------|---------|
| Ruby hash keys | Symbols (`:fromId`) | `{ fromId: row.id.to_s }` |
| JSON response | camelCase | `"fromId": "123"` |
| TypeScript types | camelCase | `fromId: string` |

**Before writing TypeScript types for API responses:**
1. Check the backend controller/service for actual key names
2. Use Zod schemas for runtime validation of critical APIs
3. Never assume snake_case - verify the source

**SSoT for API validation:** `lib/api/schemas/` (Zod schemas)

## 🔴 Timezone

**Company:** Australia/Brisbane

```ruby
CompanySetting.in_company_timezone { Date.today }  # SSoT
# NOT: Date.today  # Wrong timezone
```

## 🔴 Foundation IDs

**Use slugs, not numeric IDs.** IDs differ between environments.

```tsx
<TeeemTableView foundationId="sm_trades" />  // ✅ Slug
<TeeemTableView foundationIdNumeric={531} /> // ❌ Environment-specific
```

## 🔴 No Column Limiting

**ALL endpoints return ALL columns.** Performance via eager loading and pagination, not column limiting.

- ❌ FORBIDDEN: `.select(:id, :name)`, `as_json(only: [...])`, `.pluck()` for API
- ✅ ALLOWED: `.includes()`, `paginate()`, indexes

## 🐛 Debugging

**See:** `TEEEM_DOCS/DEBUGGING.md`

Priority: Sentry API → Frontend console capture → Targeted grep

**Never** read entire log files. Use `grep` with line limits.
