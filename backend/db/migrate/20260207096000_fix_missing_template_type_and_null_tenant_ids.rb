# frozen_string_literal: true

# Fix missing template warehouse_type and NULL tenant_id on warehouse_folders
#
# Root causes:
# 1. template warehouse_type (id=9) was deleted or never created on production
# 2. Some warehouse_folders were seeded without tenant_id, making them invisible
#    to acts_as_tenant scoped queries
#
class FixMissingTemplateTypeAndNullTenantIds < ActiveRecord::Migration[8.0]
  def up
    # Step 1: Get the primary tenant_id from existing warehouse data
    # (All existing warehouse_types have the same tenant_id)
    primary_tenant_id = execute(<<~SQL).first&.dig("tenant_id")
      SELECT tenant_id FROM warehouse_types WHERE tenant_id IS NOT NULL LIMIT 1
    SQL

    unless primary_tenant_id
      say "No warehouse_types with tenant_id found - skipping migration"
      return
    end

    say "Primary tenant_id: #{primary_tenant_id}"

    # Step 2: Create missing template warehouse_type if it doesn't exist
    template_exists = execute(<<~SQL).first&.dig("exists")
      SELECT EXISTS(SELECT 1 FROM warehouse_types WHERE code = 'template' AND tenant_id = #{primary_tenant_id})
    SQL

    unless template_exists
      execute(<<~SQL)
        INSERT INTO warehouse_types (code, display_name, icon_name, is_system, enabled, order_position, tenant_id, created_at, updated_at)
        VALUES ('template', 'Template', 'LayoutTemplate', FALSE, TRUE, 9, #{primary_tenant_id}, NOW(), NOW())
        ON CONFLICT DO NOTHING
      SQL
      say "Created missing 'template' warehouse_type"
    end

    # Step 3: Fix warehouse_folders with NULL tenant_id
    null_count = execute(<<~SQL).first&.dig("count")
      SELECT count(*) FROM warehouse_folders WHERE tenant_id IS NULL
    SQL

    if null_count.to_i > 0
      execute(<<~SQL)
        UPDATE warehouse_folders
        SET tenant_id = #{primary_tenant_id}
        WHERE tenant_id IS NULL
      SQL
      say "Fixed #{null_count} warehouse_folders with NULL tenant_id → #{primary_tenant_id}"
    end

    # Step 4: Fix warehouse_types with NULL tenant_id (if any)
    execute(<<~SQL)
      UPDATE warehouse_types
      SET tenant_id = #{primary_tenant_id}
      WHERE tenant_id IS NULL
    SQL
  end

  def down
    # Not reversible - we don't know which records had NULL tenant_id
    raise ActiveRecord::IrreversibleMigration
  end
end
