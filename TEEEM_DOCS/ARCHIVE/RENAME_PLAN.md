# TEEEM → TEEEM Rename Plan

## Overview

Rename the application from "TEEEM" to "TEEEM" across all layers of the application.

**Naming Convention:**
- TEEEM (all caps) - everywhere including UI, constants, folder names, user-facing text
- teeem (lowercase) - URLs, database names, file names where lowercase is standard

---

## Phase 1: Database Migrations (Backend)

**Priority: CRITICAL - Must be done first with coordination**

### 1.1 Create Migration for Column Renames

```bash
bin/rails generate migration RenameTEEEMColumnsToTeeem
```

Columns to rename:
- `contacts.teeem_rating` → `contacts.teeem_rating`
- `feature_trackers.teeem_has` → `feature_trackers.teeem_has`

```ruby
# Migration content
class RenameTEEEMColumnsToTeeem < ActiveRecord::Migration[7.0]
  def change
    rename_column :contacts, :teeem_rating, :teeem_rating
    rename_column :feature_trackers, :teeem_has, :teeem_has

    # Rename index
    rename_index :contacts, 'index_contacts_on_teeem_rating', 'index_contacts_on_teeem_rating'
  end
end
```

### 1.2 Update Model References

Files to update:
- `backend/app/models/contact.rb` - references to teeem_rating
- `backend/app/models/supplier_rating.rb` - any teeem references
- `backend/app/controllers/api/v1/feature_trackers_controller.rb` - teeem_has references

---

## Phase 2: External Services Rename

**Priority: HIGH - Requires account access and coordination**

### 2.1 Heroku

1. Rename Heroku app: `teeem-backend` → `teeem-backend`
   ```bash
   heroku apps:rename teeem-backend --app teeem-backend
   ```
   Note: This changes the URL to `teeem-backend-xxx.herokuapp.com`

2. Update all URL references in:
   - `.github/workflows/deploy-backend-production.yml`
   - `.github/workflows/deploy-backend-staging.yml`
   - `.env.production`
   - `frontend/.env.example`
   - Documentation files

### 2.2 GitHub Repository

1. Rename repo: `gotekna/teeem` → `gotekna/teeem`
   - Go to Settings → General → Repository name
   - Update all `origin` remotes locally

2. Update git remotes:
   ```bash
   git remote set-url origin https://github.com/gotekna/teeem.git
   ```

### 2.3 Vercel (Frontend)

1. Rename project in Vercel dashboard
2. Update domain if applicable
3. Update environment variables

---

## Phase 3: Folder & File Renames

### 3.1 Documentation Folder

```bash
git mv TEEEM_DOCS TEEEM_DOCS
```

Files to rename inside:
- `TEEEM_DOCS/TEEEM_BIBLE.md` → `TEEEM_DOCS/TEEEM_BIBLE.md`
- `TEEEM_DOCS/TEEEM_LEXICON.md` → `TEEEM_DOCS/TEEEM_LEXICON.md`
- `TEEEM_DOCS/TEEEM_TEACHER.md` → `TEEEM_DOCS/TEEEM_TEACHER.md`
- `TEEEM_DOCS/TEEEM_USER_MANUAL.md` → `TEEEM_DOCS/TEEEM_USER_MANUAL.md`
- `TEEEM_DOCS/TEEEM_BIBLE.md.bak` → delete or rename

### 3.2 Root-Level Marketing Files

```bash
git mv TEEEM_EXECUTIVE_SUMMARY.md TEEEM_EXECUTIVE_SUMMARY.md
git mv TEEEM_FEATURES_LIST.md TEEEM_FEATURES_LIST.md
git mv TEEEM_MARKETING_BROCHURE.md TEEEM_MARKETING_BROCHURE.md
git mv TEEEM_SALES_DOCUMENT.md TEEEM_SALES_DOCUMENT.md
```

### 3.3 Script Files

```bash
git mv start_teeem_servers.sh start_teeem_servers.sh
git mv stop_teeem_servers.sh stop_teeem_servers.sh
```

### 3.4 Component Files

```bash
git mv frontend/src/components/documentation/TEEEMTableView.jsx frontend/src/components/documentation/TeeemTableView.jsx
```

### 3.5 Agent Files

```bash
git mv .claude/agents/teeem-table-architect.md .claude/agents/teeem-table-architect.md
```

### 3.6 Backend Migration Files (Keep as-is)

Migration files like `20251120221852_add_teeem_has_to_feature_trackers.rb` should NOT be renamed (they are historical records).

---

## Phase 4: Code Content Updates

### 4.1 Frontend Updates (~35 files)

**Package files:**
- `frontend/package.json`: `"name": "teeem-frontend"` → `"name": "teeem-frontend"`

**HTML/PWA:**
- `frontend/index.html`: Title "TEEEM" → "TEEEM"
- `frontend/public/manifest.json`: "TEEEM Field" → "TEEEM Field"

**Component imports after file rename:**
- All files importing `TEEEMTableView` → `TeeemTableView`

**User-facing strings:**
- Page titles, welcome messages, email subjects
- Portal login pages
- Dashboard headers

### 4.2 Backend Updates (~84 files)

**Package/Config:**
- `backend/package.json` (if name exists)
- `backend/config/database.yml`: database names
- `backend/config/initializers/cors.rb`: allowed origins

**Rake Tasks:**
- `backend/lib/tasks/*.rake`: namespace `teeem:` → `teeem:`
- `package.json` root: `teeem:agents:sync` → `teeem:agents:sync`

**Services/Jobs:**
- Email content in mailers
- Job descriptions
- API response messages

**Controllers:**
- Documentation references
- Trinity content

### 4.3 Environment Files

**.env.example files:**
- Comments mentioning "TEEEM"
- Database URLs: `teeem_development` → `teeem_development`
- Production URLs (after Heroku rename)

### 4.4 Documentation Content (~200+ files)

All markdown files need content updates:
- CLAUDE.md references
- README files
- Agent definitions
- Implementation guides

---

## Phase 5: CI/CD & Deployment Config

### 5.1 GitHub Actions

Update workflow files:
- `.github/workflows/deploy-backend-production.yml`
- `.github/workflows/deploy-backend-staging.yml`
- `.github/workflows/deploy-frontend.yml`
- `.github/workflows/deploy-staging.yml`

Changes needed:
- Heroku app names
- URLs in echo statements
- Environment variable names if any

### 5.2 Heroku Config Files

- `app.json` (root and backend)
- Any Procfile references

---

## Phase 6: Claude Configuration

### 6.1 CLAUDE.md

- `.claude/CLAUDE.md`: All API URLs, instructions
- Update Trinity API base URL after Heroku rename

### 6.2 Agent Definitions

- `.claude/agents/*.md`: All references
- `.claude/settings.json`: Agent names
- `db/seeds/agent_definitions.rb`: Agent metadata

### 6.3 Slash Commands

- `.claude/commands/*.md`: Any teeem references

---

## Phase 7: Database Content Updates

**Run after migrations, via Rails console or rake task:**

Update Trinity documentation entries in database:
- `DocumentationEntry` table: content containing "TEEEM"
- `Rule` table: rule content
- `AgentDefinition` table: agent descriptions

```ruby
# Example rake task
namespace :teeem do
  task rename_content: :environment do
    DocumentationEntry.find_each do |entry|
      entry.update(
        content: entry.content.gsub(/TEEEM/i) { |m| m == 'TEEEM' ? 'TEEEM' : 'TEEEM' },
        title: entry.title.gsub(/TEEEM/i, 'TEEEM')
      )
    end
  end
end
```

---

## Execution Order

### Pre-Deployment (Local Development)

1. **Phase 1**: Create and test migration locally
2. **Phase 3**: Rename folders and files (git mv)
3. **Phase 4**: Update code content (find/replace with review)
4. **Phase 6**: Update Claude configuration

### Deployment Day (Coordinated)

1. **Announce maintenance window**
2. **Phase 2.1**: Rename Heroku app
3. **Phase 5**: Update CI/CD with new URLs
4. Deploy backend (runs migration)
5. **Phase 2.3**: Update Vercel
6. Deploy frontend
7. **Phase 7**: Run database content updates
8. **Phase 2.2**: Rename GitHub repo (last, to avoid broken links during deployment)

---

## Search Patterns for Find/Replace

Execute in order:

```bash
# Pattern 1: TEEEM (all caps) → TEEEM
# Use for: Constants, folder names, documentation headers

# Pattern 2: TEEEM (title case) → TEEEM
# Use for: User-facing text, titles, component names

# Pattern 3: teeem (lowercase) → teeem
# Use for: URLs, database names, file paths, variable names

# Pattern 4: teeem- (with hyphen) → teeem-
# Use for: Package names, app names, database names
```

---

## Rollback Plan

1. Keep database migration reversible
2. Don't delete old Heroku app immediately (use `heroku apps:rename`)
3. Keep git history of renames
4. Document all external service changes

---

## Files Summary

| Category | Estimated Files | Priority |
|----------|-----------------|----------|
| Database migrations | 1 new | CRITICAL |
| Backend Ruby files | ~84 | HIGH |
| Frontend JSX/JS files | ~35 | HIGH |
| Markdown documentation | ~200+ | MEDIUM |
| Config/env files | ~20 | HIGH |
| CI/CD workflows | ~5 | HIGH |
| Claude agents/commands | ~15 | MEDIUM |

**Total estimated: ~360 files to modify**

---

## Notes

- Test thoroughly in development before production
- Coordinate with team on deployment timing
- Update any external integrations (Xero app name, OneDrive app name, etc.)
- Update Sentry project names if applicable
- Check for hardcoded URLs in any third-party services
