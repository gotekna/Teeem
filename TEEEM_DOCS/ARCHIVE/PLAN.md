# Plan: Single Source of Truth for Companies and People

## Problem Statement

We have **two sources of truth** creating data confusion:

### Problem 1: People in Companies Table
5 "Person" entities exist in `companies` table:
- Robert Harder, Rachel Harder, Sophie, Jared, Grace (with 33 documents)
- These SHOULD be in `contacts` table only

### Problem 2: Some Company-Named Contacts Are VALID
Some contacts have company names but are VALID because they represent:
- **Suppliers** - Companies that supply to Tekna Homes (e.g., "Tekna Admin" is a supplier)
- **Customers** - Companies that are customers (e.g., "The Promise" is a customer)
- These are NOT duplicates - they're business relationships in the invoicing system

## Updated Single Source of Truth Rules

| Entity Type | Source of Truth | Notes |
|-------------|-----------------|-------|
| **Corporate entities** (Pty Ltd structure, directors, shareholders) | `companies` table | Legal/corporate data |
| **People** (directors, shareholders, family, individuals) | `contacts` table | Personal contact info |
| **Suppliers/Customers** (including companies as suppliers) | `contacts` table | Business relationships for invoicing |

**Key Insight:** A company can exist in BOTH tables for different purposes:
- `companies` table: Corporate structure (ACN, directors, shareholdings)
- `contacts` table: Business relationship (supplier/customer for invoicing)

## Current State Analysis

### Companies Table (entity_type breakdown)
- Company: 12 rows (correct)
- Trust: 2 rows (correct)
- Superfund: 1 row (correct)
- Person: 5 rows (**WRONG** - should be deleted, use contacts instead)

### Contacts with Company Names - Analysis

| Contact ID | Contact Name | Type | Invoices | Action |
|------------|--------------|------|----------|--------|
| 1801 | Tekna Admin | supplier | 689 | **KEEP** - Supplier to Tekna Homes |
| 1328 | Gen2612 Pty Ltd | supplier | 78 | **KEEP** - Supplier with invoice history |
| 1429 | The Promise QLD ATF The Promise Family Trust | customer | 7 | **KEEP** - Customer (ATF trading name) |
| 1291 | W2G Assets | customer | 1 | **KEEP** - Customer with invoice |
| 2166 | Prov1322 Global Pty Ltd | - | 0 | **DELETE** - Unused duplicate |
| 2059 | Tekna Homes | - | 0 | **DELETE** - Unused duplicate |
| 2167 | The Promise QLD Pty Ltd | - | 0 | **DELETE** - Unused duplicate |

## Implementation Plan

### Phase 1: Migrate Person Documents to Contacts

1. **Add `contact_id` to `company_documents`** (migration)
2. **Map Person companies to Contact records:**

   | Person Company ID | Contact Target ID | Name |
   |-------------------|-------------------|------|
   | 14 | 2160 | Robert John Harder |
   | 15 | 2159 | Rachel Anne Harder |
   | 16 | 2161 | Jared Sa-Bin Harder |
   | 17 | 1743 | Grace Harder |
   | 18 | 2163 | Sophie Mee-jeong Harder |

3. **Migrate documents:**
   ```sql
   UPDATE company_documents SET contact_id = 2160, company_id = NULL WHERE company_id = 14;
   UPDATE company_documents SET contact_id = 2159, company_id = NULL WHERE company_id = 15;
   UPDATE company_documents SET contact_id = 2161, company_id = NULL WHERE company_id = 16;
   UPDATE company_documents SET contact_id = 1743, company_id = NULL WHERE company_id = 17;
   UPDATE company_documents SET contact_id = 2163, company_id = NULL WHERE company_id = 18;
   ```

### Phase 2: Delete Person Entities from Companies Table

```sql
DELETE FROM companies WHERE entity_type = 'Person';
```

Result: Companies table will only have Company (12), Trust (2), Superfund (1) = 15 total

### Phase 3: Clean Up ONLY Unused Company Contacts

Delete only the contacts that have NO invoices/usage:
```sql
DELETE FROM contacts WHERE id IN (2166, 2059, 2167);
```

**KEEP these company-named contacts** (they have business relationships):
- 1801 (Tekna Admin) - 689 invoices
- 1328 (Gen2612 Pty Ltd) - 78 invoices
- 1429 (The Promise QLD ATF...) - 7 invoices (customer)
- 1291 (W2G Assets) - 1 invoice (customer)

### Phase 4: Merge Duplicate People Contacts

| Keep (Target) | Delete (Source) |
|---------------|-----------------|
| Rachel Anne Harder (2159) | Rachel Harder (1319) |
| Robert John Harder (2160) | Robert Harder (1304, 1301) |
| Sophie Mee-jeong Harder (2163) | Sophie Harder (1742) |
| Jared Sa-Bin Harder (2161) | Jared Sa-bin Harder (1597) |
| Andrew Mark Clement (2158) | Andrew Clement (1327) |

### Phase 5: Flag Family Members

```sql
UPDATE contacts SET is_family_member = true
WHERE id IN (2159, 2160, 2161, 1743, 2163);

UPDATE contacts SET company_group_id = (SELECT id FROM company_groups WHERE name = 'Team Harder')
WHERE id IN (2159, 2160, 2161, 1743, 2163);
```

### Phase 6: Update UI

1. **Companies page** - Only show Company, Trust, Superfund (no Person)
2. **Contacts page** - Add "Family" filter using `is_family_member`
3. **Contact Detail** - Show Documents tab for family members

## Final State

### Companies Table
- Entity Types: Company (12), Trust (2), Superfund (1) = 15 total
- NO Person entities

### Contacts Table
- Family members flagged with `is_family_member = true`
- Company-named contacts KEPT if they have business relationships (supplier/customer)
- Unused company duplicates DELETED
- People duplicates MERGED
- Family documents linked via `contact_id`

## Files to Modify

1. `db/migrate/xxx_add_contact_id_to_company_documents.rb` - New migration
2. `app/models/company_document.rb` - Add `belongs_to :contact, optional: true`
3. `app/controllers/api/v1/company_documents_controller.rb` - Support contact filtering
4. `frontend/src/components/corporate/CompanyDocumentsTab.jsx` - Support contact documents

## Validation Checklist

- [ ] No Person entities in companies table
- [ ] Unused company-named contacts deleted (2166, 2059, 2167)
- [ ] Valid supplier/customer contacts kept (1801, 1328, 1429, 1291)
- [ ] All 33 Person documents migrated to contacts
- [ ] Family members have `is_family_member = true`
- [ ] Duplicate people contacts merged
- [ ] Companies page shows only Company/Trust/Superfund
- [ ] Contacts page can filter by family
