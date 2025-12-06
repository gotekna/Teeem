# Contact Fields Audit - Available vs. Displayed

**Date:** 2025-12-07
**Purpose:** Identify which Contact fields are available in the database but not visible in the UI

---

## Summary

**Total Database Columns:** 93 fields
**TypeScript Interface Fields:** 40+ fields (frontend-facing)
**Currently Displayed:** ~30 fields across all tabs

**Hidden/Not Displayed:** ~15-20 fields that could be useful

---

## Fields by Category

### ✅ Currently Displayed (Overview Tab)

**Basic Information:**
- `first_name`, `middle_name`, `last_name`, `full_name`
- `entity_type` (person/company/trust/sole_trader)
- `is_active`, `is_family_member`

**Contact Details:**
- `contact_emails[]` (multiple emails with labels)
- `contact_phones[]` (multiple phones with labels)
- `website`

**Address:**
- `address`, `city`, `state`, `postcode`

**Business Details:**
- `tax_number` (ABN/TFN)
- `company_number` (ACN)
- `supplier_code`

**Notes:**
- `notes`

**Relationships:**
- `primary_company` (for persons)
- `employees[]` (for companies)
- `director_companies[]`
- `additional_companies[]`

**Xero:**
- `xero_contact_id`, `xero_contact_types[]`
- `sync_with_xero`

**Bank Details (Financial Tab):**
- `bank_bsb`, `bank_account_number`, `bank_account_name`

**Bills (Financial Tab):**
- External invoices via XeroInvoicesList component

**Jobs (Financial Tab):**
- Related jobs

**Purchase Orders (Financial Tab):**
- Purchase orders for suppliers

---

## ⚠️ Available But NOT Currently Displayed

### High Priority (Should Consider Adding)

#### **Contact Information**
- `fax_phone` - Still used by some businesses
- `lgas` - Local Government Areas (array) - Useful for regional filtering

#### **Director/Person Details** (Director Tab Exists But Limited)
- `director_id` - Director identification number
- `date_of_birth` - DOB
- `place_of_birth` - Birth location
- `birth_state`, `birth_country` - Birth state/country
- `residential_address` - Separate from business address
- `drivers_licence` - Driver's license number
- `passport_number` - Passport
- `tfn` - Tax File Number (sensitive!)
- `photo_url` - Profile photo

#### **Company/Business**
- `company_name_or_trust` - Alternative company name field
- `company_group_id` - Link to company group
- `city`, `state`, `postcode` - SEPARATE from `address` field

#### **Financial/Accounting**
- `default_purchase_account` - Xero account code for purchases
- `default_sales_account` - Xero account code for sales
- `default_discount` - Default discount percentage
- `bill_due_day`, `bill_due_type` - Bill payment terms
- `sales_due_day`, `sales_due_type` - Sales payment terms
- `accounts_receivable_outstanding` - AR balance
- `accounts_receivable_overdue` - Overdue AR
- `accounts_payable_outstanding` - AP balance
- `accounts_payable_overdue` - Overdue AP
- `xero_account_number` - Xero account number
- `xero_contact_number` - Xero contact number
- `xero_contact_status` - Status in Xero

#### **Xero Integration**
- `xero_id` - Xero tenant ID
- `xero_invoice_count` - Count of invoices
- `xero_disconnect` - Disconnect flag
- `xero_synced` - Last sync status
- `last_synced_at` - Last Xero sync time
- `xero_sync_error` - Sync error message

#### **ABN/Entity Verification**
- `abn_valid` - ABN validity flag
- `abn_entity_name` - Entity name from ABN lookup
- `abn_entity_type` - Entity type from ABN
- `abn_gst_registered` - GST registration status
- `abn_verified_at` - When ABN was verified

#### **System/Internal**
- `sys_type_id` - System type ID
- `deleted` - Soft delete flag
- `parent_id`, `parent` - Hierarchical structure
- `drive_id`, `folder_id` - OneDrive integration
- `branch` - Branch location
- `contact_region_id`, `contact_region` - Region assignment

#### **Portal/External**
- `portal_enabled` - Customer portal access
- `link_to_cg` - Link to company group
- `linked_company_id` - Linked company

#### **Rating/Performance**
- `rating` - Contact rating
- `teeem_rating` - TEEEM internal rating
- `total_ratings_count` - Number of ratings
- `response_rate` - Response rate percentage
- `avg_response_time` - Average response time

#### **Employment (Person)**
- `primary_role` - Primary job role
- `employment_status` - Employment status
- `employment_start_date` - Start date
- `position`, `department` - Job position/department

#### **Counts (From Associations)**
- `jobs_count` - Number of jobs
- `purchase_orders_count` - Number of POs
- `quotes_count` - Number of quotes
- `xero_invoice_count` - Number of Xero invoices

---

## 🔍 Fields by Tab (Current UI)

### **Overview Tab**
- Basic info, contact details, address, notes
- Company/employee relationships
- Entity type selector

### **Director Tab**
- Director verification
- ID documents
- **Missing:** DOB, birth details, residential address, photo

### **Xero Tab**
- Xero sync status
- Invoice/bill stats
- **Missing:** Xero account details, sync errors, contact number

### **Financial Tab**
**Sub-tabs:**
- **Bank Details:** BSB, account number, account name
  - **Missing:** Default accounts, payment terms, discount
- **Xero:** Xero transactions summary
- **Bills:** Bills from warehouse (if supplier)
- **Jobs:** Related jobs
- **Purchase Orders:** POs for supplier

**Missing Financial Fields:**
- Accounts receivable/payable balances
- Payment terms (bill_due_day, sales_due_day)
- Default discount
- Default purchase/sales accounts

### **Groups Tab**
- Contact group memberships
- Contact persons

### **Tables Tab**
- Related table data

### **Companies Tab** (For persons)
- Company relationships with roles
- **Working well**

### **Employees Tab** (For companies)
- Employee list with roles
- **Working well**

---

## 📋 Recommendations

### Immediate Improvements

#### 1. **Add Financial Summary Card to Financial Tab**
Show AR/AP balances:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Financial Summary</CardTitle>
  </CardHeader>
  <CardContent>
    <div className="space-y-2">
      <div className="flex justify-between">
        <span>Accounts Receivable Outstanding:</span>
        <span className="font-medium">${contact.accounts_receivable_outstanding}</span>
      </div>
      <div className="flex justify-between">
        <span>Accounts Receivable Overdue:</span>
        <span className="font-medium text-red-600">${contact.accounts_receivable_overdue}</span>
      </div>
      <div className="flex justify-between">
        <span>Accounts Payable Outstanding:</span>
        <span className="font-medium">${contact.accounts_payable_outstanding}</span>
      </div>
      <div className="flex justify-between">
        <span>Accounts Payable Overdue:</span>
        <span className="font-medium text-red-600">${contact.accounts_payable_overdue}</span>
      </div>
    </div>
  </CardContent>
</Card>
```

#### 2. **Enhance Director Tab**
Add missing personal details:
- Date of Birth
- Place of Birth (city, state, country)
- Residential Address (separate from business)
- Photo upload/display

#### 3. **Add Payment Terms to Financial Tab**
Show under Bank Details:
- Bill Payment Terms: `{bill_due_day} days ({bill_due_type})`
- Sales Payment Terms: `{sales_due_day} days ({sales_due_type})`
- Default Discount: `{default_discount}%`

#### 4. **Add ABN Verification Status**
Show in Overview or Financial tab:
```tsx
{contact.tax_number && (
  <div className="space-y-2">
    <Label>ABN Verification</Label>
    <div className="p-3 border rounded">
      <div className="flex items-center justify-between">
        <span>ABN: {formatABN(contact.tax_number)}</span>
        {contact.abn_valid ? (
          <Badge variant="success">Verified</Badge>
        ) : (
          <Badge variant="warning">Unverified</Badge>
        )}
      </div>
      {contact.abn_entity_name && (
        <p className="text-sm text-muted-foreground mt-1">
          Entity: {contact.abn_entity_name} ({contact.abn_entity_type})
        </p>
      )}
      {contact.abn_gst_registered && (
        <p className="text-xs text-green-600 mt-1">GST Registered</p>
      )}
      {contact.abn_verified_at && (
        <p className="text-xs text-muted-foreground mt-1">
          Verified: {formatDate(contact.abn_verified_at)}
        </p>
      )}
    </div>
  </div>
)}
```

#### 5. **Add Stats Summary to Overview**
Show key counts:
- Jobs: {jobs_count}
- Purchase Orders: {purchase_orders_count}
- Quotes: {quotes_count}
- Xero Invoices: {xero_invoice_count}

### Medium Priority

#### 6. **Add System Info Card** (Admin/Debug)
For debugging, show:
- Created: {created_at}
- Updated: {updated_at}
- Last Synced: {last_synced_at}
- Sync Error: {xero_sync_error}

#### 7. **Add Regional Info**
- LGAs: Show list of local government areas
- Contact Region: {contact_region}
- Branch: {branch}

### Low Priority

#### 8. **Portal Access Indicator**
Show if portal_enabled

#### 9. **Rating Display**
Show contact ratings if used

---

## 🎯 High-Impact Missing Fields

These fields would provide the most value if displayed:

1. **AR/AP Balances** - Critical for financial management
2. **Payment Terms** - Important for billing/invoicing
3. **ABN Verification Status** - Trust/compliance indicator
4. **Date of Birth** (for directors) - Required for director verification
5. **Residential Address** - Different from business address for directors
6. **Default Discount** - Affects pricing
7. **Xero Sync Status** - Debugging integration issues
8. **Photo** - Visual identification

---

## 📊 Field Coverage Analysis

**Well Covered Categories:**
- ✅ Basic contact information
- ✅ Relationships (companies/employees)
- ✅ Bank details
- ✅ Bills/invoices (via warehouse)
- ✅ Jobs and POs

**Poorly Covered Categories:**
- ❌ Financial balances (AR/AP)
- ❌ Payment terms and defaults
- ❌ ABN verification details
- ❌ Director personal details (DOB, birth info, residential address)
- ❌ Xero integration details (sync errors, account numbers)
- ❌ Regional/branch information
- ❌ Performance metrics (ratings, response times)

---

## Implementation Priority

### Phase 1: Financial (High Business Value)
1. Add AR/AP balance summary
2. Add payment terms
3. Add default discount

### Phase 2: Compliance (High Trust Value)
1. Add ABN verification status
2. Add director DOB and birth details
3. Add residential address

### Phase 3: Integration (High Debug Value)
1. Add Xero sync status and errors
2. Add last sync timestamp
3. Add Xero account details

### Phase 4: Optional Enhancements
1. Add regional/LGA info
2. Add photos
3. Add ratings/performance metrics

---

**Next Steps:**
1. Review this audit with Rob
2. Prioritize which fields to add
3. Create tickets for implementation
4. Update Contact interface if needed
5. Add backend API endpoints if fields not returned

**Files to Modify:**
- `frontend-next/app/(app)/contacts/[id]/page.tsx` - Add field displays
- Backend contacts API - Ensure fields are returned
- TypeScript Contact interface - Add any missing types
