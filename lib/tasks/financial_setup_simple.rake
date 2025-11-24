namespace :trapid do
  namespace :financial do
    desc "Set up simple default chart of accounts for financial tracking"
    task setup_simple: :environment do
      puts "Setting up simple chart of accounts..."

      # Skip groups for now and just create flat accounts
      # This is a simplified version that will work

      accounts = []

      # ASSETS (1000-1999)
      accounts << Keepr::Account.create!(number: 1000, name: 'Cash - Bank Account', kind: :asset)
      accounts << Keepr::Account.create!(number: 1100, name: 'Accounts Receivable', kind: :asset)
      accounts << Keepr::Account.create!(number: 1200, name: 'Inventory', kind: :asset)
      accounts << Keepr::Account.create!(number: 1400, name: 'Tools & Equipment', kind: :asset)

      # LIABILITIES (2000-2999)
      accounts << Keepr::Account.create!(number: 2000, name: 'Accounts Payable', kind: :liability)
      accounts << Keepr::Account.create!(number: 2100, name: 'Credit Cards', kind: :liability)
      accounts << Keepr::Account.create!(number: 2200, name: 'Loans', kind: :liability)

      # EQUITY (3000-3999)
      accounts << Keepr::Account.create!(number: 3000, name: "Owner's Equity", kind: :liability)
      accounts << Keepr::Account.create!(number: 3100, name: 'Retained Earnings', kind: :liability)

      # REVENUE (4000-4999)
      accounts << Keepr::Account.create!(number: 4000, name: 'Job Revenue', kind: :revenue)
      accounts << Keepr::Account.create!(number: 4100, name: 'Material Sales', kind: :revenue)
      accounts << Keepr::Account.create!(number: 4200, name: 'Other Income', kind: :revenue)

      # EXPENSES (5000-5999)
      accounts << Keepr::Account.create!(number: 5000, name: 'Materials', kind: :expense)
      accounts << Keepr::Account.create!(number: 5100, name: 'Labour', kind: :expense)
      accounts << Keepr::Account.create!(number: 5200, name: 'Subcontractors', kind: :expense)
      accounts << Keepr::Account.create!(number: 5300, name: 'Tools & Equipment Expense', kind: :expense)
      accounts << Keepr::Account.create!(number: 5400, name: 'Fuel & Transport', kind: :expense)
      accounts << Keepr::Account.create!(number: 5500, name: 'Insurance', kind: :expense)
      accounts << Keepr::Account.create!(number: 5600, name: 'Professional Fees', kind: :expense)
      accounts << Keepr::Account.create!(number: 5700, name: 'Other Expenses', kind: :expense)

      puts "✓ Created #{accounts.count} accounts"
      puts "Financial chart of accounts setup complete!"
    end

    desc "Reset simple chart of accounts (WARNING: Destructive)"
    task reset_simple: :environment do
      if Rails.env.production?
        puts "ERROR: Cannot reset chart of accounts in production"
        exit 1
      end

      puts "Destroying existing chart of accounts..."
      Keepr::Account.delete_all
      puts "✓ Cleared"

      Rake::Task['trapid:financial:setup_simple'].invoke
    end
  end
end
