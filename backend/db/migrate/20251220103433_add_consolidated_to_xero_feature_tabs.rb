class AddConsolidatedToXeroFeatureTabs < ActiveRecord::Migration[8.0]
  def up
    # Add consolidated tab for head companies with subsidiaries
    execute <<-SQL
      INSERT INTO xero_feature_tabs (tab_key, display_name, tab_group, order_position, enabled, component_name, icon_name, description, created_at, updated_at)
      VALUES
        ('consolidated', 'Consolidated', 'data', 8, true, 'XeroConsolidatedCard', 'Layers', 'Consolidated P&L and Balance Sheet for head companies with subsidiaries', NOW(), NOW())
      ON CONFLICT (tab_key) DO NOTHING;
    SQL
  end

  def down
    execute <<-SQL
      DELETE FROM xero_feature_tabs WHERE tab_key = 'consolidated';
    SQL
  end
end
