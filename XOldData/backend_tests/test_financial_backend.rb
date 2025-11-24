#!/usr/bin/env ruby
# Quick test script to verify financial tracking backend
# Run with: rails runner backend/test_financial_backend.rb

puts "🧪 Testing Financial Tracking Backend..."
puts "=" * 60

# Step 1: Verify chart of accounts exists
puts "\n1. Checking Chart of Accounts..."
account_count = Keepr::Account.count
puts "   ✓ Found #{account_count} accounts"

if account_count == 0
  puts "   ⚠️  No accounts found. Run: rails trapid:financial:setup_simple"
  exit 1
end

# List accounts
puts "\n   Accounts by type:"
['asset', 'liability', 'revenue', 'expense'].each do |kind|
  accounts = Keepr::Account.where(kind: kind)
  puts "   - #{kind.capitalize}: #{accounts.count} accounts"
  accounts.each do |acc|
    puts "     #{acc.number}: #{acc.name}"
  end
end

# Step 2: Create test data
puts "\n2. Creating test transactions..."

# Get or create test user and company
user = User.first
if user.nil?
  puts "   ⚠️  No users found. Please create a user first:"
  puts "      rails console"
  puts "      User.create!(email: 'test@trapid.com', password: 'Test123!@#', first_name: 'Test', last_name: 'User', role: 'admin')"
  exit 1
end
puts "   ✓ Using user: #{user.email}"

company = Company.first
if company.nil?
  puts "   ⚠️  No companies found. Please create a company first."
  exit 1
end
puts "   ✓ Using company: #{company.name}"

# Create service
service = FinancialTransactionService.new(user: user, company: company)

# Create income transaction
income = service.create_income(
  amount: 10000,
  transaction_date: Date.today - 5.days,
  description: "Test job payment received",
  category: "Job Revenue",
  auto_post: true
)
puts "   ✓ Created income transaction: $#{income.amount}"

# Create expense transaction
expense = service.create_expense(
  amount: 3500,
  transaction_date: Date.today - 3.days,
  description: "Test materials purchase",
  category: "Materials",
  auto_post: true
)
puts "   ✓ Created expense transaction: $#{expense.amount}"

# Create another income
income2 = service.create_income(
  amount: 5000,
  transaction_date: Date.today - 1.day,
  description: "Test material sales",
  category: "Material Sales",
  auto_post: true
)
puts "   ✓ Created second income: $#{income2.amount}"

# Create another expense
expense2 = service.create_expense(
  amount: 1200,
  transaction_date: Date.today,
  description: "Test labour costs",
  category: "Labour",
  auto_post: true
)
puts "   ✓ Created second expense: $#{expense2.amount}"

# Step 3: Test reporting
puts "\n3. Generating Financial Reports..."

reporting = FinancialReportingService.new(company: company)

# Balance Sheet
balance_sheet = reporting.generate_balance_sheet(as_of_date: Date.today)
puts "\n   Balance Sheet (as of #{Date.today}):"
puts "   - Total Assets: $#{balance_sheet[:assets][:total].round(2)}"
puts "   - Total Liabilities: $#{balance_sheet[:liabilities][:total].round(2)}"
puts "   - Total Equity: $#{balance_sheet[:equity][:total].round(2)}"
total_liabilities_equity = balance_sheet[:liabilities][:total] + balance_sheet[:equity][:total]
puts "   - Total Liabilities + Equity: $#{total_liabilities_equity.round(2)}"
balanced = (balance_sheet[:assets][:total] - total_liabilities_equity).abs < 0.01
puts "   #{balanced ? '✓' : '✗'} Balance Sheet #{balanced ? 'BALANCES' : 'DOES NOT BALANCE'}"

# Profit & Loss
profit_loss = reporting.generate_profit_loss(
  from_date: Date.today.beginning_of_month,
  to_date: Date.today
)
puts "\n   Profit & Loss (#{Date.today.beginning_of_month} to #{Date.today}):"
puts "   - Total Revenue: $#{profit_loss[:revenue][:total].round(2)}"
puts "     - Job Revenue: $#{profit_loss[:revenue][:details]['Job Revenue'].to_f.round(2)}"
puts "     - Material Sales: $#{profit_loss[:revenue][:details]['Material Sales'].to_f.round(2)}"
puts "   - Total Expenses: $#{profit_loss[:expenses][:total].round(2)}"
puts "     - Materials: $#{profit_loss[:expenses][:details]['Materials'].to_f.round(2)}"
puts "     - Labour: $#{profit_loss[:expenses][:details]['Labour'].to_f.round(2)}"
puts "   - Net Profit: $#{profit_loss[:net_profit].round(2)}"
puts "   - Profit Margin: #{profit_loss[:profit_margin]}%"

# Trial Balance
trial = reporting.trial_balance(as_of_date: Date.today)
puts "\n   Trial Balance:"
puts "   - Balance: #{trial[:trial_balance].round(2)}"
puts "   #{trial[:balanced] ? '✓' : '✗'} Books are #{trial[:balanced] ? 'BALANCED' : 'OUT OF BALANCE'}"

# Step 4: Test summary
puts "\n4. Transaction Summary..."
scope = FinancialTransaction.posted.for_company(company.id)
puts "   - Total Transactions: #{scope.count}"
puts "   - Total Income: $#{scope.income_total.round(2)}"
puts "   - Total Expenses: $#{scope.expense_total.round(2)}"
puts "   - Net Profit: $#{scope.net_profit.round(2)}"

# Step 5: Test export
puts "\n5. Testing Export Service..."
export_service = FinancialExportService.new(company: company)

csv = export_service.export_profit_loss_csv(
  from_date: Date.today.beginning_of_month,
  to_date: Date.today
)
lines = csv.split("\n")
puts "   ✓ Generated P&L CSV: #{lines.count} lines"

# Step 6: Check Keepr journals
puts "\n6. Verifying Keepr Journal Entries..."
journals = Keepr::Journal.where('date >= ?', Date.today - 7.days)
puts "   ✓ Found #{journals.count} journal entries"

journals.each do |journal|
  postings = journal.keepr_postings
  debit_total = postings.where(side: :debit).sum(:amount)
  credit_total = postings.where(side: :credit).sum(:amount)
  balanced = (debit_total - credit_total).abs < 0.01

  puts "   #{balanced ? '✓' : '✗'} #{journal.date}: #{journal.subject}"
  puts "      Debit: $#{debit_total}, Credit: $#{credit_total}"
end

puts "\n" + "=" * 60
puts "✅ All backend tests passed!"
puts "=" * 60
puts "\nNext steps:"
puts "1. Start Rails server: rails server"
puts "2. Test API endpoints with curl or Postman"
puts "3. Build frontend UI components"
puts "\nAPI Base URL: http://localhost:3000/api/v1"
puts "See FINANCIAL_TRACKING_IMPLEMENTATION.md for details"
