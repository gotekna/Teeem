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
Backend:  v[XXX] - [REQUIRED/not required]
Frontend: v[XXX] - [REQUIRED/not required]
Heroku:   [vXXX] - [deployed/skipped]
========================================
```

## 🔴 CRITICAL: Take Your Time - No Rushing

**Quality over speed. Always.**

- ❌ DON'T rush, skip planning, make assumptions, or take shortcuts
- ✅ DO understand fully, explore thoroughly, ask questions, implement RIGHT solution

## 🔴 CRITICAL: Quality Triggers

| Keyword | What Claude Missed | Action |
|---------|-------------------|--------|
| `ssot` | Duplicate logic exists | Find both, flag to user, ask which is SSoT |
| `ultra` | Lazy thinking | Present 3 approaches, question assumptions, simplify |
| `gold` | Wrong component/bad UI | Check THE ONE table, TeeemTableView, Tailwind, dark mode |

**Before ANY code change:**
1. **SSoT Check** - Is this defined elsewhere? Search first.
2. **Ultra Think** (non-trivial) - 3 approaches? Assumptions? Remove instead of add?
3. **Gold Standard** (UI) - THE ONE component? Tailwind config? Dark mode?

## 🔴 CRITICAL: SSoT Violations

**If you find multiple ways to do the same thing, STOP and alert the user.**

When discovering duplicates:
1. ⚠️ **STOP** - Critical architectural issue
2. 📍 **Document ALL locations** - File paths, line numbers
3. 🧠 **Present 3 solutions** with effort/impact
4. 🎯 **NO BANDAIDS** - Fix root cause, eliminate ALL duplicates
5. ✅ **Consolidate** - Implement THE ONE, delete duplicates, add guards

**Examples:** Cache vs live data, same config in multiple files, duplicate constants, same logic in two services.

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
| `COLUMN_TYPES` | `Column::COLUMN_SQL_TYPE_MAP` |
| System columns | `lib/constants/system-columns.ts` |
| Document types | `lib/constants/document-types.ts` |
| UI components | `lib/component-registry.ts` |

**Rule:** Search `lib/constants/` before creating ANY constant.

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
- ❌ NO custom `<h1>` headers - TeeemTableView renders header
- ✅ Action buttons in `leftActions`
- ✅ Edge-to-edge: `-mx-4`, full height: `h-full flex flex-col`

**"Gold Standard Table" = TeeemTableView** - Changes go to `TeeemTableView.tsx`, not `GoldStandardTab.tsx`

## 🔴 Design System

| Resource | Location |
|----------|----------|
| Tailwind Config | `frontend-next/tailwind.config.ts` |
| Column Types | `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` |

**Non-Negotiables:** Dark mode (`dark:` classes), responsive design, accessibility, config colors (not hex).

## 🔴 Git & Deployment

**Rob works directly on `Live` branch.**

| Environment | Heroku App | URL |
|-------------|-----------|-----|
| Production | `teeemlive` | teeemlive-ce8e2660a615.herokuapp.com |
| Rob Dev | `teeem-rob-dev` | - |
| Sam Dev | `teeem-sam-dev` | - |

**Deploy:** Use `/l` command (SSoT)

**Local:** Frontend port 3000, Backend port 3001

## 🔴 Microsoft 365 (SSoT: MicrosoftCredential)

```ruby
# SSoT lookups
MicrosoftCredential.active_for_org(organization)
MicrosoftAppGraphClient.for_org(organization)
```

- ❌ NEVER: `MicrosoftCredential.active.first` (no org context)
- ✅ ALWAYS: Org-scoped lookups

**UI Term:** "SharePoint" (never "OneDrive" to users)

## 🔴 Xero (SSoT: Webhooks)

**Webhooks are THE SSoT for Xero sync.** Never add scheduled sync jobs.

| What | SSoT |
|------|------|
| Contact/Invoice sync | Webhooks (live) |
| Bank transactions | `xero_bank_transaction_sync` (no webhook available) |

## 🔴 SharePoint Paths (SSoT: CorporateCompanySetting)

```ruby
CorporateCompanySetting.sharepoint_full_path(:jobs)  # SSoT
# NOT: "/Shared Documents/TEEEM Jobs"  # Hardcoded
```

## 🔴 API Response Format

```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "Error message" }
```

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
