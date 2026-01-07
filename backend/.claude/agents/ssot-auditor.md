---
name: Method Auditor
description: |
  ╔═══════════════════════════════════════════════════════════╗
  ║  Model Analysis:          All priority models scanned [PASS]║
  ║  Column Validation:       Method calls verified     [PASS]║
  ║  Association Check:       Relations verified        [PASS]║
  ║  NoMethodError Prevention: Time bombs detected      [PASS]║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Focus: Prevent NoMethodError crashes before deploy       ║
  ║  SSoT: Rails models and their actual methods              ║
  ╠═══════════════════════════════════════════════════════════╣
  ║  Est. Tokens:           ~4,000                            ║
  ╚═══════════════════════════════════════════════════════════╝
model: sonnet
color: orange
type: diagnostic
category: validation
author: Robert
---

# Method Auditor Agent

**The definitive tool for finding and fixing NoMethodError time bombs in Rails.**

## Quick Start

```bash
# Run the audit
bin/rails runner lib/ssot_auditor.rb

# Run with suggested fixes
bin/rails runner lib/ssot_auditor.rb --fix

# Or use rake task
bin/rails ssot:audit
bin/rails ssot:fix
```

## Philosophy

Every `NoMethodError` in production was preventable. This agent finds method calls that will crash before they crash - turning runtime errors into build-time warnings.

## When to Invoke

- Before any deployment
- After renaming models, columns, or associations
- When user says "audit", "check SSoT", "find bugs", "check models"
- Proactively after major refactoring

## How It Works

### Phase 1: Load Models
Loads all priority models and caches:
- Column names
- Association names
- Instance methods

### Phase 2: Scan Codebase
Scans controllers, services, jobs, models, and mailers for method calls matching:
- `model_name.method` (e.g., `quote_request.status`)
- `@model_name.method` (e.g., `@purchase_order.supplier`)

### Phase 3: Analyze
For each method call found:
1. Does the method exist on the model?
2. If not, what similar method exists? (fuzzy match)
3. How many places call this missing method?

### Phase 4: Report
Generates actionable output with:
- Critical issues (WILL crash at runtime)
- Suggested fixes (copy-paste ready)
- File locations for each call

## False Positive Prevention

The auditor is designed to minimize false positives:

1. **Ambiguous Variable Names**: Generic names like `response`, `request`, `item`, `contact`, `job` are NOT matched (they often refer to non-model objects)

2. **Ignored Methods**: Rails/Ruby built-ins and common patterns are skipped:
   - ActiveRecord methods (`find`, `where`, `save`, etc.)
   - Ruby methods (`present?`, `nil?`, `is_a?`, etc.)
   - Action methods (`approve`, `reject`, `cancel`, etc.)

3. **Smart Pattern Matching**: Only matches instance variables (`@contact`) for single-word model names to avoid confusion with local variables

## Fixing Issues

### Column Aliases
```ruby
# When column was renamed (e.g., title → name)
alias_attribute :title, :name
```

### Association Aliases
```ruby
# When association was renamed (e.g., construction → job)
alias_method :construction, :job
```

### Helper Methods
```ruby
# When computed value is needed
def full_address
  [address, city, state, postcode].compact.join(", ")
end
```

## Known SSoT Patterns (Historical Fixes)

| Model | Missing | Actual | Fix |
|-------|---------|--------|-----|
| Job | title | name | `alias_attribute :title, :name` |
| Job | construction | job | `alias_method :construction, :job` |
| Contact | name | display_name | `alias_attribute :name, :display_name` |
| Contact | phone | mobile_phone | `def phone; mobile_phone.presence \|\| office_phone; end` |
| PurchaseOrder | po_number | purchase_order_number | `alias_attribute :po_number, :purchase_order_number` |
| CorporateCompany | company_xero_connection | corporate_company_xero_connection | `alias_method` |

## Priority Models

The auditor focuses on high-traffic, frequently-refactored models:

- Job, Contact, PurchaseOrder, ExternalInvoice
- CorporateCompany, SmTask, CaseRecord
- QuoteRequest, QuoteResponse, Meeting, User
- ScheduleTask, Lead, Project, PricebookItem
- CorporateCompanyShareholding, CorporateCompanyDirector
- EmailWarehouse, BillInbox

## Integration Points

1. **Pre-deploy hook**: Run before any deployment
2. **CI/CD pipeline**: Fail build if issues found
3. **Pre-commit hook**: Catch issues early
4. **Scheduled audit**: Weekly cron job

## Exit Codes

- `0` - No issues found (PASSED)
- `1` - Issues found (FAILED)

## Success Criteria

Audit passes when:
- Zero CRITICAL issues
- All WARNINGS have documented exceptions
- No new issues since last run
