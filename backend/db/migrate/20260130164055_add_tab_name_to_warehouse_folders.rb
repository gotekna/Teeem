# frozen_string_literal: true

# SSoT: Update warehouse_folders to use {{TabName}} placeholder (Jan 2026)
# Replaces confusing {{TeeemXL}} with clearer {{TabName}} for job, contact, corporate scopes
class AddTabNameToWarehouseFolders < ActiveRecord::Migration[8.0]
  def up
    # Update all StorageConfiguration records
    execute <<-SQL.squish
      UPDATE storage_configurations
      SET warehouse_folders = jsonb_set(
        jsonb_set(
          jsonb_set(
            warehouse_folders,
            '{job}',
            '"Jobs/{{JobCode}}/{{TabName}}"'
          ),
          '{contact}',
          '"Contacts/{{ContactName}}/{{TabName}}"'
        ),
        '{corporate}',
        '"Corporate/{{CompanyGroup}}/{{CompanyCode}}/{{TabName}}"'
      )
      WHERE warehouse_folders IS NOT NULL
    SQL

    # Also update warehouse scope
    execute <<-SQL.squish
      UPDATE storage_configurations
      SET warehouse_folders = jsonb_set(
        warehouse_folders,
        '{warehouse}',
        '"Warehousing/{{TabName}}"'
      )
      WHERE warehouse_folders IS NOT NULL
        AND warehouse_folders ? 'warehouse'
    SQL
  end

  def down
    # Revert to legacy {{TeeemXL}} placeholder
    execute <<-SQL.squish
      UPDATE storage_configurations
      SET warehouse_folders = jsonb_set(
        jsonb_set(
          jsonb_set(
            warehouse_folders,
            '{job}',
            '"Jobs/{{JobCode}}/{{TeeemXL}}"'
          ),
          '{contact}',
          '"Contacts/{{ContactName}}/{{TeeemXL}}"'
        ),
        '{corporate}',
        '"Corporate/{{CompanyGroup}}/{{CompanyCode}}/{{TeeemXL}}"'
      )
      WHERE warehouse_folders IS NOT NULL
    SQL

    execute <<-SQL.squish
      UPDATE storage_configurations
      SET warehouse_folders = jsonb_set(
        warehouse_folders,
        '{warehouse}',
        '"Warehousing/{{TeeemXL}}"'
      )
      WHERE warehouse_folders IS NOT NULL
        AND warehouse_folders ? 'warehouse'
    SQL
  end
end
