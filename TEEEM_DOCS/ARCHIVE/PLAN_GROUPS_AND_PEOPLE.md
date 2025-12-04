# Plan: Company Groups & People Data Architecture

## User Requirements
1. **Contacts = Single Source of Truth** for all people
2. **Directors need extra info** beyond basic contact fields
3. **Family members** (like Robert, Rachel, etc.) have personal documents:
   - Insurance
   - Tax returns
   - Other personal filing
4. **Documents stored in filing system** organized by Company Group
5. **Groups based on Trust/Trustee relationships** - each Trust + Trustee = a Group
6. **SharePoint folders mirror group structure**

---

## FINAL GROUP STRUCTURE (6 Groups)

| Group Name | Companies/Trusts | Notes |
|------------|------------------|-------|
| **Team Harder Family Trust Group** | Prov1322 Global Pty Ltd, Team Harder Family Trust | Prov1322 is Trustee |
| **Team Harder Super Fund Group** | Team Harder Pty Ltd, Team Harder Super Fund | Team Harder Pty Ltd is Trustee |
| **Team Harder Super Investments Group** | Team Harder Super Investments Pty Ltd, W2G Assets Pty Ltd | W2G 100% owned by TH Super Inv |
| **The Promise Group** | The Promise QLD Pty Ltd, The Promise Family Trust | Promise QLD is Trustee |
| **Tekna Group** | Tekna Pty Ltd, Tekna Admin, Tekna Drafting, Tekna Homes | Tekna owns subsidiaries |
| **No Group** | Gen2612 Pty Ltd, Co Invest Capital Pty Ltd, Co Invest Homes Pty Ltd | Standalone companies |

### SharePoint Folder Structure
```
/Corporate/
├── Team Harder Family Trust Group/
│   ├── Prov1322 Global Pty Ltd/
│   └── Team Harder Family Trust/
├── Team Harder Super Fund Group/
│   ├── Team Harder Pty Ltd/
│   └── Team Harder Super Fund/
├── Team Harder Super Investments Group/
│   ├── Team Harder Super Investments Pty Ltd/
│   └── W2G Assets Pty Ltd/
├── The Promise Group/
│   ├── The Promise QLD Pty Ltd/
│   └── The Promise Family Trust/
├── Tekna Group/
│   ├── Tekna Pty Ltd/
│   ├── Tekna Admin Pty Ltd/
│   ├── Tekna Drafting Pty Ltd/
│   └── Tekna Homes Pty Ltd/
└── No Group/
    ├── Gen2612 Pty Ltd/
    ├── Co Invest Capital Pty Ltd/
    └── Co Invest Homes Pty Ltd/
```

---

## Current State (WRONG - needs fixing)

### Current Company Groups in Database
| Group | Companies | Trusts | Superfunds | People |
|-------|-----------|--------|------------|--------|
| **Tekna** | 4 | 0 | 0 | 0 |
| **Team Harder** | 4 | 1 | 1 | 0 |
| **Team Harder Super Fund** | 1 | 0 | 0 | 0 |
| **Co Invest** | 2 | 0 | 0 | 0 |
| **The Promise** | 1 | 1 | 0 | 0 |
| **Personal** | 0 | 0 | 0 | 5 |

### Entity Types in `companies` table
- **Company** (12 records) - actual Pty Ltd companies
- **Trust** (2 records) - Team Harder Family Trust, The Promise Family Trust
- **Superfund** (1 record) - Team Harder Super Fund
- **Person** (5 records) - Robert, Rachel, Jared, Sophie, Grace Harder

### People Data Duplication Problem
The same people exist in **two places**:

1. **`companies` table** (entity_type='Person') - 5 records in "Personal" group
2. **`contacts` table** - 812 records, including duplicates:
   - "Rachel Harder" vs "Rachel Anne Harder"
   - "Robert Harder" (2 records!) vs "Robert John Harder"
   - "Sophie Harder" vs "Sophie Mee-jeong Harder"
   - etc.

### Current Relationships
- **Directors** → linked to `contacts` table (contact_id)
- **Shareholders** → polymorphic: `Contact` or `Company` (shareholder_type + shareholder_id)
- **Person entities in companies** → NOT linked to contacts (orphaned data)

---

## Proposed Solution

### Phase 1: Clean Up Company Groups

**Goal:** Groups should only contain Companies, Trusts, and Superfunds - NOT People

1. **Keep "Personal" group BUT rename to "Family"** (or remove entirely)
   - Option A: Rename to "Family" - used for linking family member documents
   - Option B: Remove - family documents linked via contact directly

2. **Final Group Structure:**
   | Group | Contains |
   |-------|----------|
   | Tekna | Tekna Pty Ltd, Tekna Admin, Tekna Drafting, Tekna Homes |
   | Team Harder | Team Harder Pty Ltd, Gen2612, Prov1322 Global, W2G Assets, Team Harder Family Trust, Team Harder Super Fund |
   | Team Harder Super Fund | Team Harder Super Investments Pty Ltd |
   | Co Invest | Co Invest Capital, Co Invest Homes |
   | The Promise | The Promise QLD Pty Ltd, The Promise Family Trust |
   | Family (optional) | For family member personal documents |

### Phase 2: Data Architecture for People

**FLEXIBLE MODEL - One Person, Multiple Roles:**

```
┌─────────────────────────────────────────────────────────────────┐
│                        CONTACTS TABLE                            │
│  (Single Source of Truth for ALL people)                        │
│                                                                 │
│  Basic Info:                                                    │
│  - id, full_name, email, mobile_phone                           │
│                                                                 │
│  Role Flags (flexible):                                         │
│  - is_family_member      (Harder family)                        │
│  - is_potential_director (could become director)                │
│  - is_shareholder        (owns shares - computed?)              │
│                                                                 │
│  Document Filing:                                               │
│  - company_group_id      (which group's folder for docs)        │
│  - folder_id             (OneDrive folder if has personal docs) │
└─────────────────────────────────────────────────────────────────┘
         │                    │                      │
         │                    │                      │
         ▼                    ▼                      ▼
┌──────────────┐   ┌──────────────────┐   ┌─────────────────────┐
│ SHAREHOLDINGS│   │ COMPANY_DIRECTORS│   │ DIRECTOR_ONBOARDING │
│              │   │                  │   │    (SENSITIVE)      │
│ - shares     │   │ - position       │   │ - passport/DL       │
│ - company    │   │ - appointed_date │   │ - DOB, birthplace   │
│              │   │ - is_current     │   │ - ID docs/photos    │
└──────────────┘   └──────────────────┘   └─────────────────────┘
```

**KEY PRINCIPLES:**
1. **Contacts = SSoT** for all people (suppliers, family, directors, shareholders)
2. **Flexible roles** - one person can be shareholder + director + family member
3. **Sensitive data** stays in Director Portal only
4. **Document filing** - via company_group_id link (where their docs live)

**Implementation:**

1. **Delete Person entities from `companies` table**
   - They duplicate contact data
   - Orphaned - not linked to anything

2. **Add to `contacts` table:**
   ```sql
   is_family_member        BOOLEAN DEFAULT false
   is_potential_director   BOOLEAN DEFAULT false
   company_group_id        BIGINT REFERENCES company_groups(id)
   ```

3. **Keep sensitive fields in `director_onboarding_requests` ONLY:**
   - Passport/DL images and numbers
   - DOB, birthplace details
   - Photo, consent tracking

4. **Clean up duplicate contacts:**
   - Merge "Rachel Harder" → "Rachel Anne Harder" (id: 2159)
   - Merge "Robert Harder" duplicates → "Robert John Harder" (id: 2160)
   - Merge "Sophie Harder" → "Sophie Mee-jeong Harder" (id: 2163)
   - Merge "Jared Sa-bin Harder" → "Jared Sa-Bin Harder" (id: 2161)
   - Merge "grace Harder" → proper capitalization
   - Merge "Andrew Clement" → "Andrew Mark Clement" (id: 2158)

**Examples:**

| Contact | is_family | is_potential_director | Shareholder? | Director? | Docs Folder |
|---------|-----------|----------------------|--------------|-----------|-------------|
| Rachel Anne Harder | ✓ | - | ✓ (several) | ✓ (several) | Team Harder |
| Andrew Mark Clement | - | - | ✓ | ✓ | Tekna |
| Jonno (Tekna shareholder) | - | ✓ | ✓ | - | - |
| Random Supplier | - | - | - | - | - |

### Phase 3: Family Member Documents

**Goal:** Family members can have personal documents (insurance, tax returns) linked to them

**Option A: Link via Company Group**
- Add `company_group_id` to contacts
- Family members belong to a group (e.g., "Team Harder")
- Documents filed under: `Team Harder/Personal/Robert Harder/Tax Returns/`

**Option B: Dedicated folder per family member**
- Each family contact has a SharePoint folder path
- Documents filed under: `Personal/Robert Harder/Tax Returns/`

**Option C: Use existing `drive_id` and `folder_id` on contacts**
- Already has these fields!
- Could store OneDrive/SharePoint folder reference

### Phase 4: Update UI

1. **ASIC Logins page** - Already filters to Company only ✅
2. **People/Contacts page** - Add "Family" filter
3. **Contact Detail page** - Show documents tab for family members
4. **Director info** - Displayed on company directors list

---

## Implementation Steps

### Step 1: Clean Up Groups (Database)
```sql
-- Move Trust and Superfund to correct groups (if needed)
-- Remove company_group_id from Person entities
UPDATE companies SET company_group_id = NULL WHERE entity_type = 'Person';

-- Delete Personal group
DELETE FROM company_groups WHERE name = 'Personal';
```

### Step 2: Merge Duplicate Contacts
```sql
-- For each duplicate, update all references then delete the old one
-- Example: Merge Rachel Harder (1319) → Rachel Anne Harder (2159)
UPDATE company_shareholdings SET shareholder_id = 2159
WHERE shareholder_type = 'Contact' AND shareholder_id = 1319;

DELETE FROM contacts WHERE id = 1319;
```

### Step 3: Delete Person Entities from Companies
```sql
-- After ensuring no references exist
DELETE FROM companies WHERE entity_type = 'Person';
```

### Step 4: Update Company Validity Check
- `entity_type` should only allow: 'Company', 'company', 'Trust', 'Superfund'
- Remove 'Person' as valid option

---

## Implementation Steps

### Step 1: Fix Company Groups in Database

**Delete old groups:**
- Personal
- Team Harder
- Co Invest

**Create/Rename groups:**
1. Team Harder Family Trust Group (NEW)
2. Team Harder Super Fund Group (rename from "Team Harder Super Fund")
3. Team Harder Super Investments Group (NEW)
4. The Promise Group (rename from "The Promise")
5. Tekna Group (rename from "Tekna")
6. No Group (NEW)

**Reassign companies:**
| Company | New Group |
|---------|-----------|
| Prov1322 Global Pty Ltd | Team Harder Family Trust Group |
| Team Harder Family Trust | Team Harder Family Trust Group |
| Team Harder Pty Ltd | Team Harder Super Fund Group |
| Team Harder Super Fund | Team Harder Super Fund Group |
| Team Harder Super Investments Pty Ltd | Team Harder Super Investments Group |
| W2G Assets Pty Ltd | Team Harder Super Investments Group |
| The Promise QLD Pty Ltd | The Promise Group |
| The Promise Family Trust | The Promise Group |
| Tekna Pty Ltd | Tekna Group |
| Tekna Admin Pty Ltd | Tekna Group |
| Tekna Drafting Pty Ltd | Tekna Group |
| Tekna Homes Pty Ltd | Tekna Group |
| Gen2612 Pty Ltd | No Group |
| Co Invest Capital Pty Ltd | No Group |
| Co Invest Homes Pty Ltd | No Group |

### Step 2: Fix People Architecture

1. **Add fields to contacts:**
   - `is_family_member` (boolean)
   - `is_potential_director` (boolean)

2. **Merge duplicate contacts:**
   - Rachel Harder → Rachel Anne Harder
   - Robert Harder (duplicates) → Robert John Harder
   - Sophie Harder → Sophie Mee-jeong Harder
   - etc.

3. **Delete Person entities from companies table**

4. **Remove sensitive fields from contacts** (keep in Director Portal only)

### Step 3: Validate Against Spreadsheet

- Final step: validate all shareholdings, groups, and company data against Corporate File spreadsheet

---

## Summary

| Current State | Proposed State |
|---------------|----------------|
| 6 wrong groups | 6 correct groups with "Group" suffix |
| People in 2 places (companies + contacts) | People only in contacts |
| Duplicate contacts | Clean, merged contacts |
| Person entities in companies table | Removed |
| Sensitive data scattered | Sensitive data only in Director Portal |
| No way to flag potential directors | `is_potential_director` field |
| No family member tracking | `is_family_member` field |
| Wrong shareholdings | Validated against spreadsheet |
