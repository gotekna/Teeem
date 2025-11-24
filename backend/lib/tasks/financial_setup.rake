namespace :trapid do
  namespace :financial do
    desc "Set up default chart of accounts for financial tracking"
    task setup_chart_of_accounts: :environment do
      puts "Setting up default chart of accounts..."

      # Create account groups first
      groups = setup_account_groups
      puts "✓ Created #{groups.count} account groups"

      # Create accounts
      accounts = setup_accounts(groups)
      puts "✓ Created #{accounts.count} accounts"

      puts "Financial chart of accounts setup complete!"
    end

    desc "Reset chart of accounts (WARNING: Destructive)"
    task reset_chart_of_accounts: :environment do
      if Rails.env.production?
        puts "ERROR: Cannot reset chart of accounts in production"
        exit 1
      end

      puts "Destroying existing chart of accounts..."
      Keepr::Account.delete_all
      # Delete groups from bottom up (children first)
      Keepr::Group.order('ancestry DESC NULLS LAST').delete_all
      puts "✓ Cleared"

      Rake::Task['trapid:financial:setup_chart_of_accounts'].invoke
    end

    def setup_account_groups
      groups = {}

      # Assets
      groups[:assets] = Keepr::Group.create!(
        name: 'Assets',
        is_result: false,
        target: 'liability'
      )

      groups[:current_assets] = Keepr::Group.create!(
        name: 'Current Assets',
        parent: groups[:assets],
        is_result: false,
        target: 'liability'
      )

      groups[:fixed_assets] = Keepr::Group.create!(
        name: 'Fixed Assets',
        parent: groups[:assets],
        is_result: false,
        target: 'liability'
      )

      # Liabilities
      groups[:liabilities] = Keepr::Group.create!(
        name: 'Liabilities',
        is_result: false,
        target: 'liability'
      )

      groups[:current_liabilities] = Keepr::Group.create!(
        name: 'Current Liabilities',
        parent: groups[:liabilities],
        is_result: false,
        target: 'liability'
      )

      # Equity
      groups[:equity] = Keepr::Group.create!(
        name: 'Equity',
        is_result: false,
        target: 'liability'
      )

      # Revenue - result account needs liability parent
      groups[:revenue] = Keepr::Group.create!(
        name: 'Revenue',
        parent: groups[:equity],  # Result accounts need a liability parent
        is_result: true,
        target: 'liability'
      )

      # Expenses - result account needs asset parent
      groups[:expenses] = Keepr::Group.create!(
        name: 'Expenses',
        parent: groups[:equity],  # Result accounts need a liability parent
        is_result: true,
        target: 'asset'
      )

      groups
    end

    def setup_accounts(groups)
      accounts = []

      # ASSETS (1000-1999)
      accounts << Keepr::Account.create!(
        number: 1000,
        name: 'Cash - Bank Account',
        kind: :asset,
        keepr_group: groups[:current_assets]
      )

      accounts << Keepr::Account.create!(
        number: 1100,
        name: 'Accounts Receivable',
        kind: :asset,
        keepr_group: groups[:current_assets]
      )

      accounts << Keepr::Account.create!(
        number: 1200,
        name: 'Inventory',
        kind: :asset,
        keepr_group: groups[:current_assets]
      )

      accounts << Keepr::Account.create!(
        number: 1400,
        name: 'Tools & Equipment',
        kind: :asset,
        keepr_group: groups[:fixed_assets]
      )

      accounts << Keepr::Account.create!(
        number: 1500,
        name: 'Other Assets',
        kind: :asset,
        keepr_group: groups[:fixed_assets]
      )

      # LIABILITIES (2000-2999)
      accounts << Keepr::Account.create!(
        number: 2000,
        name: 'Accounts Payable',
        kind: :liability,
        keepr_group: groups[:current_liabilities]
      )

      accounts << Keepr::Account.create!(
        number: 2100,
        name: 'Credit Cards',
        kind: :liability,
        keepr_group: groups[:current_liabilities]
      )

      accounts << Keepr::Account.create!(
        number: 2200,
        name: 'Loans',
        kind: :liability,
        keepr_group: groups[:current_liabilities]
      )

      # EQUITY (3000-3999)
      accounts << Keepr::Account.create!(
        number: 3000,
        name: "Owner's Equity",
        kind: :liability,
        keepr_group: groups[:equity]
      )

      accounts << Keepr::Account.create!(
        number: 3100,
        name: 'Retained Earnings',
        kind: :liability,
        keepr_group: groups[:equity]
      )

      accounts << Keepr::Account.create!(
        number: 3200,
        name: 'Drawings',
        kind: :liability,
        keepr_group: groups[:equity]
      )

      # REVENUE (4000-4999)
      accounts << Keepr::Account.create!(
        number: 4000,
        name: 'Job Revenue',
        kind: :revenue,
        keepr_group: groups[:revenue]
      )

      accounts << Keepr::Account.create!(
        number: 4100,
        name: 'Material Sales',
        kind: :revenue,
        keepr_group: groups[:revenue]
      )

      accounts << Keepr::Account.create!(
        number: 4200,
        name: 'Other Income',
        kind: :revenue,
        keepr_group: groups[:revenue]
      )

      # EXPENSES (5000-5999)
      accounts << Keepr::Account.create!(
        number: 5000,
        name: 'Materials',
        kind: :expense,
        keepr_group: groups[:expenses]
      )

      accounts << Keepr::Account.create!(
        number: 5100,
        name: 'Labour',
        kind: :expense,
        keepr_group: groups[:expenses]
      )

      accounts << Keepr::Account.create!(
        number: 5200,
        name: 'Subcontractors',
        kind: :expense,
        keepr_group: groups[:expenses]
      )

      accounts << Keepr::Account.create!(
        number: 5300,
        name: 'Tools & Equipment Expense',
        kind: :expense,
        keepr_group: groups[:expenses]
      )

      accounts << Keepr::Account.create!(
        number: 5400,
        name: 'Fuel & Transport',
        kind: :expense,
        keepr_group: groups[:expenses]
      )

      accounts << Keepr::Account.create!(
        number: 5500,
        name: 'Insurance',
        kind: :expense,
        keepr_group: groups[:expenses]
      )

      accounts << Keepr::Account.create!(
        number: 5600,
        name: 'Professional Fees',
        kind: :expense,
        keepr_group: groups[:expenses]
      )

      accounts << Keepr::Account.create!(
        number: 5700,
        name: 'Other Expenses',
        kind: :expense,
        keepr_group: groups[:expenses]
      )

      accounts
    end
  end
end
