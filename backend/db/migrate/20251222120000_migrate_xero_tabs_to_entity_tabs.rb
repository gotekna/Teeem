class MigrateXeroTabsToEntityTabs < ActiveRecord::Migration[8.0]
  # Phase 2: Migrate XeroFeatureTab to EntityTab (scope: xero)
  # This completes the SSoT unification for Xero tabs
  #
  # NOTE: The XeroFeatureTab model has been deleted. This migration now uses
  # raw SQL and checks if data was already migrated.

  def up
    # Check if already migrated
    existing_count = execute("SELECT COUNT(*) FROM entity_tabs WHERE scope = 'xero'").first['count'].to_i
    if existing_count > 0
      puts "Xero tabs already migrated (#{existing_count} found). Skipping."
      return
    end

    # Check if source table exists
    unless table_exists?(:xero_feature_tabs)
      puts "xero_feature_tabs table does not exist. Skipping migration."
      return
    end

    # First pass: Create all EntityTab records without parent relationships
    execute <<-SQL
      INSERT INTO entity_tabs (scope, tab_key, display_name, description, tab_group, order_position, enabled, icon_name, component_name, has_sharepoint_folder, is_system_tab, created_at, updated_at)
      SELECT
        'xero',
        tab_key,
        display_name,
        description,
        COALESCE(tab_group, 'overview'),
        COALESCE(order_position, 0),
        COALESCE(enabled, true),
        icon_name,
        component_name,
        document_folder_id IS NOT NULL,
        true,
        NOW(),
        NOW()
      FROM xero_feature_tabs
    SQL

    # Second pass: Set up parent relationships using parent_key
    execute <<-SQL
      UPDATE entity_tabs child
      SET parent_id = parent.id
      FROM xero_feature_tabs xft
      JOIN entity_tabs parent ON parent.scope = 'xero' AND parent.tab_key = xft.parent_key
      WHERE child.scope = 'xero'
        AND child.tab_key = xft.tab_key
        AND xft.parent_key IS NOT NULL
    SQL

    migrated_count = execute("SELECT COUNT(*) FROM entity_tabs WHERE scope = 'xero'").first['count'].to_i
    puts "Migrated #{migrated_count} Xero tabs to EntityTab"
  end

  def down
    execute("DELETE FROM entity_tabs WHERE scope = 'xero'")
  end
end
