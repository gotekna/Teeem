# Financial Tracking - Testing Guide

## Quick Start Testing

### 1. Setup Chart of Accounts
```bash
cd backend
rails trapid:financial:setup_simple
```

**Expected Output:**
```
✓ Created 20 accounts
Financial chart of accounts setup complete!
```

### 2. Verify Setup
```bash
rails console
```

```ruby
# Check accounts
Keepr::Account.count  # Should be 20
Keepr::Account.order(:number).pluck(:number, :name)

# List by type
Keepr::Account.where(kind: 'asset').pluck(:number, :name)
Keepr::Account.where(kind: 'revenue').pluck(:number, :name)
Keepr::Account.where(kind: 'expense').pluck(:number, :name)
```

### 3. Create Test Data (Rails Console)

```ruby
# Get user and company (use existing)
user = User.first
company = Company.first

# Create transaction service
service = FinancialTransactionService.new(user: user, company: company)

# Create income transaction
income = service.create_income(
  amount: 10000,
  transaction_date: Date.today,
  description: "Job payment received - Test Kitchen Renovation",
  category: "Job Revenue",
  auto_post: true
)

puts "Created income: $#{income.amount} (#{income.status})"

# Create expense transaction
expense = service.create_expense(
  amount: 3500,
  transaction_date: Date.today,
  description: "Materials purchase - Cabinets and Hardware",
  category: "Materials",
  auto_post: true
)

puts "Created expense: $#{expense.amount} (#{expense.status})"

# Create more transactions
service.create_income(amount: 5000, transaction_date: Date.today - 1.day, description: "Material sales", category: "Material Sales", auto_post: true)
service.create_expense(amount: 1200, transaction_date: Date.today - 2.days, description: "Labour costs", category: "Labour", auto_post: true)
service.create_expense(amount: 800, transaction_date: Date.today - 3.days, description: "Fuel and transport", category: "Fuel & Transport", auto_post: true)
```

### 4. Generate Reports

```ruby
# Create reporting service
reporting = FinancialReportingService.new(company: company)

# Balance Sheet
balance_sheet = reporting.generate_balance_sheet(as_of_date: Date.today)
puts "\n=== BALANCE SHEET ==="
puts "Assets: $#{balance_sheet[:assets][:total].round(2)}"
puts "Liabilities: $#{balance_sheet[:liabilities][:total].round(2)}"
puts "Equity: $#{balance_sheet[:equity][:total].round(2)}"

# Profit & Loss
pl = reporting.generate_profit_loss(
  from_date: Date.today.beginning_of_month,
  to_date: Date.today
)
puts "\n=== PROFIT & LOSS ==="
puts "Revenue: $#{pl[:revenue][:total].round(2)}"
pl[:revenue][:details].each do |name, amount|
  puts "  - #{name}: $#{amount.round(2)}"
end
puts "Expenses: $#{pl[:expenses][:total].round(2)}"
pl[:expenses][:details].each do |name, amount|
  puts "  - #{name}: $#{amount.round(2)}" if amount > 0
end
puts "Net Profit: $#{pl[:net_profit].round(2)}"
puts "Margin: #{pl[:profit_margin]}%"

# Trial Balance (should be 0 or very close)
trial = reporting.trial_balance
puts "\n=== TRIAL BALANCE ==="
puts "Balance: #{trial[:trial_balance].round(2)}"
puts trial[:balanced] ? "✓ Books are BALANCED" : "✗ Books are OUT OF BALANCE"

# Check journals
journals = Keepr::Journal.where('date >= ?', Date.today - 7.days)
puts "\n=== JOURNAL ENTRIES (Last 7 days) ==="
journals.each do |j|
  postings = j.keepr_postings
  debit = postings.where(side: :debit).sum(:amount)
  credit = postings.where(side: :credit).sum(:amount)
  balanced = (debit - credit).abs < 0.01
  puts "#{balanced ? '✓' : '✗'} #{j.date}: #{j.subject} (Dr: $#{debit}, Cr: $#{credit})"
end
```

### 5. Test API Endpoints

Start the server:
```bash
rails server
```

Get auth token (use your actual credentials):
```bash
# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"yourpassword"}'

# Copy the token from response
```

Test endpoints:
```bash
TOKEN="your_jwt_token_here"

# List transactions
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/financial_transactions

# Get summary
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/financial_transactions/summary

# Get categories
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/financial_transactions/categories?transaction_type=expense"

# Create income transaction
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction": {
      "transaction_type": "income",
      "amount": 12000,
      "transaction_date": "2024-11-20",
      "description": "New job payment",
      "category": "Job Revenue",
      "auto_post": true
    }
  }' \
  http://localhost:3000/api/v1/financial_transactions

# Generate balance sheet
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/financial_reports/balance_sheet?as_of_date=2024-11-20"

# Generate P&L
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/financial_reports/profit_loss?from_date=2024-11-01&to_date=2024-11-20"

# Export transactions to CSV
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/financial_exports/transactions" \
  -o transactions.csv

# Export accountant package
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/financial_exports/accountant_package?from_date=2024-11-01&to_date=2024-11-20" \
  -o accountant_package.csv
```

## Verification Checklist

- [ ] Chart of accounts has 20 accounts
- [ ] Can create income transactions
- [ ] Can create expense transactions
- [ ] Transactions create proper Keepr journal entries
- [ ] Balance sheet generates correctly
- [ ] P&L statement generates correctly
- [ ] Trial balance equals zero (or very close)
- [ ] All journal entries are balanced (Debit = Credit)
- [ ] API endpoints return proper JSON
- [ ] CSV exports download successfully
- [ ] Filtering works (by date, type, category, status)
- [ ] Summary endpoint returns correct totals

## Common Issues

### Issue: "No accounts found"
**Solution:** Run `rails trapid:financial:setup_simple`

### Issue: "NoMethodError: undefined method for Company"
**Solution:** Make sure you have existing user and company records in database

### Issue: "Trial balance not zero"
**Solution:** Check that all journal entries have equal debits and credits:
```ruby
Keepr::Journal.all.each do |j|
  dr = j.keepr_postings.where(side: :debit).sum(:amount)
  cr = j.keepr_postings.where(side: :credit).sum(:amount)
  puts "#{j.id}: Dr=#{dr}, Cr=#{cr}, Diff=#{dr-cr}" unless (dr-cr).abs < 0.01
end
```

### Issue: "Cannot edit synced transaction"
**Solution:** This is expected behavior. Synced transactions are read-only. Create a reversal instead.

## Performance Testing

Create bulk transactions:
```ruby
user = User.first
company = Company.first
service = FinancialTransactionService.new(user: user, company: company)

# Create 100 transactions
100.times do |i|
  if i.even?
    service.create_income(
      amount: rand(1000..10000),
      transaction_date: Date.today - rand(30).days,
      description: "Job payment #{i}",
      category: "Job Revenue",
      auto_post: true
    )
  else
    service.create_expense(
      amount: rand(500..5000),
      transaction_date: Date.today - rand(30).days,
      description: "Expense #{i}",
      category: ["Materials", "Labour", "Subcontractors"].sample,
      auto_post: true
    )
  end
end

puts "Created #{FinancialTransaction.count} transactions"
```

Test report generation time:
```ruby
require 'benchmark'

reporting = FinancialReportingService.new(company: company)

time = Benchmark.measure do
  reporting.generate_profit_loss(
    from_date: Date.today - 30.days,
    to_date: Date.today
  )
end

puts "P&L generation took: #{time.real.round(3)} seconds"
```

## Next Steps

Once backend testing is complete:
1. Build frontend transaction entry forms
2. Build transaction list with TrapidTableView
3. Build financial reports page
4. Add navigation menu items
5. Create dashboard widget

See [FINANCIAL_TRACKING_IMPLEMENTATION.md](FINANCIAL_TRACKING_IMPLEMENTATION.md) for detailed implementation plan.
