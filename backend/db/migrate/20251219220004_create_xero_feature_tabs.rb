class CreateXeroFeatureTabs < ActiveRecord::Migration[8.0]
  def change
    create_table :xero_feature_tabs do |t|
      t.string :tab_key, null: false
      t.string :display_name, null: false
      t.string :tab_group, default: 'data'  # setup, data, reports, documents
      t.integer :order_position, default: 0
      t.boolean :enabled, default: true
      t.string :component_name  # for functional tabs (e.g., XeroConnectionCard)
      t.references :document_folder, foreign_key: true  # for document tabs
      t.string :icon_name  # lucide icon name
      t.text :description

      t.timestamps
    end

    add_index :xero_feature_tabs, :tab_key, unique: true
    add_index :xero_feature_tabs, :order_position
    add_index :xero_feature_tabs, :enabled

    # Seed default tabs
    reversible do |dir|
      dir.up do
        # Functional tabs (have component_name, no document_folder)
        execute <<-SQL
          INSERT INTO xero_feature_tabs (tab_key, display_name, tab_group, order_position, enabled, component_name, icon_name, created_at, updated_at)
          VALUES
            ('connection', 'Connection', 'setup', 1, true, 'XeroConnectionCard', 'Link2', NOW(), NOW()),
            ('overview', 'Overview', 'setup', 2, true, 'XeroOverviewCard', 'LayoutDashboard', NOW(), NOW()),
            ('accounts', 'Accounts', 'data', 3, true, 'XeroAccountsCard', 'List', NOW(), NOW()),
            ('profit-loss', 'Profit & Loss', 'data', 4, true, 'XeroProfitLossCard', 'TrendingUp', NOW(), NOW()),
            ('balance-sheet', 'Balance Sheet', 'data', 5, true, 'XeroBalanceSheetCard', 'Scale', NOW(), NOW()),
            ('reports', 'Reports', 'reports', 6, true, 'XeroReportsPanel', 'FileText', NOW(), NOW()),
            ('bank-accounts', 'Bank Accounts', 'data', 7, true, 'XeroBankAccountsCard', 'Landmark', NOW(), NOW());
        SQL
      end
    end
  end
end
