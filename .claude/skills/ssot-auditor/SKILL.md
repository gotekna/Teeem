---
name: ssot-auditor
description: Detects duplicate implementations and SSoT violations. Use before any code change that adds new logic, config, or constants.
---

# SSoT Auditor

## When Claude Should Use This
- Adding a new constant or config value
- Implementing business logic
- Creating a new component or service
- Adding environment variables
- Defining routes or endpoints

## Process

### Step 1: Search for Existing Implementations
```bash
# Search both frontend and backend
grep -ri "SEARCH_TERM" backend/ frontend-next/ --include="*.rb" --include="*.ts" --include="*.tsx" --include="*.yml" --include="*.json" | grep -v node_modules | head -20
```

### Step 2: If Found in Multiple Places
1. List all locations with file:line
2. Show the user both implementations
3. Ask: "Which is the source of truth?"
4. Wait for user response
5. Consolidate to one location after user confirms

### Step 3: If Not Found
- Proceed with implementation
- Add comment noting this is the SSoT location

## Red Flags to Watch For
- Same constant defined in multiple files
- Same validation logic in frontend AND backend (pick one)
- Config in both `.env` and `config/*.yml`
- Two services doing the same transformation
- Duplicate route definitions
- Same helper method in multiple places

## Example SSoT Violation Report
```
SSoT VIOLATION FOUND

I found `DEFAULT_PAGE_SIZE` defined in two places:

1. backend/app/controllers/application_controller.rb:15
   DEFAULT_PAGE_SIZE = 25

2. frontend-next/lib/constants.ts:8
   export const DEFAULT_PAGE_SIZE = 25

Which should be the single source of truth?
Options:
A) Backend (frontend fetches from API)
B) Frontend (backend uses param or defaults)
C) Shared config file

Want me to consolidate after you decide?
```

## Common SSoT Locations in TEEEM

| Thing | SSoT Location |
|-------|---------------|
| Column types | `TEEEM_DOCS/GOLD_STANDARD_TABLE.md` |
| UI components | `TEEEM_DOCS/COMPONENTS.md` |
| API format | Backend controllers |
| Validation rules | Backend models |
| Timezone | `CompanySetting` |
