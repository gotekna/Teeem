# Xero Contact Sync - Complete Field Analysis

## Current Implementation Status

### ✅ Currently Synced Fields

| Xero Field | TEEEM Field | Type | Notes |
|------------|--------------|------|-------|
| ContactID | xero_id | string | Primary Xero identifier |
| Name | full_name | string | Contact display name |
| FirstName | first_name | string | |
| LastName | last_name | string | |
| EmailAddress | email | string | Primary email |
| TaxNumber | tax_number | string | ABN/ACN |
| Phones[MOBILE] | mobile_phone | string | |
| Phones[DEFAULT/DDI] | office_phone | string | |
| BankAccountDetails | bank_bsb, bank_account_number, bank_account_name | string | Parsed from formatted string |
| PurchaseDetails.AccountCode | default_purchase_account | string | |
| PaymentTerms.Bills.Day | bill_due_day | integer | |
| PaymentTerms.Bills.Type | bill_due_type | string | |
| Website | website | string | |

### ❌ Missing Xero Fields (Not Currently Synced)

#### 1. **Addresses** (Array) - CRITICAL MISSING
Xero supports multiple addresses per contact with these fields:
- AddressType: POBOX, STREET, DELIVERY
- AddressLine1, AddressLine2, AddressLine3, AddressLine4
- City
- Region (State)
- PostalCode
- Country
- AttentionTo

**Current TEEEM:** Only has single `address` text field

#### 2. **ContactPersons** (Array) - CRITICAL MISSING
Xero allows multiple people under one contact:
- FirstName
- LastName
- EmailAddress
- IncludeInEmails (boolean)

**Current TEEEM:** No support for multiple contact persons

#### 3. **ContactGroups** (Array) - MISSING
Xero contact group memberships:
- ContactGroupID
- Name
- Status

**Current TEEEM:** No contact groups

#### 4. **ContactNumber** - MISSING
Xero's internal reference number

**Current TEEEM:** No equivalent field

#### 5. **ContactStatus** - MISSING
Values: ACTIVE, ARCHIVED, GDPRREQUEST
**Current TEEEM:** Has `is_active` boolean but doesn't sync from Xero

#### 6. **AccountNumber** - MISSING
Optional account reference

**Current TEEEM:** No field

#### 7. **CompanyNumber** - MISSING
Company registration number (different from ABN)

**Current TEEEM:** No field

#### 8. **Phones** (Additional Types) - PARTIAL
Xero supports: DEFAULT, DDI, FAX, MOBILE
**Current TEEEM:** Only supports MOBILE and DEFAULT (as office_phone), missing FAX

#### 9. **PaymentTerms.Sales** - MISSING
We sync Bills but not Sales payment terms:
- Day
- Type

**Current TEEEM:** Only bill payment terms

#### 10. **Discount** - MISSING
Default discount percentage

**Current TEEEM:** No field

#### 11. **Balances** - READ-ONLY
- AccountsReceivable.Outstanding
- AccountsReceivable.Overdue
- AccountsPayable.Outstanding
- AccountsPayable.Overdue

**Current TEEEM:** No fields (these are calculated by Xero)

#### 12. **SalesDefaultAccountCode** - MISSING
Default sales account code

**Current TEEEM:** Has `default_purchase_account` but not sales

#### 13. **SalesTrackingCategories** - MISSING
Array of tracking category assignments for sales

**Current TEEEM:** No tracking categories

#### 14. **PurchaseTrackingCategories** - MISSING
Array of tracking category assignments for purchases

**Current TEEEM:** No tracking categories

#### 15. **BrandingThemeID** - MISSING
Default branding theme for invoices

**Current TEEEM:** No field

#### 16. **BatchPayments** - READ-ONLY
Batch payment settings

**Current TEEEM:** No field

---

## Recommended Implementation Priority

### Priority 1: MUST HAVE (Affects Data Integrity)

1. **Addresses Array**
   - Create `contact_addresses` table
   - Support STREET, POBOX, DELIVERY address types
   - Store structured address data (line1, line2, city, region, postal_code, country)
   - Migrate existing `address` text field data

2. **ContactPersons Array**
   - Create `contact_persons` table
   - Support multiple people per contact
   - Fields: first_name, last_name, email, include_in_emails
   - This is CRITICAL as user mentioned "if they have multiple people under 1 contact"

3. **ContactStatus**
   - Add `xero_contact_status` enum field
   - Sync from Xero to prevent syncing with archived contacts

### Priority 2: SHOULD HAVE (Business Value)

4. **ContactGroups**
   - Create `contact_groups` table and join table
   - Sync group memberships from Xero

5. **Additional Phone Types**
   - Add `fax_phone` field
   - Consider `phone_numbers` JSONB for flexibility

6. **Sales Payment Terms**
   - Add `sales_due_day` and `sales_due_type` fields
   - Mirror purchase payment terms structure

7. **Account Numbers**
   - Add `xero_contact_number` field
   - Add `xero_account_number` field
   - Add `company_number` field

### Priority 3: NICE TO HAVE

8. **Sales Default Account**
   - Add `default_sales_account` field

9. **Discount**
   - Add `default_discount` decimal field

10. **Tracking Categories**
    - Add JSONB fields for tracking categories
    - Consider if needed for TEEEM use case

11. **Balances** (Read-only)
    - Consider adding for display purposes
    - Never sync TO Xero, only FROM Xero

---

## Database Migration Plan

### Step 1: Create ContactPerson Model

```ruby
class CreateContactPersons < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_persons do |t|
      t.references :contact, null: false, foreign_key: true
      t.string :first_name
      t.string :last_name
      t.string :email
      t.boolean :include_in_emails, default: true
      t.boolean :is_primary, default: false
      t.string :xero_contact_person_id
      t.timestamps
    end

    add_index :contact_persons, :email
    add_index :contact_persons, :xero_contact_person_id
  end
end
```

### Step 2: Create ContactAddress Model

```ruby
class CreateContactAddresses < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_addresses do |t|
      t.references :contact, null: false, foreign_key: true
      t.string :address_type # STREET, POBOX, DELIVERY
      t.string :line1
      t.string :line2
      t.string :line3
      t.string :line4
      t.string :city
      t.string :region
      t.string :postal_code
      t.string :country
      t.string :attention_to
      t.boolean :is_primary, default: false
      t.timestamps
    end

    add_index :contact_addresses, :address_type
    add_index :contact_addresses, [:contact_id, :is_primary]
  end
end
```

### Step 3: Add Additional Contact Fields

```ruby
class AddXeroFieldsToContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :contacts, :xero_contact_number, :string
    add_column :contacts, :xero_contact_status, :string
    add_column :contacts, :xero_account_number, :string
    add_column :contacts, :company_number, :string
    add_column :contacts, :fax_phone, :string
    add_column :contacts, :default_sales_account, :string
    add_column :contacts, :default_discount, :decimal, precision: 5, scale: 2
    add_column :contacts, :sales_due_day, :integer
    add_column :contacts, :sales_due_type, :string

    # Balances (read-only from Xero)
    add_column :contacts, :accounts_receivable_outstanding, :decimal, precision: 15, scale: 2
    add_column :contacts, :accounts_receivable_overdue, :decimal, precision: 15, scale: 2
    add_column :contacts, :accounts_payable_outstanding, :decimal, precision: 15, scale: 2
    add_column :contacts, :accounts_payable_overdue, :decimal, precision: 15, scale: 2

    add_index :contacts, :xero_contact_number
    add_index :contacts, :xero_contact_status
  end
end
```

### Step 4: Create ContactGroup Model

```ruby
class CreateContactGroups < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_groups do |t|
      t.string :xero_contact_group_id, null: false
      t.string :name, null: false
      t.string :status # ACTIVE, DELETED
      t.timestamps
    end

    create_table :contact_group_memberships do |t|
      t.references :contact, null: false, foreign_key: true
      t.references :contact_group, null: false, foreign_key: true
      t.timestamps
    end

    add_index :contact_groups, :xero_contact_group_id, unique: true
    add_index :contact_group_memberships, [:contact_id, :contact_group_id],
              unique: true, name: 'index_contact_groups_uniqueness'
  end
end
```

---

## Frontend Changes Required

### 1. Contact Detail Page Updates

#### Add Multiple Contact Persons Section
- Display all contact persons in a table/list
- Add/Edit/Delete contact persons
- Mark one as primary
- Sync status indicator per person

#### Add Multiple Addresses Section
- Display STREET, POBOX, DELIVERY addresses
- Add/Edit/Delete addresses
- Mark one as primary
- Sync status indicator per address

#### Update Existing Sections
- Add fax phone field
- Add sales payment terms fields
- Add company number field
- Add Xero contact number (read-only)
- Add contact status display
- Add account balance displays (read-only)

### 2. Contact Edit Modal/Inline Editing
- Support editing nested structures (persons, addresses)
- Maintain sync status for each sub-entity

---

## Sync Job Updates

### Update `XeroContactSyncJob`

1. **Parse ContactPersons array from Xero**
   - Create/update ContactPerson records
   - Handle deletions (persons removed in Xero)

2. **Parse Addresses array from Xero**
   - Create/update ContactAddress records
   - Handle multiple address types
   - Migrate existing address text to STREET address

3. **Sync TO Xero**
   - Build ContactPersons array in payload
   - Build Addresses array in payload

4. **Handle new fields**
   - ContactStatus, ContactNumber, etc.

---

## API Changes

### Update `contacts_controller.rb`

Add permitted params for nested attributes:
```ruby
def contact_params
  params.require(:contact).permit(
    # existing fields...
    :xero_contact_number,
    :xero_contact_status,
    :xero_account_number,
    :company_number,
    :fax_phone,
    :default_sales_account,
    :default_discount,
    :sales_due_day,
    :sales_due_type,
    contact_persons_attributes: [:id, :first_name, :last_name, :email, :include_in_emails, :is_primary, :_destroy],
    contact_addresses_attributes: [:id, :address_type, :line1, :line2, :line3, :line4, :city, :region, :postal_code, :country, :attention_to, :is_primary, :_destroy]
  )
end
```

---

## Testing Plan

1. Test syncing FROM Xero with multiple contact persons
2. Test syncing FROM Xero with multiple addresses
3. Test syncing TO Xero with new structures
4. Test data migration from old address field to new table
5. Test UI for adding/editing/deleting persons and addresses
6. Test inline editing for all new fields

---

## Migration Strategy

1. Create new tables (ContactPerson, ContactAddress, ContactGroup)
2. Add new fields to contacts table
3. Migrate existing `address` text field to ContactAddress (type: STREET)
4. Update models with associations
5. Update sync job to handle new structures
6. Update API controller with new permitted params
7. Update frontend to display and edit new structures
8. Test thoroughly in development
9. Deploy backend changes
10. Deploy frontend changes

---

## Estimated Complexity

- **Database Migrations**: 2-3 hours
- **Model Updates**: 1-2 hours
- **Sync Job Updates**: 4-6 hours (most complex part)
- **API Controller Updates**: 1 hour
- **Frontend Updates**: 6-8 hours (multiple sections)
- **Testing**: 3-4 hours
- **Total**: 17-24 hours

---

## Questions for User

1. Do you want to support ALL contact persons from Xero, or just the primary one?
2. Should we migrate existing address data to the new structure automatically?
3. Do you need contact groups functionality?
4. Do you want to display account balances (read-only) from Xero?
5. Should fax numbers be editable in TEEEM, or just displayed from Xero?
