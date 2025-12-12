# Refactoring Plan - Oversized Files

**Created:** 2025-12-13
**Philosophy:** Simplify Ruthlessly - "Elegance is achieved not when there's nothing left to add, but when there's nothing left to take away."

---

## Priority 1: Critical Files (3000+ lines)

### 1.1 contacts/[id]/page.tsx (5,216 lines)

**Current State:** Monolithic page handling all contact concerns

**Refactoring Strategy:**
```
contacts/[id]/
├── page.tsx                    # Layout + tab routing (~200 lines)
├── components/
│   ├── ContactHeader.tsx       # Name, photo, quick actions
│   ├── ContactOverviewTab.tsx  # Basic info
│   ├── ContactRelationshipsTab.tsx
│   ├── ContactFamilyTab.tsx
│   ├── ContactEmploymentTab.tsx
│   ├── ContactShareholdingTab.tsx
│   └── ContactDirectorshipTab.tsx
├── hooks/
│   ├── useContactData.ts       # Data fetching
│   └── useContactActions.ts    # CRUD operations
└── types.ts                    # Shared types
```

**Target:** < 300 lines per file

---

### 1.2 corporate/companies/[id]/page.tsx (5,531 lines)

**Current State:** All company details in one file

**Refactoring Strategy:**
```
corporate/companies/[id]/
├── page.tsx                    # Layout + tab routing
├── components/
│   ├── CompanyHeader.tsx
│   ├── CompanyOverviewTab.tsx
│   ├── CompanyManagementTab.tsx
│   ├── CompanyDocumentsTab.tsx
│   ├── CompanyComplianceTab.tsx
│   └── CompanyFinancialsTab.tsx
├── hooks/
│   └── useCompanyData.ts
└── types.ts
```

---

### 1.3 TeeemTableView.tsx (4,354 lines)

**Current State:** All table features in single component

**Refactoring Strategy:**
```
components/table/
├── TeeemTableView.tsx          # Main orchestrator (~500 lines)
├── core/
│   ├── TableHeader.tsx         # Column headers, sorting
│   ├── TableBody.tsx           # Row rendering
│   ├── TableFooter.tsx         # Pagination, totals
│   └── TableToolbar.tsx        # Search, filters, actions
├── features/
│   ├── ColumnResizer.tsx
│   ├── ColumnVisibility.tsx
│   ├── GroupingManager.tsx
│   ├── InlineEditor.tsx
│   └── ViewManager.tsx
├── hooks/
│   ├── useTableState.ts
│   ├── useTableData.ts
│   ├── useColumnConfig.ts
│   └── useTableKeyboard.ts
└── utils/
    ├── sorting.ts
    ├── filtering.ts
    └── grouping.ts
```

---

### 1.4 contacts_controller.rb (3,926 lines)

**Current State:** All contact endpoints + sync + portal in one controller

**Refactoring Strategy:**
```ruby
# Split into concerns:

# app/controllers/api/v1/contacts_controller.rb (~300 lines)
# Basic CRUD: index, show, create, update, destroy

# app/controllers/api/v1/contacts/
#   xero_sync_controller.rb      # Xero sync endpoints
#   portal_controller.rb         # Portal user management
#   relationships_controller.rb  # Contact relationships
#   activities_controller.rb     # Activity feed
#   enrichment_controller.rb     # Data enrichment
```

**Routes Update:**
```ruby
namespace :api do
  namespace :v1 do
    resources :contacts do
      scope module: :contacts do
        resource :xero_sync, only: [:create, :show]
        resource :portal, only: [:create, :destroy]
        resources :relationships
        resources :activities, only: [:index, :create]
      end
    end
  end
end
```

---

## Priority 2: Large Files (1000-3000 lines)

### 2.1 Backend Services

| Service | Lines | Split Into |
|---------|-------|------------|
| `xero_controller.rb` | 2,367 | OAuth, Sync, BankTransactions controllers |
| `organization_onedrive_controller.rb` | 2,150 | Connection, Sync, Documents controllers |
| `xero_contact_sync_service.rb` | 1,379 | ContactMatcher, FieldMapper, SyncExecutor |
| `bank_transaction_report_service.rb` | 1,291 | BankFormatter base + NAB, Westpac, CBA formatters |

### 2.2 Frontend Components

| Component | Lines | Split Into |
|-----------|-------|------------|
| `DocumentPreviewModal.tsx` | 2,156 | Modal shell + DocumentViewer + DocumentActions |
| `ViewManagerSheet.tsx` | 1,834 | ViewList + ViewEditor + ViewSharing |
| `ColumnEditorModal.tsx` | 1,242 | Modal shell + TypeSelector + ColumnConfig per type |

---

## Priority 3: DRY Opportunities

### 3.1 Sync Service Base Class

**11 sync services with repeated patterns:**

```ruby
# app/services/concerns/syncable.rb
module Syncable
  extend ActiveSupport::Concern

  included do
    attr_reader :stats, :errors
  end

  def initialize
    @stats = { processed: 0, created: 0, updated: 0, failed: 0 }
    @errors = []
  end

  def with_rate_limiting(&block)
    # Common rate limiting logic
  end

  def handle_sync_error(record, error)
    # Common error handling
  end

  def mark_successful(record)
    # Common success tracking
  end
end
```

### 3.2 Column Type Validation SSoT

**Current:** 3 places define same validation logic
- `CellValidation.tsx` (31 functions)
- `column_type_validator.rb` (15+ cases)
- `data_importer.rb` (convert_value)

**Solution:** Single API endpoint returns validation rules:
```json
GET /api/v1/column_types

{
  "email": {
    "pattern": "^[^@]+@[^@]+$",
    "max_length": 255,
    "error_message": "Must be a valid email"
  },
  "phone": {
    "pattern": "^\\(?\\d{2}\\)?\\s?\\d{4}\\s?\\d{4}$",
    "max_length": 20
  }
}
```

Frontend fetches once, uses everywhere.

---

## Execution Plan

### Phase 1: Quick Wins (This Week)
- [x] Replace Loader → Spinner (40 files)
- [x] Fix dark mode violations (UI components)
- [ ] Extract `ContactHeader.tsx` from contacts page
- [ ] Create `Syncable` concern for backend services

### Phase 2: Tab Extraction (Next Week)
- [ ] Extract all tabs from `contacts/[id]/page.tsx`
- [ ] Extract all tabs from `corporate/companies/[id]/page.tsx`
- [ ] Split `contacts_controller.rb` into concerns

### Phase 3: Major Refactoring (Following Weeks)
- [ ] Refactor `TeeemTableView.tsx` into feature modules
- [ ] Create bank formatter base class + subclasses
- [ ] Consolidate column validation to single SSoT

---

## Migration Policy

**"Fix it when you touch it"**

When editing any oversized file:
1. Check if your change touches a specific section
2. Extract that section into its own file
3. Update imports
4. Test functionality
5. Document in this plan

**Don't:**
- Refactor entire file at once (risky)
- Skip tests after extraction
- Leave orphan imports

---

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Files over 1000 lines | 24 | < 5 |
| Files over 500 lines | 40+ | < 15 |
| Largest file | 5,531 lines | < 500 lines |
| Duplicate validation logic | 3 places | 1 SSoT |

---

**Last Updated:** 2025-12-13
