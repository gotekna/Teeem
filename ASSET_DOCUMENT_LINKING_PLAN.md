# Asset Document Linking - Implementation Plan

## Executive Summary
Link documents to specific assets and create asset-specific document types (Purchase Contract, Title Search, Settlement Statement, etc.) while migrating 296 existing documents from old lowercase naming to new format.

## Current State Analysis

### Database Structure
✅ **Completed:**
- `company_documents.asset_id` column added (migration 20251129212650)
- Foreign key relationship to `assets` table exists
- 4 assets in system (including "Commercial Building Unit 5/8 Nevilles Street")
- 296 documents total across 11 companies

❌ **Missing:**
- Model associations not updated
- API doesn't support asset filtering
- No UI for asset-document linking
- 296 documents using old lowercase document_type names

### Old Document Types (Need Migration)
```
asic                 (41 docs)  → ASIC Documents
constitution         (9 docs)   → Constitution
contract             (1 doc)    → General
financial_statement  (31 docs)  → Draft Financials / Final Financials
loan_agreement       (28 docs)  → Loan Agreement
minutes              (9 docs)   → Directors' Minutes
other                (98 docs)  → General
security_deed        (1 doc)    → Security Deed
setup                (17 docs)  → ASIC Documents / Structure
share_registry       (34 docs)  → NEW: Share Registry (create)
tax                  (1 doc)    → ATO Documents
tax_return           (19 docs)  → CTR - Company Tax Return / TTR - Trust Tax Return
trust_deed           (7 docs)   → Trust Deed
```

### Document Organization Hierarchy
```
Company (company_id)
  └─ Asset (asset_id) - optional, for asset-specific docs
      └─ Folder (folder) - e.g., "Purchase", "Leases", "Maintenance"
          └─ Document Type - e.g., "Purchase Contract", "Title Search"
              └─ Tab - e.g., ASSETS, LOANS, etc.
```

## Implementation Plan

### Phase 1: Model Associations (30 min)

**File: `backend/app/models/asset.rb`**
- Add `has_many :company_documents, dependent: :nullify`
- Add scopes: `with_documents`, `document_count`

**File: `backend/app/models/company_document.rb`**
- Add `belongs_to :asset, optional: true`
- Update validation to remove hardcoded document_type list
- Add scope: `by_asset`, `with_asset`, `asset_documents_only`
- Remove old lowercase types from validation

### Phase 2: New Document Types (45 min)

**Create Migration: `20251129_add_asset_document_types.rb`**

Create new asset-specific document types:
```ruby
# Asset Purchase Documents (ASSETS tab)
- Purchase Contract
- Title Search
- Settlement Statement
- Deed of Variation
- Property Certificate
- Vendor Statement
- Contract of Sale

# Asset Ongoing Documents (ASSETS tab)
- Lease Agreement
- Maintenance Record
- Insurance Policy (Asset)
- Valuation Report

# Share Registry (GENERAL or new REGISTRY tab)
- Share Registry
```

Naming formats:
```
Purchase Contract:    {Company} Purchase Contract {Asset} {Date}
Title Search:         {Company} Title Search {Asset} {Date}
Settlement Statement: {Company} Settlement {Asset} {Date}
Share Registry:       {Company} Share Registry {Date}
```

### Phase 3: Migrate Old Documents (60 min)

**Create Migration: `20251129_migrate_old_document_types.rb`**

Strategy:
1. Create mapping hash: old_type → new_type
2. Update document_type field for all 296 documents
3. Update source field to match new tabs
4. Log changes for audit trail

```ruby
mapping = {
  'asic' => 'ASIC Documents',
  'constitution' => 'Constitution',
  'contract' => 'General',
  'financial_statement' => 'Draft Financials', # or Final based on context
  'loan_agreement' => 'Loan Agreement',
  'minutes' => "Directors' Minutes",
  'other' => 'General',
  'security_deed' => 'Security Deed',
  'setup' => 'ASIC Documents',
  'share_registry' => 'Share Registry',
  'tax' => 'ATO Documents',
  'tax_return' => 'CTR - Company Tax Return', # or TTR based on context
  'trust_deed' => 'Trust Deed'
}
```

### Phase 4: API Updates (45 min)

**File: `backend/app/controllers/api/v1/company_documents_controller.rb`**

Changes needed:
1. Add asset_id filtering to `index` action
2. Update `document_params` to permit asset_id
3. Add asset to JSON responses:
```ruby
def index
  # Add after existing filters
  @documents = @documents.where(asset_id: params[:asset_id]) if params[:asset_id].present?

  # Update JSON response
  render json: {
    documents: @documents.as_json(
      include: {
        company: { only: [:id, :name] },
        asset: { only: [:id, :name], methods: [:display_name] }, # NEW
        user: { only: [:id, :name, :email] }
      }
    )
  }
end

def document_params
  params.require(:company_document).permit(
    :company_id, :asset_id, :document_name, :document_type,
    :description, :file_url, :year, :period, :folder # Added asset_id
  )
end
```

**File: `backend/app/controllers/api/v1/assets_controller.rb`**

Add new endpoint:
```ruby
# GET /api/v1/assets/:id/documents
def documents
  documents = @asset.company_documents
    .includes(:document_type_record)
    .order(document_date: :desc, created_at: :desc)

  # Optional folder filtering
  documents = documents.where(folder: params[:folder]) if params[:folder].present?

  render json: {
    success: true,
    asset: @asset.as_json(only: [:id, :name], methods: [:display_name]),
    documents: documents.as_json(
      include: { document_type_record: { only: [:id, :name, :primary_tab, :tabs] } },
      methods: [:formatted_document_type, :file_size_mb]
    ),
    folders: documents.pluck(:folder).compact.uniq.sort
  }
end
```

**Routes Update:**
```ruby
resources :assets do
  member do
    get :documents # NEW
    get :service_history
    post :add_service
    get :insurance
    post :update_insurance
  end
end
```

### Phase 5: Frontend UI Updates (90 min)

**File: `frontend/src/pages/AssetDetailPage.jsx`**

Add Documents tab to asset detail view:
- Tab structure: Overview | Documents | Service History | Insurance
- Document list grouped by folder (Purchase, Leases, Maintenance)
- Upload button with asset pre-selected
- Filter by folder
- Link to full document viewer

**File: `frontend/src/pages/DocumentsPage.jsx`**

Update document upload form:
- Add optional "Link to Asset" dropdown
- Show linked asset badge on document cards
- Filter by asset in sidebar
- "Asset Documents" quick filter

**File: `frontend/src/components/documents/DocumentUploadModal.jsx` (NEW)**

Create reusable upload modal:
- Company selection
- Asset selection (optional)
- Document type dropdown (filtered by context)
- Folder input
- File upload with drag & drop
- Pre-populate fields when called from AssetDetailPage

### Phase 6: Tab Structure Updates (30 min)

**File: `frontend/src/pages/DocumentTabStructurePage.jsx`**

Update naming formats for new asset document types:
```javascript
const formats = {
  // ... existing formats
  'Purchase Contract': '{Company} Purchase Contract {Asset} {Date}',
  'Title Search': '{Company} Title Search {Asset} {Date}',
  'Settlement Statement': '{Company} Settlement {Asset} {Date}',
  'Share Registry': '{Company} Share Registry {Date}',
  // ... etc
}

const getFormatExample = (format) => {
  return format
    // ... existing replacements
    .replace('{Asset}', 'Neville Street')
}
```

## Migration Safety

### Data Integrity Checks
1. Before migration: Export CSV of all documents with old types
2. Create backup: `heroku pg:backups:capture`
3. Run migration with transaction rollback on error
4. After migration: Verify all 296 documents have new types
5. Audit log: Store old_type → new_type mapping in migration

### Rollback Strategy
```ruby
def down
  # Revert document types back to lowercase
  mapping.each do |old_type, new_type|
    CompanyDocument.where(document_type: new_type).update_all(document_type: old_type)
  end

  # Remove new document types
  DocumentType.where(name: ['Purchase Contract', 'Title Search', ...]).destroy_all
end
```

## Testing Strategy

### Backend Tests
1. Model associations: asset.company_documents, document.asset
2. API filtering: by asset_id
3. Migration: all 296 docs updated correctly
4. Validation: document_type accepts new types

### Frontend Tests
1. Asset detail page shows documents
2. Document upload with asset selection
3. Filter documents by asset
4. Display asset name on document cards

## Deployment Plan

### Step 1: Backend Changes (Deploy to staging)
```bash
# 1. Model changes (no migration)
git commit -am "feat: Add asset-document associations"

# 2. Create new document types
bin/rails generate migration AddAssetDocumentTypes
# Edit migration
bin/rails db:migrate
git commit -am "feat: Add asset-specific document types"

# 3. Migrate old documents
bin/rails generate migration MigrateOldDocumentTypes
# Edit migration
bin/rails db:migrate
git commit -am "feat: Migrate old document types to new naming"

# 4. API updates
git commit -am "feat: Add asset filtering to documents API"

# 5. Push to staging
git push origin rob
git subtree split --prefix backend -b temp-backend-deploy
git push heroku-rob-dev temp-backend-deploy:main --force
git branch -D temp-backend-deploy
```

### Step 2: Frontend Changes (Deploy to staging)
```bash
# 1. Update document upload form
git commit -am "feat: Add asset linking to document upload"

# 2. Update asset detail page
git commit -am "feat: Add documents tab to asset detail page"

# 3. Update tab structure page
git commit -am "feat: Add asset document naming formats"

# 4. Deploy to Vercel (auto-deploys on push)
git push origin rob
```

### Step 3: Verification
1. Check staging: https://teeemrob.vercel.app
2. Test asset document linking
3. Verify old documents migrated correctly
4. Test filtering by asset

### Step 4: Production Deploy
1. Create PR: rob → Live
2. Get user approval
3. Merge to Live
4. Monitor production

## Open Questions for User

1. **Share Registry Tab**: Should "Share Registry" documents:
   - Go in GENERAL tab?
   - Create new REGISTRY tab?
   - Go in ASIC tab?

2. **Financial Statement Split**: For 31 financial_statement docs:
   - How to determine if Draft vs Final?
   - Check file name for keywords?
   - Default all to Draft?

3. **Tax Return Split**: For 19 tax_return docs:
   - How to determine if CTR (company) vs TTR (trust)?
   - Check company type?
   - Check file name?

4. **Asset Linking**: For existing documents:
   - Should we auto-link based on folder structure?
   - Leave all asset_id as null for now?
   - Manual linking later?

## Success Criteria

✅ All 296 documents migrated to new document types
✅ Asset-document relationship established in database
✅ API supports filtering documents by asset
✅ Asset detail page shows related documents
✅ Document upload form allows asset selection
✅ Tab structure page updated with asset document formats
✅ No data loss during migration
✅ All tests passing

## Timeline Estimate

- Phase 1 (Models): 30 min
- Phase 2 (New Doc Types): 45 min
- Phase 3 (Migration): 60 min
- Phase 4 (API): 45 min
- Phase 5 (Frontend): 90 min
- Phase 6 (Tab Structure): 30 min

**Total: ~5 hours development time**

Testing & deployment: +2 hours
**Grand Total: ~7 hours**
