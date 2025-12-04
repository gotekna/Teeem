# SharePoint Folder Structure & Document Naming Plan

**Created:** 2024-11-30
**Source of Truth:** https://teeemrob.vercel.app/corporate/tab-structure#_God_LOVES_You_

---

## Corporate Files Location

| File | Path | Size | Last Modified |
|------|------|------|---------------|
| Root Corporate File | `/Users/robertharder/GitHub/teeem/Corporate File.xlsx` | 264KB | Nov 13 |
| Backend Corporate File | `/Users/robertharder/GitHub/teeem/backend/Corporate File.xlsx` | 267KB | Nov 30 |

**Key Difference:** Backend version has `Sheet3` with company codes/abbreviations.

---

## Goal

Create folder structure in SharePoint `00 - Private` that:
1. Matches the 18 UI tabs exactly
2. Uses correct naming conventions for all 56 document types
3. Links each tab directly to its SharePoint folder
4. Supports multi-tab documents (stored once, shown in multiple tabs)

---

## UI Tabs (18 Total)

### 14 Primary Tabs
1. ADVICE
2. ASIC
3. ASSETS
4. ATO
5. BANK
6. COMPANY
7. DIVIDENDS
8. FINANCIALS
9. GENERAL
10. INSURANCE
11. LOANS
12. MINUTES
13. REGISTRY
14. TRUST

### 4 ASSETS Sub-Tabs
15. Disposal
16. Expenses
17. Purchases
18. Valuation

---

## SharePoint Folder Structure

```
00 - Private/
├── [Company Group Name]/
│   ├── [CODE - Company Name]/
│   │   ├── ADVICE/
│   │   ├── ASIC/
│   │   ├── ASSETS/
│   │   │   ├── Disposal/
│   │   │   ├── Expenses/
│   │   │   ├── Purchases/
│   │   │   └── Valuation/
│   │   ├── ATO/
│   │   ├── BANK/
│   │   ├── COMPANY/
│   │   ├── DIVIDENDS/
│   │   ├── FINANCIALS/
│   │   ├── GENERAL/
│   │   ├── INSURANCE/
│   │   ├── LOANS/
│   │   ├── MINUTES/
│   │   ├── REGISTRY/
│   │   └── TRUST/
```

**Total: 18 folders per company** (14 primary + 4 ASSETS subfolders)

---

## Complete Document Types (56)

### ADVICE Tab (3 types)
| ID | Document Type | Folder | Naming Format |
|----|--------------|--------|---------------|
| 69 | AA - Accountant Advice | ADVICE | `{CompanyCode} AA {Description} {Date}` |
| 68 | CA - Client Advice | ADVICE | `{CompanyCode} CA {Description} {Date}` |
| 70 | LA - Legal Advice | ADVICE | `{CompanyCode} LA {Description} {Date}` |

### ASIC Tab (6 types)
| ID | Document Type | Folder | Naming Format |
|----|--------------|--------|---------------|
| 24 | ASIC Annual Review | ASIC | `{CompanyCode} ASIC Annual Review FY{YY}` |
| 17 | ASIC Documents | ASIC | `{CompanyCode} ASIC {Description} {Date}` |
| 21 | ASIC Form 484 - Director Changes | ASIC | `{CompanyCode} Form 484 Directors {Date}` |
| 27 | ASIC Form 484 - Registered Office | ASIC | `{CompanyCode} Form 484 Reg Office {Date}` |
| 5 | Company Setup | ASIC | `{CompanyCode} Setup {Document} {Date}` |
| 20 | Corporate Key | ASIC | `{CompanyCode} Corporate Key {Date}` |

### ASSETS Tab (9 types)
| ID | Document Type | Folder | Naming Format |
|----|--------------|--------|---------------|
| 9 | Asset | ASSETS | `{CompanyCode} {AssetCode} {Description} {Date}` |
| 66 | Disposal | Disposal | `{CompanyCode} {AssetCode} Disposal {Date}` |
| 64 | Expenses | Expenses | `{CompanyCode} {AssetCode} Expenses {Date}` |
| 65 | Purchases | Purchases | `{CompanyCode} {AssetCode} Purchases {Date}` |
| 67 | Valuation | Valuation | `{CompanyCode} {AssetCode} Valuation {Date}` |
| 42 | Purchase Contract - Draft | ASSETS | `{CompanyCode} {AssetCode} Purchase Contract DRAFT {Date}` |
| 43 | Purchase Contract - Signed | ASSETS | `{CompanyCode} {AssetCode} Purchase Contract SIGNED {Date}` |
| 46 | Service Agreement - Draft | ASSETS | `{CompanyCode} {AssetCode} Service Agreement DRAFT {Date}` |
| 47 | Service Agreement - Signed | ASSETS | `{CompanyCode} {AssetCode} Service Agreement SIGNED {Date}` |

### ATO Tab (5 types)
| ID | Document Type | Folder | Naming Format |
|----|--------------|--------|---------------|
| 18 | ATO Documents | ATO | `{CompanyCode} ATO {Description} {Date}` |
| 12 | BAS - Business Activity Statement | ATO | `{CompanyCode} BAS {Period} {Year}` |
| 16 | CTR - Company Tax Return | ATO | `{CompanyCode} CTR FY{YY}` |
| 26 | Tax Consolidation Schedule | ATO | `{CompanyCode} Tax Consolidation Schedule FY{YY}` |
| 34 | TTR - Trust Tax Return | ATO | `{CompanyCode} TTR FY{YY}` |

### BANK Tab (1 type)
| ID | Document Type | Folder | Naming Format |
|----|--------------|--------|---------------|
| 22 | Bank Statement | BANK | `{CompanyCode} {Bank} {Account} {Month} {Year}` |

### COMPANY Tab (1 type) - **NEEDS FIX**
| ID | Document Type | Current Folder | Correct Folder | Naming Format |
|----|--------------|----------------|----------------|---------------|
| 6 | Constitution | GENERAL | **COMPANY** | `{CompanyCode} Constitution {Date}` |

### DIVIDENDS Tab (8 types)
| ID | Document Type | Folder | Tabs | Naming Format |
|----|--------------|--------|------|---------------|
| 54 | Distribution - Draft | DIVIDENDS | DIVIDENDS | `{CompanyCode} Distribution DRAFT FY{YY}` |
| 55 | Distribution - Signed | DIVIDENDS | DIVIDENDS | `{CompanyCode} Distribution SIGNED FY{YY}` |
| 23 | Distribution Declaration | DIVIDENDS | DIVIDENDS, MINUTES | `{CompanyCode} Distribution Declaration {Beneficiary} FY{YY}` |
| 56 | Dividend Declaration | DIVIDENDS | DIVIDENDS, MINUTES | `{CompanyCode} Dividend Declaration {Beneficiary} FY{YY}` |
| 15 | Dividend Payment Record | DIVIDENDS | DIVIDENDS | `{CompanyCode} Dividend Payment Record {Beneficiary} FY{YY}` |
| 57 | Gift Deed | DIVIDENDS | DIVIDENDS | `{CompanyCode} Gift Deed {Beneficiary} {Date}` |
| 58 | Gift Deed - Signed | DIVIDENDS | DIVIDENDS | `{CompanyCode} Gift Deed - Signed {Beneficiary} {Date}` |
| 3 | Gift Deed Return | DIVIDENDS | DIVIDENDS | `{CompanyCode} Gift Deed Return {Beneficiary} {Date}` |

### FINANCIALS Tab (3 types)
| ID | Document Type | Folder | Naming Format |
|----|--------------|--------|---------------|
| 37 | Draft Financials | FINANCIALS | `{CompanyCode} Draft Financials FY{YY}` |
| 38 | Final Financials | FINANCIALS | `{CompanyCode} Final Financials FY{YY}` |
| 59 | Final Financials - Signed | FINANCIALS | `{CompanyCode} Final Financials - Signed FY{YY}` |

### GENERAL Tab (2 types)
| ID | Document Type | Folder | Naming Format |
|----|--------------|--------|---------------|
| 36 | General | GENERAL | `{CompanyCode} {Description} {Date}` |
| 8 | Structure | GENERAL | `{CompanyCode} Structure {Description} {Date}` |

### INSURANCE Tab (2 types) - **NEEDS FIX**
| ID | Document Type | Current Folder | Correct Folder | Naming Format |
|----|--------------|----------------|----------------|---------------|
| 44 | Asset Insurance - Draft | ASSETS | **INSURANCE** | `{CompanyCode} {AssetCode} Insurance DRAFT {Date}` |
| 45 | Asset Insurance - Signed | ASSETS | **INSURANCE** | `{CompanyCode} {AssetCode} Insurance SIGNED {Date}` |

### LOANS Tab (8 types)
| ID | Document Type | Folder | Naming Format |
|----|--------------|--------|---------------|
| 1 | Loan Agreement | LOANS | `{CompanyCode} {LoanID} Loan from {LenderCode} {AssetCode} {Date}` |
| 48 | Loan Agreement - Draft | LOANS | `{CompanyCode} {LoanID} Loan from {LenderCode} {AssetCode} DRAFT {Date}` |
| 49 | Loan Agreement - Signed | LOANS | `{CompanyCode} {LoanID} Loan from {LenderCode} {AssetCode} SIGNED {Date}` |
| 71 | Loan Agreement - Lender Copy | LOANS | `{CompanyCode} {LoanID} Loan to {BorrowerCode} {AssetCode} {Date}` |
| 4 | PPSR Registration | LOANS | `{CompanyCode} {LoanID} PPSR {AssetCode} {Date}` |
| 2 | Security Deed | LOANS | `{CompanyCode} {LoanID} Security Deed {AssetCode} {Date}` |
| 50 | Security Deed - Draft | LOANS | `{CompanyCode} {LoanID} Security Deed {AssetCode} DRAFT {Date}` |
| 51 | Security Deed - Signed | LOANS | `{CompanyCode} {LoanID} Security Deed {AssetCode} SIGNED {Date}` |

### MINUTES Tab (3 types)
| ID | Document Type | Folder | Naming Format |
|----|--------------|--------|---------------|
| 10 | Directors' Minutes | MINUTES | `{CompanyCode} Minutes {Date}` |
| 52 | Minutes - Draft | MINUTES | `{CompanyCode} Minutes DRAFT {Date}` |
| 53 | Minutes - Signed | MINUTES | `{CompanyCode} Minutes SIGNED {Date}` |

### REGISTRY Tab (4 types)
| ID | Document Type | Folder | Naming Format |
|----|--------------|--------|---------------|
| 7 | Register of Members | REGISTRY | `{CompanyCode} Register of Members {Date}` |
| 41 | Share Certificate | REGISTRY | `{CompanyCode} Share Certificate {ShareholderCode} {Date}` |
| 39 | Share Registry | REGISTRY | `{CompanyCode} Share Registry {Date}` |
| 40 | Share Transfer | REGISTRY | `{CompanyCode} Share Transfer {Date}` |

### TRUST Tab (1 type) - **NEEDS FIX**
| ID | Document Type | Current Folder | Correct Folder | Naming Format |
|----|--------------|----------------|----------------|---------------|
| 25 | Trust | GENERAL | **TRUST** | `{CompanyCode} Trust {Description} {Date}` |

---

## Database Fixes Required

### Fix 1: Wrong Folder Values (4 document types)
```ruby
# Run on BOTH local AND staging:
DocumentType.find(25).update!(folder: 'TRUST')        # Trust → TRUST folder
DocumentType.find(6).update!(folder: 'COMPANY')       # Constitution → COMPANY folder
DocumentType.find(44).update!(folder: 'INSURANCE')    # Asset Insurance Draft → INSURANCE folder
DocumentType.find(45).update!(folder: 'INSURANCE')    # Asset Insurance Signed → INSURANCE folder
```

### Fix 2: ASSETS Sub-tabs Need Own primary_tab (4 document types)
Currently these have `primary_tab: ASSETS` so they don't show as separate UI tabs.

```ruby
# Run on BOTH local AND staging:
DocumentType.find(66).update!(primary_tab: 'Disposal')   # Disposal
DocumentType.find(64).update!(primary_tab: 'Expenses')   # Expenses
DocumentType.find(65).update!(primary_tab: 'Purchases')  # Purchases
DocumentType.find(67).update!(primary_tab: 'Valuation')  # Valuation
```

---

## Multi-Tab Documents

Some documents appear in multiple UI tabs but are stored in ONE SharePoint folder.

| Document Type | Primary Tab | Folder | Shows In Tabs |
|--------------|-------------|--------|---------------|
| Distribution Declaration | DIVIDENDS | DIVIDENDS | DIVIDENDS, MINUTES |
| Dividend Declaration | DIVIDENDS | DIVIDENDS | DIVIDENDS, MINUTES |
| Asset Insurance - Draft | INSURANCE | INSURANCE | INSURANCE, ASSETS |
| Asset Insurance - Signed | INSURANCE | INSURANCE | INSURANCE, ASSETS |

**Key Principle:**
- **One file, one folder** - Document stored ONCE in SharePoint
- **Multiple UI views** - Appears in ALL tabs listed in `tabs` array
- **SharePoint link follows folder** - Link goes to actual storage location

---

## Company Codes (From Corporate File Sheet3)

| Code | Company Name |
|------|-------------|
| T | Tekna Pty Ltd |
| TA | Tekna Admin Pty Ltd |
| TD | Tekna Drafting Pty Ltd |
| TH | Tekna Homes |
| GEN | Gen2612 |
| PROV | Prov1322 Global |
| THFT | Team Harder Family Trust |
| THSF | Team Harder Super Fund |
| THSI | Team Harder Super Investments |
| CIC | Co Invest Capital Pty Ltd |
| CIH | Co Invest Homes Pty Ltd |
| TPQ | The Promise QLD Pty Ltd |
| W2G | W2G Assets |
| ROB | Robert Harder |
| RAH | Rachel Harder |
| JH | Jared Harder |
| GH | Grace Harder |
| SH | Sophie Mee-Jeong Harder |

---

## Naming Convention Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `{CompanyCode}` | Company abbreviation | T, TD, THFT |
| `{LoanID}` | Loan identifier | L001 |
| `{LenderCode}` | Lender company code | T |
| `{BorrowerCode}` | Borrower company code | GEN |
| `{ShareholderCode}` | Shareholder code | PROV |
| `{AssetCode}` | Asset identifier | NEV |
| `{Year}` | Full year | 2025 |
| `{YY}` | Two-digit year | 25 |
| `{Period}` | BAS period | Jul-Sep |
| `{Month}` | Month name | Jun |
| `{Date}` | Full date | 30 Jun 2025 |
| `{Bank}` | Bank abbreviation | WBC |
| `{Account}` | Account number | 123456 |
| `{Beneficiary}` | Beneficiary name | Rachel Harder |
| `{Description}` | Document description | Annual Review |
| `{Document}` | Document type | Certificate |
| `{Role}` | Position role | Director |
| `{Person}` | Person name | Rachel Harder |

---

## Files to Modify

### Backend Files
1. `backend/app/services/corporate_one_drive_service.rb` - Folder constants
2. `backend/app/models/company.rb` - SharePoint URL methods
3. `backend/app/controllers/api/v1/organization_onedrive_controller.rb` - Endpoints

### Frontend Files
4. `frontend/src/components/corporate/CompanyDocumentsTab.jsx` - Tab array & SharePoint links
5. `frontend/src/pages/DocumentTabStructurePage.jsx` - Naming formats reference

---

## Implementation Steps

### Step 1: Fix Database (Both Local & Staging)
Run the database fix commands above.

### Step 2: Update Backend Constants
Update `DOCUMENT_TYPE_FOLDERS` in `corporate_one_drive_service.rb`:
```ruby
PRIMARY_FOLDERS = %w[
  ADVICE ASIC ASSETS ATO BANK COMPANY DIVIDENDS
  FINANCIALS GENERAL INSURANCE LOANS MINUTES REGISTRY TRUST
].freeze

ASSETS_SUBFOLDERS = %w[Disposal Expenses Purchases Valuation].freeze
```

### Step 3: Update Frontend Tabs
Update tabs array in `CompanyDocumentsTab.jsx` to include 4 ASSETS sub-tabs.

### Step 4: Add Tab-Specific SharePoint Links
Make the SharePoint link change based on selected tab.

### Step 5: Test & Deploy
1. Run preview endpoint to verify structure
2. Deploy to staging
3. Create folders in SharePoint
4. Test all 18 tabs open correct folders

---

## Example Folder URLs

**Company Root:**
```
https://gotekna.sharepoint.com/sites/TEEEM/Shared%20Documents/00%20-%20Private/Tekna%20Group/TD%20-%20Tekna%20Drafting/
```

**LOANS Tab:**
```
https://gotekna.sharepoint.com/sites/TEEEM/Shared%20Documents/00%20-%20Private/Tekna%20Group/TD%20-%20Tekna%20Drafting/LOANS/
```

**Disposal Sub-Tab (under ASSETS):**
```
https://gotekna.sharepoint.com/sites/TEEEM/Shared%20Documents/00%20-%20Private/Tekna%20Group/TD%20-%20Tekna%20Drafting/ASSETS/Disposal/
```
