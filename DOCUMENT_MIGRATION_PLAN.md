# Document Migration Plan - 296 Documents

## Summary
Based on analysis of all 296 existing documents, here's the specific migration plan:

## Asset Linking Decision
**✅ LEAVE ALL ASSET_ID AS NULL**
- None of the 296 documents have obvious asset relationships in titles/folders
- The 4 existing assets (Neville Street, Shares in Tekna Homes, SEL Khyiroya, SEL Mansfield) are not referenced
- **User will manually link asset documents later through UI**

---

## Migration Mapping by Old Type

### 1. ASIC (41 docs) → ASIC Documents
**Documents:** EOY ASIC FY24, Solvency ASIC FY23, Change of Address, etc.
**Mapping:**
- All 41 docs → `ASIC Documents`
- Tab: ASIC
- Folder: Keep existing (mostly "General")

---

### 2. CONSTITUTION (9 docs) → Constitution
**Documents:** Constituition, Constitution PDF, Constitution Docx
**Mapping:**
- All 9 docs → `Constitution`
- Tab: GENERAL
- Folder: Keep existing ("Constitution")

---

### 3. CONTRACT (1 doc) → Gift Deed Return
**Documents:** Return of Gift Deed
**Mapping:**
- 1 doc → `Gift Deed Return`
- Tab: DIVIDENDS
- Folder: Change to "DIVIDENDS"

---

### 4. FINANCIAL_STATEMENT (31 docs) → Bank Statement
**Documents:** EOY NAB 959276787 FY22, BOQ Acc 21446327 CLOSED, Bank Statements
**Analysis:** All appear to be bank statements with account numbers
**Mapping:**
- All 31 docs → `Bank Statement`
- Tab: BANK (primary), FINANCIALS (secondary)
- Folder: Change to "BANK"

---

### 5. LOAN_AGREEMENT (28 docs) → Loan Agreement - Executed
**Documents:** Loan Prov1322 to Gen2612 THFT, Loan Facility Deed Rachel to Gen2612, etc.
**Analysis:** All existing loans appear to be executed (not drafts)
**Mapping:**
- All 28 docs → `Loan Agreement - Executed`
- Tab: LOANS
- Folder: Keep existing ("Loans and Security")

---

### 6. MINUTES (9 docs) → Directors' Minutes
**Documents:** Distribution Minute, Minutes Company Setup, Solvency Minutes
**Mapping:**
- All 9 docs → `Directors' Minutes`
- Tab: MINUTES
- Folder: Keep existing ("Minutes")

---

### 7. OTHER (98 docs) → SPLIT BY CONTENT

**Sub-Category A: Register Documents (34 docs)**
- Titles: Register of Members, Register of Loans
- Mapping → `Share Registry`
- Tab: REGISTRY
- Folder: "REGISTRY"

**Sub-Category B: Corporate Keys (8 docs)**
- Titles: Corporate Key, ASIC Key
- Mapping → `ASIC Company Key`
- Tab: ASIC
- Folder: "ASIC"

**Sub-Category C: Financials/Tax in #N/A folder (6 docs)**
- Titles: Financials 2024, Tax Return 2024
- Mapping:
  - "Financials 2024" → `Draft Financials` (Tab: FINANCIALS)
  - "Tax Return 2024" → `CTR - Company Tax Return` (Tab: ATO)

**Sub-Category D: Director Changes (8 docs)**
- Titles: Resignation of Director, Consent Rachel Director, Appoint of Director
- Mapping → `ASIC Form 484 - Director Changes`
- Tab: ASIC
- Folder: "ASIC"

**Sub-Category E: Share Transfers (3 docs)**
- Titles: Share Transfer Form Tekna - TPFT
- Mapping → `Share Registry`
- Tab: REGISTRY
- Folder: "REGISTRY"

**Sub-Category F: Asset Related (4 docs)**
- Titles: Sale of 100kg of SilverBullion, Deed of Gift - Grace
- Mapping → `Asset` (generic)
- Tab: ASSETS
- Folder: "ASSETS"

**Sub-Category G: Everything Else (35 docs)**
- Mapping → `General`
- Tab: GENERAL
- Folder: "GENERAL"

---

### 8. SECURITY_DEED (1 doc) → Security Deed - Executed
**Documents:** Security Deed Rachel to Gen2612
**Mapping:**
- 1 doc → `Security Deed - Executed`
- Tab: LOANS
- Folder: "LOANS"

---

### 9. SETUP (17 docs) → ASIC Documents
**Documents:** Certificate of Registration, Formation Documents, Company Setup
**Mapping:**
- All 17 docs → `ASIC Documents`
- Tab: ASIC
- Folder: "ASIC"

---

### 10. SHARE_REGISTRY (34 docs) → Share Registry
**Documents:** Share Certificate, Application for Shares, Register of Members, etc.
**Mapping:**
- All 34 docs → `Share Registry`
- Tab: REGISTRY (NEW)
- Folder: "REGISTRY"

---

### 11. TAX (1 doc) → CTR - Company Tax Return
**Documents:** Consolidated Income Tax Return FY23 Tekna
**Mapping:**
- 1 doc → `CTR - Company Tax Return`
- Tab: ATO
- Folder: "ATO"

---

### 12. TAX_RETURN (19 docs) → CTR or TTR by Company Type

**Company Type Detection:**
```
Company Name                                      | Type   | Document Type
--------------------------------------------------|--------|------------------
W2G Assets                                        | Pty    | CTR
Prov1322 Global ATF Team Harder Family Trust      | Trust  | TTR
Gen2612                                           | Pty    | CTR
Team Harder ATF Team Harder Super Fund            | Super  | TTR
Team Harder                                       | Pty    | CTR
Tekna Homes formerly Tekna Licence                | Pty    | CTR
Tekna Drafting (formerly Rock Invest Qld)         | Pty    | CTR
```

**Mapping:**
- Pty Ltd companies (14 docs) → `CTR - Company Tax Return` (Tab: ATO)
- Trust/Super (5 docs) → `TTR - Trust Tax Return` (Tab: ATO)
- Folder: "ATO"

---

### 13. TRUST_DEED (7 docs) → Trust Deed
**Documents:** Harder Bloodline Trust Deed, SMSF Deed, Trust Deed
**Mapping:**
- All 7 docs → `Trust Deed`
- Tab: GENERAL
- Folder: "GENERAL"

---

## Migration Summary

| Old Type           | Count | New Type(s)                          | Tab(s)           |
|--------------------|-------|--------------------------------------|------------------|
| asic               | 41    | ASIC Documents                       | ASIC             |
| constitution       | 9     | Constitution                         | GENERAL          |
| contract           | 1     | Gift Deed Return                     | DIVIDENDS        |
| financial_statement| 31    | Bank Statement                       | BANK, FINANCIALS |
| loan_agreement     | 28    | Loan Agreement - Executed            | LOANS            |
| minutes            | 9     | Directors' Minutes                   | MINUTES          |
| other              | 98    | SPLIT (see above)                    | Various          |
| security_deed      | 1     | Security Deed - Executed             | LOANS            |
| setup              | 17    | ASIC Documents                       | ASIC             |
| share_registry     | 34    | Share Registry                       | REGISTRY (NEW)   |
| tax                | 1     | CTR - Company Tax Return             | ATO              |
| tax_return         | 19    | CTR or TTR (by company type)         | ATO              |
| trust_deed         | 7     | Trust Deed                           | GENERAL          |
| **TOTAL**          | **296** |                                    |                  |

---

## Tab Distribution After Migration

| Tab        | Document Count (Estimated) |
|------------|----------------------------|
| ASIC       | 74 (41+17+8+8)            |
| ASSETS     | 4                          |
| ATO        | 26 (19+1+6)               |
| BANK       | 31                         |
| DIVIDENDS  | 1                          |
| FINANCIALS | 31 (same as BANK)         |
| GENERAL    | 51 (9+35+7)               |
| LOANS      | 29 (28+1)                 |
| MINUTES    | 9                          |
| REGISTRY   | 71 (34+34+3)              |

---

## Questions for Approval

1. **"OTHER" documents (98 total)** - Are the sub-categories correct?
   - Register docs → Share Registry ✓
   - Corporate Keys → ASIC Company Key ✓
   - Director changes → ASIC Form 484 ✓
   - Everything else → General ✓

2. **Tax Returns** - Use company type (Pty=CTR, Trust/Super=TTR)? ✓

3. **Loan Agreements** - Assume all are "Executed" (not Draft)? ✓

4. **Financial Statements** - All become "Bank Statement"? ✓

5. **Asset Linking** - Leave all as null for manual linking later? ✓

---

## Next Steps

1. ✅ Get user approval on this plan
2. Create document types for new types (Share Registry, etc.)
3. Create migration with this exact mapping
4. Run migration on staging
5. Verify all 296 documents migrated correctly
6. Deploy to production
