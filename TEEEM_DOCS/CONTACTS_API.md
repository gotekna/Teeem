# Contacts API Reference

> **SSoT**: This document is the Single Source of Truth for all Contacts API endpoints.
> **Generated**: 2025-12-29 from test suite analysis
> **Controller**: `backend/app/controllers/api/v1/contacts_controller.rb` (4,188 lines)

## Overview

The Contacts API manages all contact-related operations in TEEEM. This controller is currently a "god object" scheduled for decomposition into 10+ smaller controllers.

### Response Format

All endpoints return JSON with this structure:

```json
// Success
{ "success": true, "data": { ... } }
// or
{ "success": true, "contacts": [...] }
// or
{ "success": true, "contact": {...} }

// Error
{ "success": false, "error": "Error message" }
```

### Authentication

All endpoints require JWT authentication via the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## 1. Core CRUD Operations

**Target Controller**: `Api::V1::ContactsController` (~400 lines after refactor)

### GET /api/v1/contacts

Returns a paginated list of contacts.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | integer | Page number (default: 1) |
| `per_page` | integer | Items per page (default: 25) |
| `entity_type` | string | Filter by type: `person`, `company`, `trust`, `price_only` |
| `q` | string | Search query (searches display_name, email) |
| `is_active` | boolean | Filter active/inactive contacts |

**Response:**
```json
{
  "success": true,
  "contacts": [...],
  "meta": {
    "current_page": 1,
    "total_pages": 10,
    "total_count": 250
  }
}
```

### GET /api/v1/contacts/:id

Returns a single contact with all associations.

**Response:**
```json
{
  "success": true,
  "contact": {
    "id": 123,
    "display_name": "John Doe",
    "entity_type": "person",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "contact_emails": [...],
    "contact_phones": [...],
    "contact_addresses": [...],
    "contact_groups": [...]
  }
}
```

### POST /api/v1/contacts

Creates a new contact.

**Request Body:**
```json
{
  "contact": {
    "entity_type": "person",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "contact_emails_attributes": [
      { "email": "john@work.com", "email_type": "work" }
    ]
  }
}
```

**Response:** Returns created contact

### PATCH /api/v1/contacts/:id

Updates an existing contact.

**Request Body:** Same as POST, with partial updates allowed

**Response:** Returns updated contact

### DELETE /api/v1/contacts/:id

Deletes or archives a contact.

**Behavior:**
- If contact has related data (invoices, activities, POs) → **soft-delete** (archived)
- If contact has no related data → **hard-delete**

**Response:**
```json
// Hard delete
{ "success": true, "message": "Contact deleted successfully" }

// Soft delete (archived)
{
  "success": true,
  "archived": true,
  "message": "Contact archived (not deleted) to preserve 5 activity records.",
  "archive_reasons": ["5 activity records"]
}
```

---

## 2. Quality Reviews

**Target Controller**: `Api::V1::Contacts::QualityReviewsController` (~300 lines)

### GET /api/v1/contacts/quality_reviews

Returns contacts with pending quality reviews.

### POST /api/v1/contacts/quality_scan

Triggers a quality scan for all contacts.

### POST /api/v1/quality_reviews/:id/approve

Approves a quality review for a contact.

### POST /api/v1/quality_reviews/:id/reject

Rejects a quality review.

### POST /api/v1/quality_reviews/:id/skip

Skips a quality review.

### POST /api/v1/quality_reviews/bulk_approve

Bulk approves multiple quality reviews.

**Request Body:**
```json
{ "review_ids": [1, 2, 3] }
```

### GET /api/v1/contacts/:id/analyze_quality

Analyzes quality for a single contact.

---

## 3. ABN Verification

**Target Controller**: `Api::V1::Contacts::AbnVerificationController` (~120 lines)

### GET /api/v1/contacts/validate_abn

Validates an ABN format (checksum validation).

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `abn` | string | ABN to validate (11 digits) |

**Response:**
```json
{ "valid": true, "formatted": "12 345 678 901" }
```

### POST /api/v1/contacts/:id/verify_abn

Verifies contact's ABN via the Australian Business Register API.

**Response:**
```json
{
  "success": true,
  "data": {
    "abn": "12345678901",
    "abn_formatted": "12 345 678 901",
    "entity_name": "ACME PTY LTD",
    "entity_type": "Australian Private Company",
    "gst_registered": true,
    "valid": true,
    "active": true
  }
}
```

### POST /api/v1/contacts/find_missing_abns

Finds contacts with missing ABNs that should have them.

---

## 4. Supplier Pricing

**Target Controller**: `Api::V1::Contacts::SupplierPricingController` (~350 lines)

### GET /api/v1/contacts/:id/categories

Returns pricebook categories for a supplier.

### POST /api/v1/contacts/:id/copy_price_history

Copies price history from another supplier.

**Request Body:**
```json
{ "source_supplier_id": 456 }
```

### POST /api/v1/contacts/:id/bulk_update_prices

Bulk updates prices for a supplier.

**Request Body:**
```json
{
  "updates": [
    { "item_id": 1, "price": 99.99 },
    { "item_id": 2, "price": 149.99 }
  ]
}
```

### DELETE /api/v1/contacts/:id/remove_from_categories

Removes supplier from specified categories.

**Request Body:**
```json
{ "category_ids": [1, 2, 3] }
```

### DELETE /api/v1/contacts/:id/delete_price_column

Deletes a price column by date.

**Request Body:**
```json
{ "date": "2024-01-15" }
```

---

## 5. Merge & Duplicates

**Target Controller**: `Api::V1::Contacts::MergeController` (~300 lines)

### GET /api/v1/contacts/possible_duplicates

Returns possible duplicate contacts.

**Aliases:** `/api/v1/contacts/duplicates`

### POST /api/v1/contacts/merge

Merges multiple contacts into one.

**Request Body:**
```json
{
  "target_id": 123,
  "source_ids": [456, 789]
}
```

**Behavior:**
- Merges roles, emails, phones from sources to target
- Transfers relationships (jobs, invoices, activities)
- Deletes source contacts after merge

---

## 6. Corporate Structure

**Target Controller**: `Api::V1::Contacts::CorporateStructureController` (~250 lines)

> **Note:** These endpoints require `link_to_cg: true` on the contact.

### GET /api/v1/contacts/:id/company_group_memberships

Returns company group memberships for a contact.

### GET /api/v1/contacts/:id/directorships

Returns directorships for a person contact.

### GET /api/v1/contacts/:id/shareholdings

Returns shareholdings for a person contact.

### GET /api/v1/contacts/:id/trust_roles

Returns trust roles for a person contact.

### GET /api/v1/contacts/:id/ownership_chain

Returns ownership chain for a company contact.

---

## 7. Enrichment

**Target Controller**: `Api::V1::Contacts::EnrichmentController` (~400 lines)

### POST /api/v1/contacts/:id/enrich_from_web

Enriches contact data from web sources.

### PATCH /api/v1/contacts/:id/update_from_bill

Updates contact fields from extracted invoice data.

**Request Body:**
```json
{
  "fields": {
    "display_name": "ACME Corporation",
    "abn": "12345678901"
  },
  "bill_id": 123
}
```

### GET /api/v1/contacts/preview_employee_extraction

Previews employee extraction from company emails.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `contact_id` | integer | Company contact ID |

### POST /api/v1/contacts/extract_employees

Extracts and creates employee contacts from emails.

**Request Body:**
```json
{
  "contact_id": 123,
  "employees": [
    { "name": "John Doe", "email": "john@company.com" }
  ]
}
```

---

## 8. Health Checks

**Target Controller**: `Api::V1::Contacts::HealthController` (~200 lines)

### GET /api/v1/contacts/health

Returns overall contact health score and statistics.

### GET /api/v1/contacts/invalid_entity_types

Returns contacts with invalid entity types.

### GET /api/v1/contacts/price_only_with_xero

Returns price-only suppliers that are linked to Xero (potential cleanup).

### GET /api/v1/contacts/company_with_first_name

Returns companies that have first_name set (likely miscategorized as person).

### GET /api/v1/contacts/person_without_name

Returns persons without first/last name.

### GET /api/v1/contacts/missing_contact_info

Returns contacts missing phone and email.

### GET /api/v1/contacts/connected_mailboxes

Returns Microsoft mailboxes connected for email sync.

---

## 9. Relationships

**Target Controller**: `Api::V1::Contacts::RelationshipsController` (~150 lines)

### GET /api/v1/contacts/:id/coworkers

Returns coworkers at the same company.

### GET /api/v1/contacts/:id/case_relationships

Returns case/matter relationships for a contact.

### POST /api/v1/contacts/:id/reorder_employees

Reorders employees under a company contact.

**Request Body:**
```json
{ "employee_ids": [1, 3, 2, 5, 4] }
```

### POST /api/v1/contacts/:id/reorder_companies

Reorders companies for a person contact.

**Request Body:**
```json
{ "company_ids": [10, 20, 30] }
```

---

## 10. Xero Integration

**Target Controller**: `Api::V1::Contacts::XeroController` (~350 lines)

> **Note:** Requires active XeroCredential with connected tenant.

### POST /api/v1/contacts/:id/link_xero_contact

Links a TEEEM contact to a Xero contact.

**Request Body:**
```json
{ "xero_contact_id": "abc-123-def" }
```

### POST /api/v1/contacts/:id/link_to_xero_tenant

Links a contact to a Xero tenant.

**Request Body:**
```json
{ "tenant_id": "tenant-uuid" }
```

### POST /api/v1/contacts/:id/sync_from_xero

Syncs contact data FROM Xero to TEEEM.

### POST /api/v1/contacts/:id/sync_to_xero

Syncs contact data TO Xero from TEEEM.

---

## 11. Portal Users

**Target Controller**: `Api::V1::Contacts::PortalUsersController` (~100 lines)

### POST /api/v1/contacts/:id/portal_user

Creates a portal user for a contact.

**Request Body:**
```json
{ "email": "portal@example.com" }
```

### PATCH /api/v1/contacts/:id/portal_user

Updates portal user settings.

### DELETE /api/v1/contacts/:id/portal_user

Deletes the portal user for a contact.

---

## 12. Bulk Operations

### PATCH /api/v1/contacts/bulk_update

Bulk updates multiple contacts.

**Request Body:**
```json
{
  "contact_ids": [1, 2, 3],
  "updates": {
    "entity_type": "company"
  }
}
```

### POST /api/v1/contacts/fix_name_casing

Fixes name casing issues across contacts.

### POST /api/v1/contacts/fix_email_assignment

Fixes email assignment issues (migrates legacy email to contact_emails).

---

## 13. Metadata Endpoints

### GET /api/v1/contacts/read_only_fields

Returns fields that are read-only (synced from Xero).

**Response:**
```json
{
  "success": true,
  "read_only_fields": ["tax_number", "xero_id", ...],
  "message": "These fields are synced from Xero and cannot be edited in TEEEM"
}
```

### GET /api/v1/contacts/entity_types

Returns valid entity types with metadata.

**Response:**
```json
{
  "success": true,
  "entity_types": ["person", "company", "trust", "price_only"],
  "metadata": [
    {
      "value": "person",
      "label": "Person",
      "description": "Individual contact",
      "has_first_last_name": true
    }
  ]
}
```

### GET /api/v1/contacts/employment_statuses

Returns valid employment statuses.

### GET /api/v1/contacts/roles

Returns valid contact roles.

---

## 14. Activities & Messages

### GET /api/v1/contacts/:id/activities

Returns activities for a contact (emails, calls, notes).

### GET /api/v1/contacts/:id/internal_messages

Returns internal messages/notes for a contact.

---

## Entity Types

| Type | Description | Has Name | Can Have Employer |
|------|-------------|----------|-------------------|
| `person` | Individual contact | Yes (first/last) | Yes |
| `company` | Business entity | No (company_name) | No |
| `trust` | Trust entity | No (trust name) | No |
| `price_only` | Pricebook-only supplier | No | No |

---

## Migration Notes

### Planned Controller Decomposition

| New Controller | Actions | Est. Lines |
|----------------|---------|------------|
| `ContactsController` | CRUD only | ~400 |
| `QualityReviewsController` | 6 actions | ~300 |
| `AbnVerificationController` | 3 actions | ~120 |
| `SupplierPricingController` | 5 actions | ~350 |
| `MergeController` | 2 actions | ~300 |
| `CorporateStructureController` | 5 actions | ~250 |
| `EnrichmentController` | 4 actions | ~400 |
| `HealthController` | 7 actions | ~200 |
| `RelationshipsController` | 4 actions | ~150 |
| `XeroController` | 4 actions | ~350 |
| `PortalUsersController` | 3 actions | ~100 |

### Route Migration Strategy

1. Add new namespaced routes
2. Keep legacy routes as aliases (with deprecation warnings)
3. Update frontend to use new routes
4. Remove legacy routes after 1 month

---

## Test Coverage

**Test File:** `spec/requests/api/v1/contacts_controller_spec.rb`

| Category | Tests | Passing |
|----------|-------|---------|
| Core CRUD | 12 | 12 |
| Metadata | 4 | 4 |
| Quality Reviews | 6 | 2 |
| ABN Verification | 3 | 2 |
| Health Checks | 7 | 6 |
| Relationships | 4 | 3 |
| Other | 33 | 11 |
| **Total** | **69** | **40** |

Note: 29 tests are skipped pending factory creation for external services (Xero, Corporate, Pricebook).
