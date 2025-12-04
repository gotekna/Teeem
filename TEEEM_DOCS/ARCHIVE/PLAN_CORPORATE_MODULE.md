# Corporate Module Implementation Plan

## Summary of Requirements (from Q&A Session)

Based on the Corporate File spreadsheet and user discussion:

### Data Model Decisions
| Decision | Choice | Notes |
|----------|--------|-------|
| Directors | Use Contacts | Add DOB, place of birth, drivers licence, Directors ID to contacts |
| Shareholders | Use Contacts | Companies as shareholders = Contacts with contact_type='company' |
| Trusts | Are Companies | Companies with is_trustee=true, trust_name field |
| Company Groups | Separate table | Group-level settings (shared COA, addresses, compliance rules) |
| Document Types | Database configurable | document_types table, manageable via UI |
| Inter-company Loans | New Loans table | Track lender, borrower, amount, documents |
| Company Register | Enhance CompanyDocuments | Add folder, manual/electronic, filed_by fields |
| Xero COA | Track standard accounts | Ensure consistency across grouped companies |

### Additional Features Required
1. **ASIC API Integration** - Pull company details, directors, review dates automatically
2. **Share Transfer Tracking** - History of share movements between shareholders
3. **Dividend Tracking** - Declarations, amounts, franking, payment dates
4. **Compliance Calendar** - Dashboard of upcoming dates across all companies
5. **Minute Templates** - Generate corporate minutes from templates (registered office change, trust distribution, etc.)
6. **OneDrive Document Integration** - Rename and organise existing documents to standard folder structure

---

## Data Import Plan

### Source: Corporate File.xlsx
Import data from the spreadsheet in this order:

1. **Company Groups** - Create from unique groups in "All Companies" sheet
2. **Directors (as Contacts)** - Import from "Director Details" sheet with DOB, address, TFN
3. **Companies** - Import from individual company sheets (Template format)
4. **Shareholdings** - Import from "Current Shareholdings" section of each company sheet
5. **Bank Accounts** - Import from "Bank Accounts" sheet
6. **Document Types** - Import from "Document Type" sheet

### OneDrive Document Organisation

**Standard Folder Structure per Company:**
```
/{Company Abbreviation} - {Company Name}/
├── Loans and Security/
│   ├── Loan Agreement/
│   ├── Security Deed/
│   └── PPSR/
├── Company Setup/
├── Constitution/
├── Register of Members/
├── Structure/
├── Assets/
├── Minutes/
├── BAS/
└── General/
    ├── Solvency ASIC/
    ├── ATO Tax Return/
    ├── Dividends/
    ├── EOY ATO/
    ├── ASIC Docs/
    ├── ATO Docs/
    ├── Officers/
    ├── Bank Statements/
    ├── Distribution/
    └── EOY ASIC/
```

**Document Naming Convention:**
`{YYYY-MM-DD} - {Document Type} - {Description}.{ext}`

Example: `2024-06-30 - ATO Tax Return - FY2024.pdf`

---

## Database Schema Changes

### 1. New Tables

#### `company_groups`
```ruby
create_table :company_groups do |t|
  t.string :name, null: false                    # "Tekna", "Team Harder", etc.
  t.text :description
  t.string :default_registered_office            # Shared registered office address
  t.string :default_principal_place              # Shared principal place of business
  t.string :default_accountant                   # Group accountant name
  t.string :default_accountant_contact           # Accountant email/phone
  t.boolean :active, default: true
  t.timestamps
end
```

#### `company_shareholdings`
```ruby
create_table :company_shareholdings do |t|
  t.references :company, null: false, foreign_key: true
  t.references :shareholder, null: false, foreign_key: { to_table: :contacts }
  t.string :share_class, default: 'ordinary'     # ordinary, preference, etc.
  t.integer :number_of_shares, null: false
  t.boolean :beneficially_held, default: false
  t.string :beneficial_owner                     # Trust name if beneficially held
  t.date :acquired_date
  t.text :notes
  t.timestamps
end
```

#### `share_transfers`
```ruby
create_table :share_transfers do |t|
  t.references :company, null: false, foreign_key: true
  t.references :from_shareholder, foreign_key: { to_table: :contacts }
  t.references :to_shareholder, null: false, foreign_key: { to_table: :contacts }
  t.string :share_class, default: 'ordinary'
  t.integer :number_of_shares, null: false
  t.decimal :consideration, precision: 12, scale: 2  # Amount paid
  t.date :transfer_date, null: false
  t.string :document_reference                   # Link to transfer document
  t.text :notes
  t.timestamps
end
```

#### `company_loans`
```ruby
create_table :company_loans do |t|
  t.references :lender_company, null: false, foreign_key: { to_table: :companies }
  t.references :borrower_company, null: false, foreign_key: { to_table: :companies }
  t.decimal :principal_amount, precision: 12, scale: 2, null: false
  t.decimal :current_balance, precision: 12, scale: 2
  t.decimal :interest_rate, precision: 5, scale: 2  # e.g., 5.50%
  t.string :interest_type                        # fixed, variable, interest-free
  t.date :loan_date
  t.date :maturity_date
  t.boolean :loan_documents_in_place, default: false
  t.string :security_type                        # unsecured, mortgage, ppsr
  t.string :status, default: 'active'            # active, repaid, written_off
  t.text :notes
  t.timestamps
end
```

#### `dividends`
```ruby
create_table :dividends do |t|
  t.references :company, null: false, foreign_key: true
  t.date :declaration_date, null: false
  t.date :record_date                            # Who is entitled
  t.date :payment_date
  t.decimal :total_amount, precision: 12, scale: 2, null: false
  t.decimal :franking_percentage, precision: 5, scale: 2, default: 0
  t.string :dividend_type                        # interim, final, special
  t.string :status, default: 'declared'          # declared, paid, cancelled
  t.text :notes
  t.timestamps
end
```

#### `dividend_payments`
```ruby
create_table :dividend_payments do |t|
  t.references :dividend, null: false, foreign_key: true
  t.references :shareholder, null: false, foreign_key: { to_table: :contacts }
  t.integer :shares_held                         # At record date
  t.decimal :gross_amount, precision: 12, scale: 2
  t.decimal :franking_credit, precision: 12, scale: 2
  t.decimal :net_amount, precision: 12, scale: 2
  t.date :paid_date
  t.string :payment_method                       # bank_transfer, cheque
  t.timestamps
end
```

#### `document_types`
```ruby
create_table :document_types do |t|
  t.string :name, null: false                    # "Loan Agreement", "Constitution", etc.
  t.string :folder                               # "Loans and Security", "General", etc.
  t.text :description
  t.string :category                             # corporate, tax, compliance
  t.boolean :requires_filing, default: false     # Must be filed with ASIC?
  t.integer :retention_years                     # How long to keep
  t.boolean :active, default: true
  t.timestamps
end
```

#### `minute_templates`
```ruby
create_table :minute_templates do |t|
  t.string :name, null: false                    # "Registered Office Change"
  t.string :template_type                        # company, trust, general
  t.text :body                                   # Template content with placeholders
  t.text :required_fields                        # JSON: fields needed to generate
  t.boolean :active, default: true
  t.timestamps
end
```

#### `company_minutes`
```ruby
create_table :company_minutes do |t|
  t.references :company, null: false, foreign_key: true
  t.references :minute_template, foreign_key: true
  t.string :title, null: false
  t.date :meeting_date, null: false
  t.text :content                                # Generated/edited content
  t.string :status, default: 'draft'             # draft, approved, signed, filed
  t.date :signed_date
  t.string :signed_by                            # Names of signatories
  t.string :document_path                        # Path to PDF if generated
  t.timestamps
end
```

#### `xero_chart_of_accounts`
```ruby
create_table :xero_chart_of_accounts do |t|
  t.references :company_group, foreign_key: true  # Group-level standard COA
  t.string :account_code, null: false            # "101", "121", etc.
  t.string :account_name, null: false            # "Bank", "WIP - Construction"
  t.string :account_type                         # Bank, Current Asset, Revenue, etc.
  t.string :tax_type                             # GST on Income, BAS Excluded, etc.
  t.text :description
  t.boolean :active, default: true
  t.timestamps
end
```

### 2. Modify Existing Tables

#### `companies` - Add columns
```ruby
add_column :companies, :company_group_id, :bigint
add_column :companies, :shares_on_issue, :integer
add_column :companies, :purpose, :text
add_column :companies, :abbreviation, :string        # Short code like "TPQ"
add_column :companies, :accounting_method, :string   # cash, accrual (already exists)
add_foreign_key :companies, :company_groups
```

#### `contacts` - Add director fields
```ruby
add_column :contacts, :date_of_birth, :date
add_column :contacts, :place_of_birth, :string
add_column :contacts, :birth_state, :string
add_column :contacts, :birth_country, :string
add_column :contacts, :drivers_licence, :string
add_column :contacts, :director_id, :string          # ASIC Director ID number
add_column :contacts, :residential_address, :text
# TFN already exists via encryption
```

#### `company_documents` - Add register fields
```ruby
add_column :company_documents, :folder, :string
add_column :company_documents, :storage_type, :string   # manual, electronic, both
add_column :company_documents, :filed_by, :string
add_column :company_documents, :document_type_id, :bigint
add_foreign_key :company_documents, :document_types
```

#### `company_compliance_items` - Add recurring support
```ruby
add_column :company_compliance_items, :recurrence, :string   # annual, quarterly, monthly
add_column :company_compliance_items, :asic_related, :boolean, default: false
add_column :company_compliance_items, :ato_related, :boolean, default: false
```

---

## Backend Implementation

### Models to Create
1. `CompanyGroup` - has_many :companies, has_many :xero_chart_of_accounts
2. `CompanyShareholding` - belongs_to :company, :shareholder (Contact)
3. `ShareTransfer` - belongs_to :company, :from_shareholder, :to_shareholder
4. `CompanyLoan` - belongs_to :lender_company, :borrower_company
5. `Dividend` - belongs_to :company, has_many :dividend_payments
6. `DividendPayment` - belongs_to :dividend, :shareholder
7. `DocumentType` - has_many :company_documents
8. `MinuteTemplate` - has_many :company_minutes
9. `CompanyMinute` - belongs_to :company, :minute_template
10. `XeroChartOfAccount` - belongs_to :company_group

### Controllers/API Endpoints
```
/api/v1/company_groups          # CRUD for company groups
/api/v1/company_shareholdings   # CRUD for shareholdings
/api/v1/share_transfers         # CRUD + history view
/api/v1/company_loans           # CRUD for inter-company loans
/api/v1/dividends               # CRUD + payment tracking
/api/v1/document_types          # CRUD for document types
/api/v1/minute_templates        # CRUD for templates
/api/v1/company_minutes         # CRUD + PDF generation
/api/v1/xero_chart_of_accounts  # Standard COA management
/api/v1/compliance_calendar     # Dashboard data
/api/v1/asic/lookup             # ASIC API integration
```

### Services to Create
1. `AsicLookupService` - Integrate with ASIC/ABR API
2. `MinuteGeneratorService` - Generate minutes from templates
3. `ComplianceCalendarService` - Aggregate compliance dates
4. `DividendCalculatorService` - Calculate per-shareholder amounts

---

## Frontend Implementation

### New Pages
1. **Company Groups Page** - `/corporate/groups` - Manage company groups
2. **Compliance Calendar** - `/corporate/calendar` - Calendar view of all compliance dates
3. **Minute Templates** - `/corporate/minute-templates` - Manage templates
4. **Xero COA** - `/corporate/chart-of-accounts` - Manage standard COA

### Enhanced Company Detail Tabs
1. **Shareholdings Tab** - View/edit shareholders, share transfers history
2. **Loans Tab** - View/edit loans to/from other companies
3. **Dividends Tab** - Dividend declarations and payment history
4. **Minutes Tab** - Generate and manage corporate minutes
5. **Documents Tab** (enhanced) - With document types and folder organisation

### New Components
1. `ShareholdingTable` - TeeemTableView for shareholdings
2. `ShareTransferModal` - Record share transfers
3. `LoanTable` - TeeemTableView for inter-company loans
4. `DividendTable` - TeeemTableView for dividends
5. `DividendPaymentModal` - Record dividend payments
6. `MinuteGenerator` - Select template, fill fields, generate PDF
7. `ComplianceCalendarView` - Calendar component with company filters
8. `AsicLookupButton` - Fetch data from ASIC API

---

## ASIC API Integration

### Data Sources
1. **ABN Lookup** (Free) - https://abr.business.gov.au/json/
   - Validate ABN/ACN
   - Get company name, status, GST registration

2. **ASIC Connect API** (Paid) - For detailed company data
   - Directors and secretaries
   - Registered office
   - Share structure
   - Annual review dates

### Implementation Approach
1. Start with free ABN Lookup for validation
2. Add ASIC Connect integration when API access is obtained
3. Store credentials securely (encrypted)
4. Cache responses to reduce API calls

---

## Implementation Phases

### Phase 1: Foundation (Database & Core Models)
1. Create migrations for all new tables
2. Create all new models with associations
3. Modify existing models (Company, Contact, CompanyDocument)
4. Seed document_types with the 21 types from spreadsheet
5. Create company_groups and migrate existing company_group field

### Phase 2: Core API
1. Create controllers for all new endpoints
2. Implement CRUD operations
3. Add serializers for JSON responses
4. Write request specs for all endpoints

### Phase 3: Frontend - Company Detail Enhancement
1. Add Shareholdings tab with table and transfer modal
2. Add Loans tab with table and form
3. Add Dividends tab with table and payment modal
4. Enhance Documents tab with document types and folders
5. Add Minutes tab with generation

### Phase 4: Compliance Calendar
1. Create ComplianceCalendarService
2. Build calendar view component
3. Add filtering by company/group
4. Add notification/reminder system

### Phase 5: ASIC Integration
1. Implement ABN Lookup service
2. Add "Lookup" button to company form
3. Auto-populate fields from ASIC data
4. Add ASIC Connect integration (when available)

### Phase 6: Minute Templates
1. Create minute template management UI
2. Implement template engine with placeholders
3. Add PDF generation
4. Integrate with company detail page

---

## Data Migration from Spreadsheet

### Import Script Tasks
1. Import company groups (Tekna, Team Harder, Promise, Charity)
2. Import/update companies from "All Companies" sheet
3. Import directors from "Director Details" sheet (as Contacts)
4. Import bank accounts from "Bank Accounts" sheet
5. Import document types from "Document Type" sheet
6. Import shareholdings from individual company sheets
7. Import Xero COA from "XERO Account Numbers" sheet

---

## Estimated Effort

| Phase | Description | Complexity |
|-------|-------------|------------|
| Phase 1 | Database & Models | Medium |
| Phase 2 | Core API | Medium |
| Phase 3 | Frontend Tabs | High |
| Phase 4 | Compliance Calendar | Medium |
| Phase 5 | ASIC Integration | Medium-High |
| Phase 6 | Minute Templates | Medium |

---

## Questions/Decisions Resolved

1. Directors = Contacts with extra fields
2. Shareholders = Contacts (companies as contacts with type='company')
3. Trusts = Companies with is_trustee=true
4. Document types = Database table, configurable via UI
5. Company groups = Separate table with group-level settings
6. Loans = New table tracking inter-company loans
7. Xero COA = Track at group level for consistency
8. ASIC = Full API integration planned
9. Minutes = Generate from templates with PDF output
10. Share transfers = Track history
11. Dividends = Track with per-shareholder payments
12. Compliance calendar = Dashboard view with reminders
