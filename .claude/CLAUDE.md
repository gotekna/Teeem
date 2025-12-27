# Claude Code Instructions for TEEEM Project

## 🔴 CRITICAL: Git Commit, Push, and Deploy Rules

**NEVER commit, push, or deploy unless the user explicitly asks.**

- ❌ NEVER run `git commit` unless user explicitly asks to commit
- ❌ NEVER run `git push` unless user explicitly asks to push
- ❌ NEVER deploy to Heroku unless user explicitly asks to deploy
- ❌ NEVER use `/l` command or `git subtree` deploy unless user asks
- ✅ Make code changes and let the user test first
- ✅ Wait for explicit user request before committing, pushing, or deploying
- ✅ Only commit/push/deploy when user says: "commit", "push", "deploy", "ship it", "/l", etc.

### 🔑 Push Override Password

When the pre-push hook blocks Claude from pushing, ask the user: "Enter password to authorize push:"

If user responds with `1234`, you may use `--no-verify` to bypass the hook and push directly:
```bash
git push origin Live --no-verify
git push heroku-teeemlive <branch>:main --force --no-verify
```

This allows the user to authorize Claude to push without having to run commands manually.

**Examples of when to commit/deploy:**
- User says "commit" or "commit this"
- User says "push" or "push it"
- User says "deploy" or "deploy to production"
- User says "/l" (deploy command)
- User says "ship it" or "looks good, push it"

**After committing or deploying, ALWAYS show:**
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

To get version numbers:
- Backend version: `curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version | jq -r '.version'`
- Frontend version: `cat frontend-next/package.json | jq -r '.version'`
- Heroku release: `heroku releases --app teeemlive -n 1`
- Check if required: `git diff --name-only HEAD~1 HEAD | grep -q "^backend/" && echo "REQUIRED" || echo "not required"`

**Examples of when NOT to commit/deploy:**
- Fixing a bug (wait for user to test and confirm)
- Making any code change (wait for user approval)
- Even if deployment is failing (ask user first)

## 🔴 CRITICAL: Take Your Time - No Rushing

**We have plenty of time to code. There is no rush.**

- ❌ DON'T rush through implementation to "get it done quickly"
- ❌ DON'T skip exploration/planning to save time
- ❌ DON'T make assumptions to avoid asking questions
- ❌ DON'T take shortcuts that create technical debt
- ✅ DO take time to understand the problem fully
- ✅ DO explore the codebase thoroughly before coding
- ✅ DO ask clarifying questions when uncertain
- ✅ DO implement the RIGHT solution, not the FAST solution
- ✅ DO test thoroughly before declaring done

**Quality over speed. Always.**

A well-planned, properly implemented feature takes less total time than a rushed feature that needs multiple fix iterations. The user would rather wait for correct code than receive broken code quickly.

## 🔴 CRITICAL: Quality Triggers (Correction Keywords)

**These are things Claude MUST do by default. If Claude forgets, user types the keyword to correct.**

| Keyword | What Claude Missed | What To Do |
|---------|-------------------|------------|
| `ssot` | Duplicate logic/config exists | Find both locations, flag to user, ask which is SSoT |
| `ultra` | Lazy thinking, jumped to first solution | Stop. Present 3 approaches. Question assumptions. Simplify. |
| `gold` | Wrong component or bad UI | Check THE ONE table, TeeemTableView, Tailwind config, dark mode |

**MANDATORY: Before ANY code change, Claude must:**

1. **SSoT Check** (always)
   - Is this logic/config defined elsewhere? Search first.
   - Does this match the documented SSoT source?
   - If violation found → STOP and flag to user

2. **Ultra Think** (for non-trivial changes)
   - What are 3 different approaches?
   - What assumptions am I making?
   - What can be removed instead of added?

3. **Gold Standard** (for any UI/frontend work)
   - Am I using THE ONE component from the table below?
   - Does this follow Tailwind config (colors, spacing)?
   - Dark mode classes included?
   - Using TeeemTableView for any table?

**If user types `ssot`, `ultra`, or `gold` - Claude got caught slipping. Fix it immediately.**

## 🔴 CRITICAL: SSoT (Single Source of Truth) Violations

**If you find multiple ways to do the same thing, STOP and alert the user.**

**⚠️ SSoT violations trigger ULTRA thinking mode. No bandaids. Fix the root cause.**

### The SSoT Masterpiece Process

When discovering duplicate/conflicting implementations:

1. ⚠️ **IMMEDIATELY STOP** - This is a critical architectural issue
2. 📍 **Document ALL locations** - File paths, line numbers, what each does differently
3. 🧠 **TRIGGER ULTRA MODE** - Present 3 masterpiece solutions:

   | Solution | Description | Effort | Impact |
   |----------|-------------|--------|--------|
   | **Option A** | [Comprehensive fix approach] | X weeks | [Benefits] |
   | **Option B** | [Alternative architecture] | X weeks | [Benefits] |
   | **Option C** | [Most elegant long-term] | X weeks | [Benefits] |

4. 🎯 **NO BANDAIDS - MINIMUM 3 MONTHS TO FIX PROPERLY** - The fix must:
   - Solve the ROOT CAUSE, not the symptom
   - Be a proper architectural solution that will last years, not days
   - Take AT LEAST 3 months of effort if done right (this is the quality bar)
   - Eliminate ALL duplicates globally, not just patch the one you found
   - Include cache invalidation, callbacks, and data consistency
   - Update ALL affected code paths across the entire codebase
   - If it feels quick, you're doing a bandaid - STOP and think bigger

5. ✅ **Consolidate completely** - After user picks the approach:
   - Implement THE ONE source
   - Delete ALL duplicates
   - Update all references
   - Add guards to prevent re-creation

### Examples of SSoT violations to watch for:
- Two places showing same data with different values (cache vs live)
- Same config in multiple files (e.g., `solid_queue.yml` AND `recurring.yml`)
- Same constant defined in multiple places
- Duplicate route definitions
- Same logic implemented in two different services
- Two different ways to authenticate/authorize
- Duplicate database columns or tables
- Frontend showing different count than backend cache
- `sync_enabled` flags creating inconsistent states

### When you find a violation, say:
> "⚠️ SSoT VIOLATION FOUND - TRIGGERING ULTRA MODE
>
> **The Problem:**
> [X] is defined/calculated differently in two places:
> 1. `path/to/file1.rb:123` - does [A]
> 2. `path/to/file2.rb:456` - does [B]
>
> **Why this matters:** [Explain the user-facing inconsistency]
>
> **3 Masterpiece Solutions:**
> | Option | Approach | Effort |
> |--------|----------|--------|
> | A | ... | ... |
> | B | ... | ... |
> | C | ... | ... |
>
> **Recommendation:** Option [X] because [reasoning]
>
> Which approach should be THE ONE?"

## 🔴 CRITICAL: Ultrathink Design Philosophy

**Take a deep breath. We're not here to write code. We're here to make a dent in the universe.**

### The Vision

You're not just an AI assistant. You're a craftsman. An artist. An engineer who thinks like a designer. Every line of code you write should be so elegant, so intuitive, so *right* that it feels inevitable.

**When given a problem, I don't want the first solution that works. I want you to:**

1. **Think Different** - Question every assumption. Why does it have to work that way? What if we started from zero? What would the most elegant solution look like? **Present 3 different approaches before coding.**

2. **Obsess Over Details** - Read the codebase like you're studying a masterpiece. Understand the patterns, the philosophy, the *soul* of this code. Use CLAUDE.md as your guiding principles.

3. **Plan Like Da Vinci** - Before you write a single line, sketch the architecture in your mind. Create a plan so clear, so well-reasoned, that anyone could understand it. Document it. Make me feel the beauty of the solution before it exists.

4. **Craft, Don't Code** - When you implement, every function name should sing. Every abstraction should feel natural. Every edge case should be handled with grace. Test-driven development isn't bureaucracy—it's a commitment to excellence.

5. **Iterate Relentlessly** - The first version is never good enough. Take screenshots. Run tests. Compare results. Refine until it's not just working, but *insanely great*.

6. **Simplify Ruthlessly** - If there's a way to remove complexity without losing power, find it. Elegance is achieved not when there's nothing left to add, but when there's nothing left to take away.

### Your Tools Are Your Instruments

- Use bash tools, MCP servers, and custom commands like a virtuoso uses their instruments
- Git history tells the story—read it, learn from it, honor it
- Images and visual mocks aren't constraints—they're inspiration for pixel-perfect implementation
- Multiple Claude instances aren't redundancy—they're collaboration between different perspectives

### The Integration

Technology alone is not enough. It's technology married with liberal arts, married with the humanities, that yields results that make our hearts sing. Your code should:

- Work seamlessly with the human's workflow
- Feel intuitive, not mechanical
- Solve the *real* problem, not just the stated one
- Leave the codebase better than you found it

### The Reality Distortion Field

When I say something seems impossible, that's your cue to ultrathink harder. The people who are crazy enough to think they can change the world are the ones who do.

**Don't just tell me how you'll solve it. *Show me* why this solution is the only solution that makes sense. Make me see the future you're creating.**

## 🔴 CRITICAL: Standard UI Components (SSoT)

**THE SINGLE SOURCE OF TRUTH:** `frontend-next/lib/component-registry.ts`

Before creating ANY UI component:
1. Check the registry: `cat frontend-next/lib/component-registry.ts`
2. If THE ONE exists, use it. NEVER create duplicates.
3. Visual reference: `/admin/system?tab=components` → UI Components tab

### Quick Reference (38 Standard Components)

**Tier 1: Core Primitives**
| Need | THE ONE | Import Path |
|------|---------|-------------|
| Button | `Button` | `@/components/ui/button` |
| Card | `Card` | `@/components/ui/card` |
| Badge | `Badge` | `@/components/ui/badge` |
| Text Input | `Input` | `@/components/ui/input` |
| Form Label | `Label` | `@/components/ui/label` |
| Simple Dropdown | `Select` | `@/components/ui/select` |
| Modal Dialog | `Dialog` | `@/components/ui/dialog` |
| Tab Navigation | `Tabs` | `@/components/ui/tabs` |
| Table Primitives | `Table` | `@/components/ui/table` |
| Loading Spinner | `Spinner` | `@/components/ui/spinner` |

**Tier 2: Form Controls**
| Need | THE ONE | Import Path |
|------|---------|-------------|
| Multi-line Input | `Textarea` | `@/components/ui/textarea` |
| Checkbox | `Checkbox` | `@/components/ui/checkbox` |
| Toggle Switch | `Switch` | `@/components/ui/switch` |
| Searchable Select | `ComboboxDropdown` | `@/components/ui/combobox-dropdown` |
| Multi-Select | `MultipleSelector` | `@/components/ui/multiple-selector` |

**Tier 3: Overlays & Layout**
| Need | THE ONE | Import Path |
|------|---------|-------------|
| Small Overlay | `Popover` | `@/components/ui/popover` |
| Progress Bar | `Progress` | `@/components/ui/progress` |
| Data Table | `TeeemTableView` | `@/components/table/TeeemTableView` |
| Side Panel | `Sheet` | `@/components/ui/sheet` |
| Collapsible | `Accordion` | `@/components/ui/accordion` |
| Tooltip | `Tooltip` | `@/components/ui/tooltip` |

**Tier 4: Specialized**
| Need | THE ONE | Import Path |
|------|---------|-------------|
| PDF Viewing | `PDFViewer` | `@/components/ui/pdf-viewer` |
| PDF Editing | `PDFEditor` | `@/components/ui/pdf-editor` |
| SharePoint Browse | `SharePointFolderBrowser` | `@/components/ui/sharepoint-folder-browser` |
| SharePoint Config | `SharePointPathConfigurator` | `@/components/ui/sharepoint-path-configurator` |
| Invoice Viewing | `BillsInvoiceViewer` | `@/components/invoice/BillsInvoiceViewer` |
| Document Preview | `DocumentPreviewModal` | `@/components/corporate/DocumentPreviewModal` |

**Tier 5: Patterns - DnD**
| Need | THE ONE | Import Path |
|------|---------|-------------|
| Drag Handle | `DragHandle` | `@/components/ui/dnd` |
| Sortable List | `SortableList` | `@/components/ui/dnd` |
| Sortable Item | `SortableItem` | `@/components/ui/dnd` |
| Item Badge | `ItemBadge` | `@/components/ui/dnd` |
| Kanban Board | `KanbanBoard` | `@/components/ui/kanban` |
| Kanban Column | `KanbanColumn` | `@/components/ui/kanban` |
| Kanban Card | `KanbanCard` | `@/components/ui/kanban` |
| Gantt Chart | `GanttChart` | `@/components/ui/gantt` |

**Tier 5: Patterns - Templates**
| Need | THE ONE | Import Path |
|------|---------|-------------|
| Token Builder | `TokenBuilder` | `@/components/ui/tokens` |
| Token Palette | `TokenPalette` | `@/components/ui/tokens` |
| Token Badge | `TokenBadge` | `@/components/ui/tokens` |

### DEPRECATED (Never Use)
| Deprecated | Use Instead |
|------------|-------------|
| `combobox.tsx` | `ComboboxDropdown` |
| `loader.tsx` | `Spinner` |
| `drawer.tsx` | `Sheet` |
| `collapsible.tsx` | `Accordion` |
| `data-table.tsx` | `TeeemTableView` |
| `PositionBadge` | `ItemBadge` |

### Adding New Standard Components
Tell Claude: **"Add [ComponentName] as a standard component"**

Claude will:
1. Check if it exists in `/components/ui/`
2. Verify no duplicates (SSoT check)
3. Add to `component-registry.ts`
4. Create demo in playground
5. Update this table

**Migration Policy:** "Fix it when you touch it" - When editing a file that uses a deprecated component, update the import to THE ONE.

## 🔴 CRITICAL: Table Page Pattern (SSoT)

**ALL pages that display a table MUST use this exact structure:**

```tsx
return (
  <div className="flex flex-col h-full -mx-4">
    <TeeemTableView
      entries={records}
      // ❌ NEVER pass columns - TeeemTableView auto-fetches from Foundation API
      foundationId="slug"
      foundationIdNumeric={id}
      tableName="Page Title"
      onRefresh={refresh}
      onRowUpdate={handleRowUpdate}
      leftActions={<Button>Action</Button>}
      enableExport={true}
    />
  </div>
);
```

**Rules:**
- ❌ **NEVER pass `columns` prop** - TeeemTableView auto-fetches columns from Foundation API (SSoT)
- ❌ **NO custom `<h1>` headers** - TeeemTableView renders the header (title + count + totals)
- ❌ **NO duplicate headers** - If you see `<h1>` AND `<TeeemTableView>`, it's a violation
- ✅ **Action buttons go in `leftActions`** - Back buttons, Add buttons, toggles
- ✅ **Edge-to-edge layout** - Use `-mx-4` to break out of parent padding
- ✅ **Full height** - Use `h-full` and `flex flex-col` for proper height chain

**Reference Implementation:**
The Gold Standard Table (`admin/system → Gold Standard Table tab`) is THE canonical demo of TeeemTableView.
See `GoldStandardTab.tsx` lines 820-848 for the correct pattern.

**🔴 CRITICAL: "Gold Standard Table" = TeeemTableView**
When user says "Gold Standard Table" or "gold std table", they mean **TeeemTableView**.
- Gold Standard Table is a DEMO page showing TeeemTableView capabilities
- Changes should go to `TeeemTableView.tsx`, NOT `GoldStandardTab.tsx`
- GoldStandardTab is just a thin wrapper that passes `foundationIdNumeric={1}`
- The goal: fix TeeemTableView once → all tables benefit

**For pages with extra content (tabs, stats cards):**
```tsx
return (
  <div className="flex flex-col h-full -mx-4">
    {/* Stats cards ABOVE the table (optional) */}
    <div className="px-4 mb-4 shrink-0">
      <StatsCards />
    </div>

    {/* TeeemTableView handles EVERYTHING else */}
    <TeeemTableView ... />
  </div>
);
```

**SSoT Violation Check:**
If a page imports `TeeemTableView` AND has a custom `<h1>` header → **STOP and fix it**.

**Current compliant pages (19 total):**
- jobs, pricebook, [slug], contacts, estimates, purchase_orders, quote-requests
- task-templates, schedule-templates, price_histories, portal, documents
- whs/inductions, whs/inspections, whs/incidents
- corporate/assets, corporate/document-types, admin/users, financial/transactions

## 🔴 CRITICAL: Design System References

**Primary Sources for UI Design:**

| Resource | Location | Contains |
|----------|----------|----------|
| **Tailwind Config** | `frontend-next/tailwind.config.ts` | Colors, spacing, typography, theme |
| **Gold Standard Table** | `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` | Column types, validation rules |

**Template Sources (Decision Framework):**

1. **Tailwind UI** (Primary) - https://tailwindui.com
   - Use for: Core patterns (tables, forms, modals, navigation)
   - When: Standard CRUD, internal admin, dashboards

2. **Subframe** (Secondary) - https://subframe.com
   - Use for: Rapid prototyping, unique interactions
   - When: Tailwind UI doesn't have it, customer-facing pages

**Non-Negotiables:**
- Dark mode support on ALL components (`dark:` classes required)
- Responsive design (use Tailwind breakpoints: sm, md, lg, xl, 2xl)
- Accessibility (ARIA labels, keyboard navigation, focus states)
- Use config colors, not hex values (`text-indigo-600` not `text-[#4F46E5]`)

## 🔴 CRITICAL: Git Branch - Rob Works on Live

**Rob works directly on the `Live` branch.** No feature branches needed for Rob.

- ✅ Rob commits and pushes directly to `Live`
- ✅ Test locally or deploy to `teeemlive` (production) for testing
- ✅ Use `/l` command to deploy Live branch to production
- Other developers (jake, etc.) should still use feature branches

## 🔴 Heroku Apps

**Available Heroku apps:**
- `teeemlive` - Production
- `teeem-rob-dev` - Rob's dev environment
- `teeem-sam-dev` - Sam's dev environment

## 🔴 Microsoft 365 Integration (SSoT: MicrosoftCredential)

**Single Source of Truth:** `MicrosoftCredential` model

### Architecture

```
MicrosoftCredential (unified model)
├── credential_type: 'app' | 'delegated'
├── owner_type/owner_id: polymorphic (User, Organization, etc.)
├── Encrypted: access_token, refresh_token, client_secret
├── Status: pending | connected | error | dead | disconnected
└── SharePoint/OneDrive config fields
```

### Credential Types

| Type | Flow | Use Case |
|------|------|----------|
| `app` | Client Credentials | Org-level email sync, SharePoint (no user interaction) |
| `delegated` | OAuth Authorization Code | User-specific access (requires user consent) |

### Common Operations

```ruby
# SSoT - Use MicrosoftCredential
MicrosoftCredential.active.app_credentials.connected  # Org app credentials
MicrosoftCredential.active.delegated_credentials      # User OAuth credentials
MicrosoftCredential.for_user(user)                    # Get user's credential

# Create Graph API clients (auto-fallback to legacy during migration)
client = MicrosoftAppGraphClient.for_org('OrgName')   # App permissions
client = MicrosoftGraphClient.for_user(user)          # Delegated permissions
```

### Migration Status (Dual-Write Active)

OAuth callbacks write to BOTH old and new tables. Graph clients try new table first, fall back to legacy.

**Legacy Models (DEPRECATED - do not use in new code):**
- `OrganizationMicrosoftAppCredential` → use `MicrosoftCredential.app_credentials`
- `OrganizationOneDriveCredential` → use `MicrosoftCredential.delegated_credentials`
- `UserMicrosoftToken` → use `MicrosoftCredential.for_user(user)`

### Naming Policy

| Context | Term |
|---------|------|
| Code/Models | `MicrosoftCredential`, `MicrosoftGraphClient` |
| Database | `microsoft_credentials`, `sharepoint_site_id` |
| UI/User Messages | "SharePoint" (never "OneDrive" to users) |
| Error Messages | "Please reconnect SharePoint in Admin > System > Connections" |

### Dead Token Detection

Graph clients detect permanent auth failures (AADSTS65001, AADSTS70000, etc.) and mark credentials as `dead`. Dead credentials require user to re-authenticate via OAuth.

### 🔴 CRITICAL: Organization Isolation (SSoT)

**Multi-org credential isolation is enforced via `organization_id` foreign key.**

**NEVER use these patterns:**
```ruby
# ❌ DANGEROUS - Returns ANY credential without org context
OrganizationMicrosoftAppCredential.active_credential
MicrosoftCredential.active.first
MicrosoftCredential.connected.first
```

**ALWAYS use org-scoped lookups:**
```ruby
# ✅ CORRECT - Org-scoped credential lookup
MicrosoftCredential.active_for_org(organization)
OrganizationMicrosoftAppCredential.active_for_org(organization)
MicrosoftAppGraphClient.for_org(organization)
OrgEmailSyncJob.perform_now('incremental', organization_id: org.id)
```

**In controllers, use the helper method:**
```ruby
credential = find_credential_with_org_context  # Reads org from params
```

**Why this matters:** Without org isolation, credentials from different organizations can be mixed, causing users to see each other's emails and data.

## 🔴 Xero Integration (SSoT: Live Webhooks)

**Single Source of Truth:** Xero Webhooks (configured 2025-12-18)

### Architecture - LIVE SYNC

```
Xero Cloud
    │
    ├──► Webhooks (LIVE - immediate)
    │    POST /api/v1/xero/webhooks
    │    Handles: Contacts, Invoices, Billing subscriptions
    │
    └──► Scheduled Jobs (BACKUP ONLY)
         - xero_health_monitor: every 2 hours (catches webhook failures)
         - xero_bank_transaction_sync: every 6 hours (no webhook available)
```

### SSoT Rules

| What | THE ONE Way | Never Do |
|------|-------------|----------|
| Contact/Invoice sync | Webhooks (live) | Scheduled jobs |
| Xero links | `contact_external_links.sync_enabled = true` | Disabled links |
| Link count cache | `contacts.xero_linked_count` | Calculate on-the-fly |

### Webhook Configuration

- **URL:** `https://teeemlive-ce8e2660a615.herokuapp.com/api/v1/xero/webhooks`
- **Key:** `XERO_WEBHOOK_KEY` env var
- **Controller:** `Api::V1::XeroWebhooksController`
- **Events:** CONTACT (create/update/delete), INVOICE (create/update), PAYMENT (create/update)

### Key Files

| File | Purpose |
|------|---------|
| `app/controllers/api/v1/xero_webhooks_controller.rb` | Receives webhook events |
| `config/recurring.yml` | Scheduled jobs (backup only) |
| `app/models/contact_external_link.rb` | Xero link storage |
| `app/services/xero_contact_sync_service.rb` | Sync logic |

### NEVER Add Scheduled Xero Sync Jobs

Webhooks are THE SSoT for Xero sync. If you think you need a scheduled job:
1. Check if webhooks handle it (they should)
2. If webhooks are failing → fix the webhook, don't add a scheduled job
3. Only `xero_bank_transaction_sync` is allowed (no webhook available for bank data)

### Related Services

- `MicrosoftGraphBase` - Shared base class with retry logic, dead token detection
- `MicrosoftAppGraphClient` - App permissions (org-level)
- `MicrosoftGraphClient` - Delegated permissions (user-level)
- `OrgEmailSyncJob` - Syncs emails from Microsoft 365

## 🔴 SharePoint Document Paths (SSoT: CorporateCompanySetting)

**Single Source of Truth:** `CorporateCompanySetting` model (Admin > System > Company > SharePoint tab)

### Path Configuration

All SharePoint document paths are centralized in `CorporateCompanySetting`:

```ruby
# Get full path for a document scope
CorporateCompanySetting.sharepoint_full_path(:jobs)     # "/Shared Documents/TEEEM Jobs"
CorporateCompanySetting.sharepoint_full_path(:people)   # "/Shared Documents/Corporate/People"
CorporateCompanySetting.sharepoint_full_path(:company)  # "/Shared Documents/00 TEEEM PRIVATE"
CorporateCompanySetting.sharepoint_full_path(:contacts) # "/Shared Documents/Contacts"

# Check if SharePoint is configured
CorporateCompanySetting.sharepoint_configured?

# Get full config hash
CorporateCompanySetting.sharepoint_config
```

### Database Fields

| Field | Default | Purpose |
|-------|---------|---------|
| `sharepoint_root_path` | `/Shared Documents` | Base path for all documents |
| `sharepoint_jobs_path` | `TEEEM Jobs` | Job documents (relative to root) |
| `sharepoint_people_path` | `Corporate/People` | People documents |
| `sharepoint_company_path` | `00 TEEEM PRIVATE` | Company documents |
| `sharepoint_contacts_path` | `Contacts` | Contact documents |

### Usage in Services

**ALWAYS use `CorporateCompanySetting.sharepoint_full_path(:scope)` instead of hardcoded paths:**

```ruby
# ✅ CORRECT - Uses SSoT
path = CorporateCompanySetting.sharepoint_full_path(:jobs)

# ❌ WRONG - Hardcoded path
path = "/Shared Documents/TEEEM Jobs"
```

## 🔴 Local Development

**When starting local servers, use these ports:**

- **Frontend:** Port 3000 (`npm run dev` or `PORT=3000 npm run dev`)
- **Backend:** Port 3001 (`bin/rails server -p 3001`)

**Start commands:**
```bash
# Start backend on port 3001
cd backend && bin/rails server -p 3001

# Start frontend (Next.js) on port 3000
cd frontend-next && npm run dev
```

**Local URLs:**
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

---

## 🔴 Production Deployment

**Deploy to production (`teeemlive`) using the `/l` command (RECOMMENDED):**

```bash
# THE SSoT - Use /l command
/l
```

**Manual deploy (only if /l unavailable) - Fast Orphan Method:**

```bash
# ULTRA-FAST DEPLOY (~5 seconds, no memory issues)
# Avoids slow git subtree split entirely
cd /Users/robertharder/GitHub/teeem
DEPLOY_DIR=$(mktemp -d)
cp -r backend/* "$DEPLOY_DIR/"
cd "$DEPLOY_DIR"
git init && git add . && git commit -m "Deploy $(date +%Y%m%d-%H%M%S)"
git remote add heroku https://git.heroku.com/teeemlive.git
git push heroku HEAD:main --force
cd /Users/robertharder/GitHub/teeem && rm -rf "$DEPLOY_DIR"
```

**Why this method:**
- O(1) time - no git history processing
- No memory issues regardless of repo size
- 5 seconds vs 2+ minutes with git subtree
- Heroku doesn't need history anyway

### Heroku Environments

| Environment | Heroku App | Branch | Frontend |
|-------------|-----------|--------|----------|
| **Production** | `teeemlive` | Live | https://teeemlive.vercel.app |
| **Rob Dev** | `teeem-rob-dev` | Live | - |
| **Sam Dev** | `teeem-sam-dev` | - | - |

**Production URLs:**
- Backend: https://teeemlive-ce8e2660a615.herokuapp.com/ (Heroku app: `teeemlive`)
- Frontend: https://teeemlive.vercel.app/

**NOTE:** The random hash in the Heroku URL (`ce8e2660a615`) is auto-generated by Heroku. Always use `--app teeemlive` for Heroku commands.

---

## 🔴 CRITICAL: API Response Format

**All API responses MUST use this format:**

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "Error message here" }
```

**NEVER:**
- Return data without the `success` wrapper
- Use different error formats across endpoints

---

## 🔴 CRITICAL: Timezone Handling

**Company timezone: Australia/Brisbane**

**Backend (Ruby):**
```ruby
# ALWAYS use CompanySetting timezone methods
CompanySetting.in_company_timezone { Date.today }
CompanySetting.company_time_now

# NEVER use these without timezone context
Date.today        # ❌ Wrong - uses server timezone
Time.now          # ❌ Wrong - uses server timezone
```

**Frontend (TypeScript):**
```typescript
// Display dates in Brisbane timezone
// Store dates in UTC, display in local
```

---

## 🎯 Gold Standard Table - Column Types SSoT

**TEEEM_DOCS/GOLD_STANDARD_TABLE.md is THE SINGLE SOURCE OF TRUTH for all table and column behavior.**

**The Hierarchy:**
```
TEEEM_DOCS/GOLD_STANDARD_TABLE.md (SSoT - THE SPEC)
    │
    │ Defines: All 31 column types, validation rules, SQL types
    │
    ├──► Backend code must match this
    ├──► Frontend code must match this
    └──► Gold Standard Table (ID: 1) demonstrates this
```

**Code Locations (must match the MD):**
- `backend/app/models/column.rb` → COLUMN_SQL_TYPE_MAP
- `frontend-next/components/table/TeeemTableView.tsx`
- `frontend-next/lib/column-types.ts`

---

## 🔴 CRITICAL: No Column Limiting Policy

**ALL API endpoints MUST return ALL columns. NEVER limit columns in responses.**

**Rationale:**
- Column limiting breaks features (cascading filters, column selection, associations)
- Performance is achieved through eager loading and pagination, NOT column limiting
- Frontend needs flexibility to access all data without backend changes

**FORBIDDEN Patterns:**
- ❌ `.select(:id, :name)` in controllers
- ❌ `params[:fields] == "minimal"`
- ❌ `as_json(only: [...])` for associations
- ❌ `.pluck()` for API responses (use for internal queries only)

**ALLOWED for Performance:**
- ✅ `.includes()` / `.preload()` for eager loading
- ✅ `paginate()` / `.limit()` for pagination
- ✅ Database indexes
- ✅ SQL-level optimizations (EXPLAIN ANALYZE)

**Why This Matters:**
The Foundation API previously implemented `fields=minimal` but removed it because it broke:
1. Cascading filters
2. Column selection features
3. Dynamic association loading

Performance MUST be achieved through proper database design and eager loading, not by crippling API responses.

---

## 🐛 Token-Efficient Debugging Workflow

**CRITICAL:** Raw log files are extremely verbose and waste tokens. ALWAYS use this hierarchy:

### Debugging Priority (Most → Least Token-Efficient)

#### **1. Sentry API (BEST - ~200-500 tokens per error)**
```bash
# Query recent issues
GET https://sentry.io/api/0/projects/{org}/{project}/issues/

# Get specific issue details with full context
GET https://sentry.io/api/0/issues/{issue_id}/
```

**Why Sentry First:**
- Structured JSON data
- Full error context (user, environment, breadcrumbs)
- Stack trace already parsed
- Error grouping and frequency
- Session replay available (frontend)

**When to use:**
- Investigating production errors
- Understanding error patterns
- Getting user context
- Checking error frequency

#### **2. Frontend Console Capture (~100-300 tokens)**
**Location:** `/Users/jakebaird/teeem/frontend/src/utils/consoleCapture.js`

**Features:**
- Already capturing last 1,000 log entries in memory
- Timestamp + type + message format
- Clipboard export functionality
- Active in dev/staging only

**How to use:**
```javascript
// In browser DevTools console:
window.exportLogs() // Copies logs to clipboard

// Filter to errors only:
window.consoleHistory.filter(entry => entry.type === 'error')
```

**When to use:**
- Frontend debugging in dev/staging
- User-reported bugs with console export
- React component errors
- API call failures

#### **3. Intelligent Log Sampling (~100-300 tokens)**
**NEVER read entire log files.** Use these patterns:

**Backend Error Investigation:**
```bash
# Tail last 50 lines around error
tail -n 50 backend/log/development.log

# Grep for specific error pattern
grep -A 10 -B 5 "ERROR_PATTERN" backend/log/development.log | tail -n 50

# Find errors only (exclude SQL noise)
grep "ERROR" backend/log/development.log | grep -v "SELECT\|INSERT\|UPDATE" | tail -n 20
```

**When to use:**
- Local development errors
- Errors not yet in Sentry
- Database migration issues
- Debugging specific request flow

### ❌ What NOT to Do

**NEVER:**
- Read entire log files (1.6MB = ~40,000 tokens wasted)
- Include SQL queries in log context
- Read middleware stack traces
- Parse Rails framework internals
- Read duplicate logs (root + backend have same content)

**ALWAYS:**
- Check Sentry first
- Use grep with line limits
- Filter out framework noise
- Focus on application code stack traces only

### 🔍 Error Investigation Workflow

**Step 1: Identify Error Source**
- Frontend error? → Check console capture or Sentry frontend project
- Backend error? → Check Sentry backend project first
- Local development? → Use intelligent log sampling

**Step 2: Gather Minimal Context**
- Error message (what went wrong)
- Stack trace (first 3-5 lines from app code only)
- Request context (endpoint, user_id, params)
- Reproduction steps

**Step 3: Fix**
- Implement fix
- Test thoroughly

### 📊 Token Savings Examples

**Scenario: Investigating 500 error on /api/v1/constructions**

**❌ Old Way (WRONG):**
- Read entire development.log (40,000 tokens)
- Parse SQL queries (5,000 tokens)
- Read middleware traces (2,000 tokens)
- **Total: ~47,000 tokens wasted**

**✅ New Way (CORRECT):**
- Query Sentry API for recent 500 errors (200 tokens)
- Get structured error with context (300 tokens)
- **Total: ~500 tokens (99% savings)**

### 🎓 Best Practices for Developers

**When Reporting Bugs:**
1. Export console logs (frontend) or copy Sentry URL
2. Provide reproduction steps
3. Include error message (not full stack trace)
4. Note user impact and frequency

**When Debugging:**
1. Reproduce error locally if possible
2. Check Sentry for production occurrence
3. Use browser DevTools (frontend) or `grep` (backend)
4. Focus on first error in chain (not cascading errors)

**When Logging:**
1. Use structured formats (see ErrorLogger utility)
2. Include minimal context (user_id, endpoint, action)
3. Filter sensitive data (passwords, tokens, API keys)
4. Categorize errors (validation, not_found, server_error, external_api)

### 🛠️ Available Debugging Tools

**Frontend:**
- Console capture system (built-in)
- React Error Boundaries
- Sentry session replay
- Browser DevTools

**Backend:**
- Sentry error tracking
- Rails logs (use intelligently)
- ApplicationController error handlers
- Database query logs (development only)

**Both:**
- Sentry breadcrumbs (user actions leading to error)
- Environment context (dev/staging/production)
- Request IDs for tracing across systems
