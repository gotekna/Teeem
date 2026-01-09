# Contributing to TEEEM

This document outlines the development workflow and guidelines for contributing to TEEEM.

## Table of Contents
- [Development Workflow](#development-workflow)
- [Getting Started](#getting-started)
- [Branch Strategy](#branch-strategy)
- [Committing Changes](#committing-changes)
- [Pull Request Process](#pull-request-process)
- [Design Guidelines](#design-guidelines)
- [Deployment](#deployment)

---

## Development Workflow

TEEEM uses a feature branch workflow with PR reviews before merging to `main`.

### For Rob (Developer Branch)

Rob has a dedicated `rob` branch for development work. This workflow ensures:
- ✅ Rob can work independently without blocking production
- ✅ All changes are reviewed before merging to `main`
- ✅ UI/UX consistency is maintained
- ❌ No accidental production deployments

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/abodable-dev/teeem.git
cd teeem
```

### 2. Switch to Your Branch

```bash
# For Rob's development work
git checkout rob
git pull origin rob
```

### 3. Set Up Environment Variables

**Backend:**
```bash
cd backend
cp .env.example .env
# Ask Jake for actual credential values or check Heroku
```

**Frontend:**
```bash
cd frontend
cp .env.example .env
# Update VITE_API_URL if needed
```

**Pull Heroku Config (requires Heroku CLI access):**
```bash
heroku config -a teeemlive --shell > backend/.env
```

### 4. Install Dependencies

**Backend:**
```bash
cd backend
bundle install
bin/rails db:prepare
```

**Frontend:**
```bash
cd frontend
npm install
```

### 5. Start Development Servers

**Backend:**
```bash
cd backend
bin/rails server
# Runs on http://localhost:3000
```

**Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

---

## Branch Strategy

### Main Branch (`main`)
- **Purpose:** Production-ready code
- **Deployments:** All production deployments happen from `main`
- **Protection:** Requires PR approval before merging
- **Who can merge:** Jake (project owner)

### Development Branch (`rob`)
- **Purpose:** Rob's active development work
- **Workflow:**
  1. Pull latest changes from `main` regularly
  2. Make feature changes
  3. Commit and push to `rob` branch
  4. Create PR to merge into `main`
- **No deployments:** Changes in `rob` branch do NOT auto-deploy

### Feature Branches (optional)
For larger features, create a feature branch:
```bash
git checkout rob
git checkout -b rob/feature-name
# Work on feature
git push -u origin rob/feature-name
# Create PR to merge into rob, then rob → main
```

---

## Committing Changes

### Standard Git Workflow

```bash
# Check what changed
git status
git diff

# Stage changes
git add .
# Or stage specific files
git add path/to/file

# Commit with descriptive message
git commit -m "Add feature X to improve Y"

# Push to your branch
git push origin rob
```

### Commit Message Guidelines

Use clear, descriptive commit messages:

**Good:**
- ✅ `Fix active jobs table inline editing for profit columns`
- ✅ `Add contact type filtering with customer/supplier badges`
- ✅ `Refactor EstimateToPurchaseOrderService to handle categories`

**Bad:**
- ❌ `Fix bug`
- ❌ `Update code`
- ❌ `WIP`

---

## Pull Request Process

### 1. Create Pull Request

When your changes are ready for review:

```bash
# Make sure all changes are committed and pushed
git push origin rob

# Create PR via GitHub UI or using GitHub CLI
gh pr create --base main --head rob --title "Description of changes"
```

### 2. PR Review Checklist

Before creating a PR, ensure:

- [ ] **Code works locally** - Tested on localhost
- [ ] **No console errors** - Check browser console and server logs
- [ ] **Design guidelines followed** - See [Design Guidelines](#design-guidelines)
- [ ] **Database migrations run** - `bin/rails db:migrate` successful
- [ ] **Dependencies updated** - `bundle install` or `npm install` if needed
- [ ] **No secrets committed** - No API keys, passwords, or tokens in code

### 3. Automated Review

The deploy-manager agent will:
1. ✅ Review code for functionality issues
2. ✅ Check UI/UX compliance with design guidelines
3. ✅ Test database migrations
4. ⚠️ Flag any design inconsistencies

If UI/UX issues are found, the agent will:
- Suggest fixes to match existing design patterns
- Update code to follow TEEEM design guidelines
- Request changes before merging

### 4. Merge to Main

Once approved by Jake:
1. PR is merged to `main`
2. Automatic deployment triggers
3. Backend deploys to Heroku
4. Frontend deploys to Vercel (teeem.vercel.app)

---

## Design Guidelines

### Core Principles

**Consistency is key.** TEEEM uses a cohesive design system across all pages.

### Color Palette

**Primary Colors:**
- **Indigo:** `indigo-600` (buttons, links, accents)
- **Purple:** `purple-600` (gradients, highlights)

**Status Colors:**
- **Green:** `green-600` / `green-400` (positive, profit, success)
- **Red:** `red-600` / `red-400` (negative, loss, errors)
- **Blue:** `blue-600` / `blue-400` (info, customer badges)
- **Yellow:** `yellow-600` / `yellow-400` (warnings, pending)

**Neutrals:**
- **Gray scale:** `gray-50` to `gray-900`
- **Dark mode:** Always provide `dark:` variants

### Typography

**Headings:**
```jsx
<h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
  Page Title
</h1>
```

**Body text:**
```jsx
<p className="text-sm text-gray-600 dark:text-gray-400">
  Regular paragraph text
</p>
```

### Buttons

**Primary Button (Gradient):**
```jsx
<button className="inline-flex items-center px-4 py-2 border border-transparent rounded-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none shadow-lg shadow-indigo-500/30 transition-all">
  <PlusIcon className="h-5 w-5 mr-2" />
  New Job
</button>
```

**Secondary Button (Solid):**
```jsx
<button className="inline-flex items-center px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
  View
</button>
```

### Badges

**Contact Type Badges:**
```jsx
// Customer (Blue)
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
  Customer
</span>

// Supplier (Green)
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">
  Supplier
</span>

// Both (Purple)
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-200">
  Both
</span>
```

### Tables

**Standard Table:**
```jsx
<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
  <thead className="bg-gray-50 dark:bg-gray-800/50">
    <tr>
      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
        Column Name
      </th>
    </tr>
  </thead>
  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        Cell content
      </td>
    </tr>
  </tbody>
</table>
```

### Inline Editing

**Editable Table Cells:**
```jsx
{editingCell?.id === item.id && editingCell?.field === 'field_name' ? (
  <input
    type="text"
    value={editValue}
    onChange={(e) => setEditValue(e.target.value)}
    onBlur={handleCellBlur}
    onKeyDown={handleKeyDown}
    autoFocus
    className="w-full px-2 py-1 text-sm border border-indigo-500 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
  />
) : (
  <div
    onClick={(e) => {
      e.stopPropagation()
      handleCellClick(item.id, 'field_name', item.field_name)
    }}
    className="cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/20 px-2 py-1 rounded-md"
    title="Click to edit"
  >
    {item.field_name || '-'}
  </div>
)}
```

### Dark Mode

**Always include dark mode variants:**
- Text: `text-gray-900 dark:text-white`
- Backgrounds: `bg-white dark:bg-gray-900`
- Borders: `border-gray-200 dark:border-gray-700`
- Hover states: `hover:bg-gray-50 dark:hover:bg-gray-800/50`

### Icons

Use **Heroicons** (24/outline for UI, 24/solid for emphasis):
```jsx
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline'

<PlusIcon className="h-5 w-5" />
```

### Spacing & Layout

**Container padding:**
```jsx
<div className="px-6 py-4">
  {/* Content */}
</div>
```

**Gaps between elements:**
```jsx
<div className="flex items-center gap-3">
  {/* Items with 12px gap */}
</div>
```

### Tab Navigation

**IMPORTANT:** Always use URL-based tab navigation with `useSearchParams` to persist tab state in the URL.

**Why URL-based tabs:**
- ✅ Users can bookmark specific tabs
- ✅ Tab state persists on page refresh
- ✅ Shareable URLs with pre-selected tabs
- ✅ Browser back/forward navigation works

**Standard Implementation:**
```jsx
import { useSearchParams } from 'react-router-dom'

export default function MyPage() {
  // Get tab from URL, default to 'overview'
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'

  // Ensure URL always has tab parameter on mount
  useEffect(() => {
    if (!searchParams.get('tab')) {
      setSearchParams({ tab: 'overview' }, { replace: true })
    }
  }, [])

  return (
    <div>
      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setSearchParams({ tab: 'overview' })}
            className={`${
              activeTab === 'overview'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Overview
          </button>
          <button
            onClick={() => setSearchParams({ tab: 'details' })}
            className={`${
              activeTab === 'details'
                ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Details
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="mt-6">
          {/* Overview content */}
        </div>
      )}

      {activeTab === 'details' && (
        <div className="mt-6">
          {/* Details content */}
        </div>
      )}
    </div>
  )
}
```

**Example URLs:**
- `/contacts/123` - Defaults to Overview tab
- `/contacts/123?tab=relationships` - Opens Related Contacts tab
- `/contacts/123?tab=pricebook` - Opens Price Book tab

**Reference Implementation:**
See [ContactDetailPage.jsx](frontend/src/pages/ContactDetailPage.jsx) for a complete example with conditional tabs.

### Back Button Navigation

**IMPORTANT:** Always use browser history navigation (`navigate(-1)`) instead of hardcoded paths for back buttons.

**Why browser history navigation:**
- ✅ Works with the URL state (including tabs, filters, etc.)
- ✅ Takes users back to wherever they came from, not a fixed location
- ✅ Respects the actual navigation flow
- ✅ Supports bookmarked URLs and deep links properly

**Standard Implementation:**
```jsx
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function MyDetailPage() {
  const navigate = useNavigate()

  return (
    <div>
      {/* Back Button */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Back
      </button>

      {/* Page content */}
    </div>
  )
}
```

**❌ Don't do this:**
```jsx
// Bad - hardcoded path
<Link to="/suppliers">Back to Suppliers</Link>

// Bad - hardcoded path with navigate
<button onClick={() => navigate('/suppliers')}>Back to Suppliers</button>
```

**✅ Do this:**
```jsx
// Good - browser history navigation
<button onClick={() => navigate(-1)}>Back</button>
```

**Text Convention:**
- Always use just "Back" as the button text
- Don't use "Back to [Page Name]" - the navigation history knows where to go
- You can use an icon (ArrowLeftIcon) with or without text

**Reference Implementation:**
See [ContactDetailPage.jsx](frontend/src/pages/ContactDetailPage.jsx:770-774) or [SupplierDetailPage.jsx](frontend/src/pages/SupplierDetailPage.jsx:317) for examples.

---

## Deployment

### Automatic Deployments (Main Branch Only)

When changes are merged to `main`:

**Backend (Heroku):**
1. Heroku detects changes in `backend/` directory
2. Runs `bundle install`
3. Runs database migrations: `bin/rails db:migrate`
4. Restarts dynos
5. Live at: `https://teeemlive-ce8e2660a615.herokuapp.com`

**Frontend (Vercel):**
1. Vercel detects changes in `frontend/` directory
2. Runs `npm install` and `npm run build`
3. Deploys to production
4. Live at: `https://teeem.vercel.app`

### Manual Deployments

**Deploy Backend to Heroku:**
```bash
# From teeem root directory
git subtree push --prefix backend heroku main
```

**Deploy Frontend to Vercel:**
```bash
# Handled automatically by Vercel on git push to main
# Or manually via Vercel dashboard
```

**Check Deployment Status:**
```bash
# Backend (Heroku)
heroku ps -a teeemlive
heroku logs --tail -a teeemlive

# Frontend (Vercel)
vercel ls
```

### Important: Rob's Branch Does NOT Deploy

- ✅ `rob` branch is for development only
- ❌ No automatic deployments from `rob` branch
- ✅ Only `main` branch triggers production deployments
- ✅ Changes must be merged via PR to reach production

---

## Getting Help

**Questions?** Ask Jake or check these resources:

- **Backend docs:** `/Users/jakebaird/teeem/backend/README.md`
- **API docs:** `/Users/jakebaird/teeem/JOB_ESTIMATION_WORKFLOW.md`
- **Environment setup:** `/Users/jakebaird/teeem/backend/.env.example`
- **Heroku logs:** `heroku logs --tail -a teeemlive`

**Common Issues:**

1. **"Database connection error"** → Check DATABASE_URL in .env
2. **"CORS errors"** → Ensure FRONTEND_URL matches localhost:5173
3. **"Module not found"** → Run `bundle install` or `npm install`
4. **"Migration failed"** → Check for pending migrations: `bin/rails db:migrate:status`

---

## Code Review Standards

When your PR is reviewed, expect feedback on:

1. **Functionality** - Does the code work as intended?
2. **Design consistency** - Does the UI match existing patterns?
3. **Code quality** - Is it readable, maintainable, DRY?
4. **Performance** - Are there any obvious performance issues?
5. **Security** - No exposed secrets, SQL injection, XSS vulnerabilities?

**Reviews are collaborative, not critical.** The goal is to maintain a high-quality, consistent codebase.

---

## Summary Workflow for Rob

```bash
# 1. Pull latest changes
git checkout rob
git pull origin rob

# 2. Make changes
# ... code, code, code ...

# 3. Test locally
cd backend && bin/rails server
cd frontend && npm run dev
# Verify everything works

# 4. Commit and push
git add .
git commit -m "Descriptive commit message"
git push origin rob

# 5. Create PR (when ready)
gh pr create --base main --head rob --title "Add feature X"

# 6. Wait for review
# Jake or deploy-manager will review

# 7. Address feedback (if any)
# Make requested changes, push again

# 8. Merge approved
# Jake merges to main → auto-deploys to production
```

---

**Happy coding! 🚀**
