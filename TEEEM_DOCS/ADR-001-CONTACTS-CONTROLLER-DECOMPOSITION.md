# ADR-001: Contacts Controller Decomposition

**Status:** Accepted
**Date:** 2025-12-29
**Authors:** Rob, Claude
**Reviewers:** -

## Context

The `contacts_controller.rb` has grown to 4,188 lines with 65+ public actions, making it:
- Difficult to navigate and understand
- Hard to test comprehensively
- Prone to merge conflicts
- A violation of Single Responsibility Principle

### Current State

```
backend/app/controllers/api/v1/contacts_controller.rb
├── 4,188 lines of code
├── 65+ public actions
├── 15 distinct functional domains
├── 2 concerns already extracted (XeroSync, PortalUserManagement)
└── 0% test coverage (before this refactor)
```

### Functional Domains Identified

| Domain | Actions | Lines (Est.) |
|--------|---------|--------------|
| Core CRUD | 5 | 400 |
| Quality Reviews | 6 | 300 |
| ABN Verification | 3 | 120 |
| Supplier Pricing | 5 | 350 |
| Merge & Duplicates | 2 | 300 |
| Corporate Structure | 5 | 250 |
| Enrichment | 4 | 400 |
| Health Checks | 7 | 200 |
| Relationships | 4 | 150 |
| Xero Integration | 4 | 350 |
| Portal Users | 3 | 100 |
| Bulk Operations | 3 | 150 |
| Metadata | 4 | 100 |
| Activities | 2 | 100 |

## Decision

**We will decompose `contacts_controller.rb` into 10+ separate namespaced controllers.**

### Target Architecture

```
backend/app/controllers/api/v1/
├── contacts_controller.rb                              (~400 lines) - Core CRUD only
└── contacts/
    ├── quality_reviews_controller.rb                   (~300 lines)
    ├── abn_verification_controller.rb                  (~120 lines)
    ├── supplier_pricing_controller.rb                  (~350 lines)
    ├── merge_controller.rb                             (~300 lines)
    ├── corporate_structure_controller.rb               (~250 lines)
    ├── enrichment_controller.rb                        (~400 lines)
    ├── health_controller.rb                            (~200 lines)
    ├── relationships_controller.rb                     (~150 lines)
    ├── xero_controller.rb                              (~350 lines)
    └── portal_users_controller.rb                      (~100 lines)
```

### Route Structure

```ruby
# config/routes.rb
namespace :api do
  namespace :v1 do
    resources :contacts  # Core CRUD stays here

    namespace :contacts do
      resources :quality_reviews, only: [:index, :show, :update] do
        collection do
          post :scan
          post :bulk_approve
        end
        member do
          post :approve
          post :reject
          post :skip
        end
      end

      resource :abn_verification, only: [] do
        post :validate
        post :verify
        post :find_missing
      end

      # ... etc
    end
  end
end
```

## Alternatives Considered

### Option A: Concerns Only (Rejected)

Extract logic into concerns but keep single controller.

**Pros:**
- No route changes needed
- Faster to implement

**Cons:**
- Doesn't reduce controller file size significantly
- Still violates SRP
- Harder to test individual domains
- Already tried with 2 concerns - doesn't scale

### Option B: Service Objects (Rejected)

Extract business logic into service objects, keep thin controller.

**Pros:**
- Separates business logic from HTTP concerns
- Highly testable

**Cons:**
- Doesn't solve the routing/controller organization problem
- Still need controller for each endpoint
- Adds indirection without addressing core issue

### Option C: Separate Namespaced Controllers (Chosen)

Create new controllers in `Api::V1::Contacts::` namespace.

**Pros:**
- Clear domain separation
- Each controller is focused and testable
- RESTful route structure
- Standard Rails convention
- Easy to find related code

**Cons:**
- Requires route migration
- Frontend needs to update API calls
- Temporary duplication during migration

## Consequences

### Positive

1. **Maintainability**: Each controller is <500 lines, easy to understand
2. **Testability**: Can test each domain in isolation
3. **Discoverability**: New developers can find code by domain
4. **Merge Conflicts**: Reduced - developers work on separate files
5. **Performance**: Smaller files load faster in IDEs

### Negative

1. **Migration Effort**: Requires careful extraction and testing
2. **Route Changes**: Frontend must update API calls
3. **Temporary Complexity**: Old and new routes coexist during migration

### Neutral

1. **File Count**: More files, but each is simpler
2. **Learning Curve**: Team needs to learn new structure

## Implementation Plan

### Phase 1: Test Infrastructure (Week 1-2) ✅ COMPLETE

- [x] Create request specs for all endpoints
- [x] Document API contracts
- [x] Fix discovered bugs (includes, verify_abn)
- [x] Establish test baseline (40/69 passing)

### Phase 2: First Extractions (Week 3-4)

- [ ] Extract `QualityReviewsController`
- [ ] Extract `AbnVerificationController`
- [ ] Add new routes alongside legacy routes
- [ ] Update frontend API calls
- [ ] Verify all tests pass

### Phase 3: Core Domains (Week 5-8)

- [ ] Extract `SupplierPricingController`
- [ ] Extract `MergeController`
- [ ] Extract `CorporateStructureController`
- [ ] Extract `EnrichmentController`

### Phase 4: Final Extractions (Week 9-10)

- [ ] Extract `HealthController`
- [ ] Extract `RelationshipsController`
- [ ] Extract `XeroController`
- [ ] Extract `PortalUsersController`

### Phase 5: Cleanup (Week 11-12)

- [ ] Remove legacy route aliases
- [ ] Delete extracted code from main controller
- [ ] Final test coverage report
- [ ] Documentation update

## Migration Strategy

### Route Aliasing

During migration, both old and new routes will work:

```ruby
# Legacy (to be deprecated)
post '/api/v1/contacts/:id/verify_abn'

# New (preferred)
post '/api/v1/contacts/abn_verification/:id/verify'
```

### Frontend Migration

1. Frontend identifies all API calls to contacts endpoints
2. Update calls to use new routes (1 domain at a time)
3. Verify functionality in staging
4. Deploy frontend changes
5. After 1 month, remove legacy routes

### Rollback Plan

If issues arise:
1. Git tags created before each extraction
2. Legacy routes kept for 1 month
3. Can revert to concern-based approach if needed

## Success Metrics

| Metric | Before | Target |
|--------|--------|--------|
| Main controller lines | 4,188 | <400 |
| New controllers | 0 | 10 |
| Test coverage | 0% | 95% |
| Avg controller lines | 4,188 | ~250 |
| Time to add endpoint | 2-4 hours | 30 min |

## Related Documents

- [CONTACTS_API.md](./CONTACTS_API.md) - API endpoint documentation
- [Plan File](../.claude/plans/rosy-toasting-whistle.md) - Full 6-month refactor plan

## Appendix: Bugs Fixed During Analysis

### Bug 1: `includes(*[])` Error

**Location:** `contacts_controller.rb:4029-4056`

**Problem:** When `eager_load_associations` was an empty array, calling `Contact.includes(*[])` threw "The method .includes() must contain arguments."

**Fix:**
```ruby
# Before
@contact = Contact.includes(*eager_load_associations).find(id_or_slug)

# After
base_query = eager_load_associations.any? ? Contact.includes(*eager_load_associations) : Contact
@contact = base_query.find(id_or_slug)
```

### Bug 2: `tax_number` vs `abn` Field

**Location:** `contacts_controller.rb:3489`

**Problem:** `verify_abn` action referenced `contact.tax_number` but the actual column is `contact.abn`.

**Fix:** Changed all `tax_number` references to `abn` in the verify_abn action.
