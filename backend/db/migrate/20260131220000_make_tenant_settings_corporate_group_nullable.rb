# frozen_string_literal: true

# Make corporate_group_id nullable on tenant_settings
#
# SSoT Transition: Moving from CorporateGroup-based to Tenant-based settings.
# The tenant_id is now the primary relationship, corporate_group_id is kept
# for backward compatibility but should not be a required field.
class MakeTenantSettingsCorporateGroupNullable < ActiveRecord::Migration[7.2]
  def up
    # Make corporate_group_id nullable
    change_column_null :tenant_settings, :corporate_group_id, true

    # Ensure all existing records have tenant_id set if they have corporate_group_id
    execute <<-SQL
      UPDATE tenant_settings ts
      SET tenant_id = cg.tenant_id
      FROM corporate_groups cg
      WHERE ts.corporate_group_id = cg.id
        AND ts.tenant_id IS NULL
        AND cg.tenant_id IS NOT NULL
    SQL
  end

  def down
    # Before making NOT NULL again, ensure all records have a corporate_group_id
    execute <<-SQL
      UPDATE tenant_settings ts
      SET corporate_group_id = (
        SELECT cg.id FROM corporate_groups cg
        WHERE cg.tenant_id = ts.tenant_id
        LIMIT 1
      )
      WHERE ts.corporate_group_id IS NULL
    SQL

    change_column_null :tenant_settings, :corporate_group_id, false
  end
end
