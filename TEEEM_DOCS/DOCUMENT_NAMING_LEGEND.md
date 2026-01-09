# Document Naming Convention Legend

## Corporate Documents (Company Scope)

All corporate documents follow the pattern: `{CompanyCode} {Code} {Details}`

### Variable Placeholders

| Placeholder | Description | Example |
|-------------|-------------|---------|
| `{CompanyCode}` | Company's short code | TD, THFT, ABC |
| `{Code}` | Document type abbreviation | CTR, BAS, AA |
| `{Date}` | Date in format DD-MM-YYYY | 15-03-2024 |
| `{YY}` | Financial year (2 digits) | 24 (for FY2024) |
| `{Period}` | Period description | Jul-Sep, Q1 |
| `{FromDate}` | Start date of period | 01-07-2023 |
| `{ToDate}` | End date of period | 30-06-2024 |
| `{PrintDate}` | Date document was printed | 15-08-2024 |
| `{AssetCode}` | Asset identifier | PROP01, VEH02 |
| `{LoanID}` | Loan identifier | L001, L002 |
| `{LenderCode}` | Lender's code | CBA, NAB |
| `{Description}` | Free text description | Annual Review |
| `{Signed}` | Signed/Unsigned status | S, US |

---

## Document Types by Folder

### ADVICE - Professional Advice
| Code | Display Name | Naming Format |
|------|--------------|---------------|
| AA | Accountant Advice | `{CompanyCode} AA {Description} {Date}` |
| CA | Client Advice | `{CompanyCode} CA {Description} {Date}` |
| LA | Legal Advice | `{CompanyCode} LA {Description} {Date}` |

### ASIC - Company Registry
| Code | Display Name | Naming Format |
|------|--------------|---------------|
| ASIC | ASIC Documents | `{CompanyCode} ASIC {Description} {Date}` |
| ASICR | Annual Solvency Resolution | `{CompanyCode} Annual Solvency Resolution FY{YY}` |
| F484 | Form 484 - Director Changes | `{CompanyCode} ASIC Form 484 Director {Date}` |
| F484R | Form 484 - Registered Office | `{CompanyCode} ASIC Form 484 Reg Office {Date}` |
| KEY | Corporate Key | `{CompanyCode} Corporate Key` |
| SETUP | Company Setup | `{CompanyCode} Company Setup {Date}` |

### ASSETS - Asset Documents
| Code | Display Name | Naming Format |
|------|--------------|---------------|
| ASSET | Asset | `{CompanyCode} {AssetCode} {Description} {Date}` |
| AINSD | Asset Insurance - Draft | `{CompanyCode} {AssetCode} Insurance Draft {Date}` |
| AINSS | Asset Insurance - Signed | `{CompanyCode} {AssetCode} Insurance Signed {Date}` |
| PCD | Purchase Contract - Draft | `{CompanyCode} {AssetCode} Purchase Contract Draft {Date}` |
| PCS | Purchase Contract - Signed | `{CompanyCode} {AssetCode} Purchase Contract Signed {Date}` |
| SAD | Service Agreement - Draft | `{CompanyCode} {AssetCode} Service Agreement Draft {Date}` |
| SAS | Service Agreement - Signed | `{CompanyCode} {AssetCode} Service Agreement Signed {Date}` |

### ATO - Tax Office Documents
| Code | Display Name | Naming Format |
|------|--------------|---------------|
| AAS | ATO Account Summary | `{CompanyCode} ATO Account Summary FY{YY}` |
| ATO | ATO Documents | `{CompanyCode} ATO {Description} {Date}` |
| BAS | Business Activity Statement | `{CompanyCode} BAS {Period} FY{YY}` |
| BASST | ATO BAS Statement | `{CompanyCode} BAS Statement {FromDate} to {ToDate} ({PrintDate})` |
| CTR | Company Tax Return | `{CompanyCode} CTR FY{YY} {Signed}` |
| ITST | Income Tax Statement | `{CompanyCode} Income Tax Statement {FromDate} to {ToDate} ({PrintDate})` |
| TCS | Tax Consolidation Schedule | `{CompanyCode} Tax Consolidation Schedule FY{YY}` |
| TFN | Tax File Number Advice | `{CompanyCode} TFN Advice {Date}` |
| TTR | Trust Tax Return | `{CompanyCode} TTR FY{YY} {Signed}` |

### BANK - Banking
| Code | Display Name | Naming Format |
|------|--------------|---------------|
| BANK | Bank Statement | `{CompanyCode} Bank Statement {Period} FY{YY}` |

### DIVIDENDS - Distributions & Dividends
| Code | Display Name | Naming Format |
|------|--------------|---------------|
| DIST | Distribution Declaration | `{CompanyCode} Distribution Declaration FY{YY}` |
| DISTD | Distribution - Draft | `{CompanyCode} Distribution Draft FY{YY}` |
| DISTS | Distribution - Signed | `{CompanyCode} Distribution Signed FY{YY}` |
| DIV | Dividend Declaration | `{CompanyCode} Dividend Declaration FY{YY}` |
| DIVR | Dividend Payment Record | `{CompanyCode} Dividend Payment Record FY{YY}` |
| GD | Gift Deed | `{CompanyCode} Gift Deed {Date}` |
| GDR | Gift Deed Return | `{CompanyCode} Gift Deed Return {Date}` |
| GDS | Gift Deed - Signed | `{CompanyCode} Gift Deed Signed {Date}` |

### FINANCIALS - Financial Statements
| Code | Display Name | Naming Format |
|------|--------------|---------------|
| DFS | Draft Financials | `{CompanyCode} Draft Financials FY{YY}` |
| FS | Final Financials | `{CompanyCode} Final Financials FY{YY}` |
| FSS | Final Financials - Signed | `{CompanyCode} Final Financials FY{YY} Signed` |

### GENERAL - General Documents
| Code | Display Name | Naming Format |
|------|--------------|---------------|
| CON | Constitution | `{CompanyCode} Constitution {Date}` |
| GEN | General | `{CompanyCode} {Description} {Date}` |
| STRUC | Structure | `{CompanyCode} Structure {Date}` |
| TR | Trust | `{CompanyCode} Trust {Description} {Date}` |

### LOANS - Loan Documents
| Code | Display Name | Naming Format |
|------|--------------|---------------|
| LA | Loan Agreement | `{CompanyCode} {LoanID} Loan from {LenderCode} {AssetCode} {Date}` |
| LAD | Loan Agreement - Draft | `{CompanyCode} {LoanID} Loan Draft from {LenderCode} {AssetCode} {Date}` |
| LAL | Loan Agreement - Lender Copy | `{CompanyCode} {LoanID} Loan Lender Copy {AssetCode} {Date}` |
| LAS | Loan Agreement - Signed | `{CompanyCode} {LoanID} Loan Signed from {LenderCode} {AssetCode} {Date}` |
| PPSR | PPSR Registration | `{CompanyCode} {LoanID} PPSR {AssetCode} {Date}` |
| SD | Security Deed | `{CompanyCode} {LoanID} Security Deed {AssetCode} {Date}` |
| SDD | Security Deed - Draft | `{CompanyCode} {LoanID} Security Deed Draft {AssetCode} {Date}` |
| SDS | Security Deed - Signed | `{CompanyCode} {LoanID} Security Deed Signed {AssetCode} {Date}` |

### MINUTES - Meeting Minutes
| Code | Display Name | Naming Format |
|------|--------------|---------------|
| MIN | Directors' Minutes | `{CompanyCode} Minutes {Date}` |
| MIND | Minutes - Draft | `{CompanyCode} Minutes Draft {Date}` |
| MINS | Minutes - Signed | `{CompanyCode} Minutes Signed {Date}` |

### REGISTRY - Share Registry
| Code | Display Name | Naming Format |
|------|--------------|---------------|
| ROM | Register of Members | `{CompanyCode} Register of Members {Date}` |
| SC | Share Certificate | `{CompanyCode} Share Certificate {Date}` |
| SR | Share Registry | `{CompanyCode} Share Registry {Date}` |
| ST | Share Transfer | `{CompanyCode} Share Transfer {Date}` |

### OTHER
| Code | Display Name | Folder | Naming Format |
|------|--------------|--------|---------------|
| DISP | Disposal | Disposal | `{CompanyCode} Disposal {AssetCode} {Date}` |
| EXP | Expenses | Expenses | `{CompanyCode} Expenses {Description} {Date}` |
| PURCH | Purchases | Purchases | `{CompanyCode} Purchases {Description} {Date}` |
| VAL | Valuation | Valuation | `{CompanyCode} Valuation {AssetCode} {Date}` |

---

## Examples

### Tax Returns
- `TD CTR FY24 S.pdf` - TD Company Tax Return FY2024 Signed
- `TD CTR FY24 US.pdf` - TD Company Tax Return FY2024 Unsigned
- `THFT TTR FY24 S.pdf` - THFT Trust Tax Return FY2024 Signed

### BAS Statements
- `TD BAS Jul-Sep FY24.pdf` - TD BAS July-September FY2024
- `TD BAS Statement 01-07-2023 to 30-09-2023 (15-10-2023).pdf` - ATO BAS Statement

### Professional Advice
- `TD AA Annual Review 15-03-2024.pdf` - Accountant Advice
- `TD CA Tax Planning 20-06-2024.pdf` - Client Advice
- `TD LA Contract Review 10-01-2024.pdf` - Legal Advice

### Asset Documents
- `TD PROP01 Purchase Contract Signed 15-03-2024.pdf`
- `TD VEH02 Insurance Signed 01-07-2024.pdf`

### Loan Documents
- `TD L001 Loan Signed from CBA PROP01 15-03-2024.pdf`
- `TD L001 Security Deed Signed PROP01 15-03-2024.pdf`
- `TD L001 PPSR PROP01 20-03-2024.pdf`

---

## Quick Reference Card

| Category | Common Codes |
|----------|--------------|
| Tax | CTR, TTR, BAS, TFN |
| Advice | AA, CA, LA |
| ASIC | F484, KEY, SETUP |
| Financial | DFS, FS, FSS |
| Dividends | DIV, DIST, GD |
| Loans | LA, SD, PPSR |
| Minutes | MIN, MINS |
| Registry | SC, SR, ST |

---

*Generated from TEEEM Document Types database*
