# Claude Code Instructions for TEEEM Project

## 🔴 CRITICAL: Git Commit, Push, and Deploy Rules

**NEVER commit, push, or deploy unless the user explicitly asks.**

- ❌ NEVER run `git commit`, `git push`, or deploy unless user explicitly requests
- ✅ Make code changes and let the user test first
- ✅ Only act when user says: "commit", "push", "deploy", "ship it", "/l", etc.

### Push Override Password
If pre-push hook blocks, ask for password. If user says `1234`, use `--no-verify`:
```bash
git push origin Live --no-verify
```

### After Deploy, Show:
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

## 🔴 CRITICAL: Quality Triggers (Correction Keywords)

| Keyword | What Claude Missed | Action |
|---------|-------------------|--------|
| `ssot` | Duplicate logic/config | Find both, flag to user, ask which is SSoT |
| `ultra` | Lazy thinking | Present 3 approaches, question assumptions, simplify |
| `gold` | Wrong component/UI | Check component registry, TeeemTableView, Tailwind, dark mode |

**Before ANY code change:**
1. **SSoT Check** - Is this defined elsewhere? Search first.
2. **Ultra Think** (non-trivial) - 3 approaches? Assumptions? Remove instead of add?
3. **Gold Standard** (UI work) - Using THE ONE component? Tailwind config? Dark mode?

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

---

## 🔴 SSoT (Single Source of Truth) - Master Reference

**If you find multiple ways to do the same thing, STOP and alert the user.**

### SSoT Violation Response
1. ⚠️ IMMEDIATELY STOP
2. Document ALL locations (file paths, line numbers)
3. Present 3 masterpiece solutions with effort/impact
4. NO BANDAIDS - fix root cause
5. After user picks: implement THE ONE, delete ALL duplicates

### SSoT Domain Reference

| Domain | THE ONE Source | Never Do |
|--------|---------------|----------|
| **Record Queries** | Foundation API (`/api/v1/foundations/{slug}/records`) | Custom `*_json` methods, manual lookup expansion |
| **Backend Constants** | Define in ONE model, reference via `Model::CONSTANT` | Duplicate across models |
| **Frontend Constants** | `lib/constants/*.ts` files | Hardcode arrays that mirror backend |
| **UI Components** | `lib/component-registry.ts` | Create duplicates (see Gold Standard below) |
| **Tables** | `TeeemTableView` with `autoFetchRecords` | Custom tables, pass `columns` prop |
| **Column Types** | `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` | Different definitions in code |
| **Microsoft Creds** | `MicrosoftCredential` model | Legacy models (`OrganizationMicrosoftAppCredential`, etc.) |
| **Xero Sync** | Webhooks (live) | Scheduled sync jobs |
| **Storage Config** | `StorageConfiguration.instance` | Hardcoded paths or provider-specific code |
| **Timezones** | `CompanySetting.in_company_timezone {}` | Raw `Date.today` or `Time.now` |

### Frontend SSoT Constant Files
| Type | File |
|------|------|
| System columns | `lib/constants/system-columns.ts` |
| Document types | `lib/constants/document-types.ts` |
| Column types | `column_type_definitions` DB table (via `lib/column-type-registry.ts`) |
| UI components | `lib/component-registry.ts` |

**Before creating ANY `const`:** `grep -r "CONSTANT_NAME" lib/constants/`

---

## 🔴 Foundation API & TeeemTableView (THE Pattern)

**ALL tables use TeeemTableView with Foundation API. No exceptions.**

### The Pattern
```tsx
<TeeemTableView
  foundationId="slug_name"        // ✅ Use slug, NEVER numeric ID
  autoFetchRecords={true}
  initialFilters={[...]}          // Optional
  leftActions={<Button>Add</Button>}
  onRefresh={() => refresh()}
/>
```

### Rules
- ❌ NEVER pass `columns` prop (auto-fetched from Foundation API)
- ❌ NEVER use `foundationIdNumeric` (IDs differ per environment)
- ❌ NO custom `<h1>` headers (TeeemTableView renders header)
- ✅ Use `-mx-4` wrapper for edge-to-edge layout
- ✅ Use `h-full flex flex-col` for proper height

### Page Structure
```tsx
return (
  <div className="flex flex-col h-full -mx-4">
    <TeeemTableView foundationId="slug" autoFetchRecords={true} ... />
  </div>
);
```

**"Gold Standard Table" = TeeemTableView demo at `/admin/system?tab=gold-standard`**

---

## 🔴 Standard UI Components (SSoT)

**THE SOURCE:** `frontend-next/lib/component-registry.ts`
**Visual reference:** `/admin/system?tab=components`

### Quick Reference (Key Components)

| Need | THE ONE | Import |
|------|---------|--------|
| Button | `Button` | `@/components/ui/button` |
| Modal | `Dialog` | `@/components/ui/dialog` |
| Dropdown | `Select` / `ComboboxDropdown` | `@/components/ui/select` or `combobox-dropdown` |
| Data Table | `TeeemTableView` | `@/components/table/TeeemTableView` |
| Back Nav | `BackButton` | `@/components/ui/back-button` |
| Side Panel | `Sheet` | `@/components/ui/sheet` |
| Loading | `Spinner` | `@/components/ui/spinner` |

### Deprecated (Never Use)
| ❌ Deprecated | ✅ Use Instead |
|--------------|----------------|
| `combobox.tsx` | `ComboboxDropdown` |
| `loader.tsx` | `Spinner` |
| `drawer.tsx` | `Sheet` |
| `data-table.tsx` | `TeeemTableView` |
| `router.back()` | `BackButton` |

**Full list:** See `lib/component-registry.ts` (39 components)

---

## 🔴 Design System

| Resource | Location |
|----------|----------|
| Tailwind Config | `frontend-next/tailwind.config.ts` |
| Column Types | `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` |

**Non-Negotiables:**
- Dark mode (`dark:` classes) on ALL components
- Responsive design (Tailwind breakpoints)
- Config colors, not hex values (`text-indigo-600` not `#4F46E5`)

---

## 🔴 Environments & Deployment

### Heroku Apps
| Environment | App | Branch | URLs |
|-------------|-----|--------|------|
| **Production** | `teeemlive` | Live | Backend: `teeemlive-ce8e2660a615.herokuapp.com`, Frontend: `teeem.vercel.app` |
| **Rob Dev** | `teeem-rob-dev` | Live | - |
| **Sam Dev** | `teeem-sam-dev` | - | - |

### Local Development
- **Frontend:** `cd frontend-next && npm run dev` (port 3000)
- **Backend:** `cd backend && bin/rails server -p 3001` (port 3001)

### Deploy to Production
```bash
/l   # THE SSoT - use this command
```

**Rob works directly on `Live` branch.** No feature branches needed.

---

## 🔴 API Standards

### Response Format
```json
{ "success": true, "data": { ... } }
{ "success": false, "error": "Message" }
```

### No Column Limiting
- ❌ NEVER use `.select(:id, :name)` or `fields=minimal`
- ✅ Use `.includes()` / `.preload()` for performance

---

## 🔴 Integration SSoT Details

### Microsoft 365
```ruby
# SSoT - Use MicrosoftCredential (not legacy models)
MicrosoftCredential.active_for_org(organization)  # ✅ Org-scoped
MicrosoftCredential.active.first                  # ❌ DANGEROUS - no org context
```

### Xero
- **SSoT:** Webhooks at `/api/v1/xero/webhooks`
- **NEVER** add scheduled Xero sync jobs (webhooks handle it)

### Document Storage (StorageConfiguration SSoT)
```ruby
# Check current provider first
StorageConfiguration.instance.provider_type  # → s3_compatible | sharepoint | local

# Use SSoT for all paths
StorageConfiguration.instance.resolve_path(:job, JobCode: "J-001")  # ✅ SSoT
"/Jobs/J-001"  # ❌ Hardcoded (path format varies by provider)
```
**CRITICAL:** Frontend NEVER handles paths - uses scopes, backend resolves.
**ALWAYS:** Check `provider_type` before assuming storage behavior.

---

## 🐛 Debugging (Token-Efficient)

**Priority order:**
1. **Sentry API** (~200-500 tokens) - Check first for production errors
2. **Console Capture** - `window.exportLogs()` in browser
3. **Intelligent Log Sampling** - `grep -A 10 "ERROR" log/development.log | tail -n 20`

**NEVER:** Read entire log files (wastes ~40,000 tokens)

---

## Quick Reference Commands

```bash
# Version checks
curl -s https://teeemlive-ce8e2660a615.herokuapp.com/version | jq -r '.version'
cat frontend-next/package.json | jq -r '.version'
heroku releases --app teeemlive -n 1

# Deploy
/l

# Local servers
cd backend && bin/rails server -p 3001
cd frontend-next && npm run dev
```
