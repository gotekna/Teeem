class AddGroupMemberToXeroFeatureTabs < ActiveRecord::Migration[8.0]
  def change
    add_column :xero_feature_tabs, :group_member, :boolean, default: false, null: false
    add_column :xero_feature_tabs, :parent_key, :string
    add_column :xero_feature_tabs, :visible, :boolean, default: true, null: false
    
    # Add Group subtabs under Accounts, Profit & Loss, and Balance Sheet
    execute <<-SQL
      INSERT INTO xero_feature_tabs (tab_key, display_name, tab_group, order_position, enabled, component_name, icon_name, description, group_member, parent_key, visible, created_at, updated_at)
      VALUES
        ('consolidated-accounts', 'Group Accounts', 'data', 1, true, 'XeroGroupAccountsCard', 'Users', 'Chart of Accounts across all group companies', true, 'accounts', true, NOW(), NOW()),
        ('consolidated-pl', 'Group P&L', 'data', 2, true, 'XeroGroupPLCard', 'TrendingUp', 'Profit & Loss across all group companies', true, 'profit-loss', true, NOW(), NOW()),
        ('consolidated-bs', 'Group Balance Sheet', 'data', 3, true, 'XeroGroupBalanceSheetCard', 'Scale', 'Balance Sheet across all group companies', true, 'balance-sheet', true, NOW(), NOW())
      ON CONFLICT (tab_key) DO UPDATE SET
        group_member = EXCLUDED.group_member,
        parent_key = EXCLUDED.parent_key,
        visible = EXCLUDED.visible;
    SQL
  end
end
