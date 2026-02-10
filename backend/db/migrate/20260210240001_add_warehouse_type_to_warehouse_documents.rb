# frozen_string_literal: true

# Add warehouse_type as a materialized column on warehouse_documents.
#
# This stores the derived warehouse type code (e.g., "job", "contact", "email")
# directly on the document, computed from source_type (and linkable_type when present).
# Previously computed at runtime via WarehousePathComputer#source_type_to_warehouse_type_code.
#
# Benefits:
#   - Direct filtering/grouping in SQL without joins to warehouse_types table
#   - Consistent with source_type pattern (string column)
#   - Auto-set via model callback on create/update
#
class AddWarehouseTypeToWarehouseDocuments < ActiveRecord::Migration[7.1]
  disable_ddl_transaction!

  def up
    add_column :warehouse_documents, :warehouse_type, :string unless column_exists?(:warehouse_documents, :warehouse_type)

    add_index :warehouse_documents, :warehouse_type,
              name: "idx_wd_warehouse_type",
              algorithm: :concurrently,
              if_not_exists: true

    # Composite index for tenant + warehouse_type filtering
    add_index :warehouse_documents, [:tenant_id, :warehouse_type],
              name: "idx_wd_tenant_warehouse_type",
              algorithm: :concurrently,
              if_not_exists: true

    # Backfill existing records using the same mapping as WarehousePathComputer
    backfill_warehouse_types
  end

  def down
    remove_index :warehouse_documents, name: "idx_wd_tenant_warehouse_type", if_exists: true
    remove_index :warehouse_documents, name: "idx_wd_warehouse_type", if_exists: true
    remove_column :warehouse_documents, :warehouse_type if column_exists?(:warehouse_documents, :warehouse_type)
  end

  private

  def backfill_warehouse_types
    # Use CASE statement for efficient bulk update matching WarehousePathComputer mapping
    #
    # Step 1: Set from linkable_type (most precise)
    execute <<-SQL
      UPDATE warehouse_documents
      SET warehouse_type = CASE linkable_type
        WHEN 'Job' THEN 'job'
        WHEN 'Contact' THEN 'contact'
        WHEN 'CorporateCompany' THEN 'corporate'
        WHEN 'SmTask' THEN 'task'
        ELSE NULL
      END
      WHERE linkable_type IS NOT NULL
        AND warehouse_type IS NULL
    SQL

    # Step 2: Fill remaining from source_type (fallback for docs without linkable)
    execute <<-SQL
      UPDATE warehouse_documents
      SET warehouse_type = CASE source_type
        WHEN 'task' THEN 'task'
        WHEN 'email' THEN 'email'
        WHEN 'email_attachment' THEN 'email'
        WHEN 'corporate' THEN 'corporate'
        WHEN 'xero' THEN 'corporate'
        WHEN 'financial' THEN 'corporate'
        WHEN 'asset' THEN 'corporate'
        WHEN 'job' THEN 'job'
        WHEN 'compliance' THEN 'job'
        WHEN 'contact' THEN 'contact'
        WHEN 'people' THEN 'contact'
        WHEN 'case' THEN 'case'
        WHEN 'notebook' THEN 'notebook'
        WHEN 'user' THEN 'user'
        WHEN 'warehouse' THEN 'warehouse'
        WHEN 'template' THEN 'warehouse'
        WHEN 'esignature' THEN 'e_signing'
        ELSE 'unassigned'
      END
      WHERE warehouse_type IS NULL
    SQL
  end
end
