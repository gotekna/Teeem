# frozen_string_literal: true

# Migration: Create Warehouse Documents Foundation
#
# Creates a Foundation record for the warehouse_documents table.
# Uses table_type: "system" so columns are auto-discovered from the database schema.
# This enables a TeeemTableView on the File Warehouse page for admin/debugging.
#
# Foundation slug: warehouse-documents
# No manual column definitions needed - all columns auto-discovered.
#
class CreateWarehouseDocumentsFoundation < ActiveRecord::Migration[7.2]
  def up
    # Check if Foundation already exists (idempotent for shared DB)
    existing = execute("SELECT id FROM foundations WHERE slug = 'warehouse-documents' LIMIT 1")
    if existing.count.positive?
      puts "[CreateWarehouseDocumentsFoundation] Foundation already exists, skipping"
      return
    end

    execute(<<-SQL.squish)
      INSERT INTO foundations (
        name, singular_name, plural_name, database_table_name, model_class,
        slug, table_type, searchable, is_live, has_ui, has_saved_views,
        created_at, updated_at
      )
      VALUES (
        'Warehouse Documents', 'Warehouse Document', 'Warehouse Documents',
        'warehouse_documents', 'WarehouseDocument',
        'warehouse-documents', 'system', true, true, true, true,
        NOW(), NOW()
      )
    SQL

    puts "[CreateWarehouseDocumentsFoundation] Created Foundation for warehouse_documents (system table_type)"
  end

  def down
    execute("DELETE FROM columns WHERE foundation_id = (SELECT id FROM foundations WHERE slug = 'warehouse-documents')")
    execute("DELETE FROM foundations WHERE slug = 'warehouse-documents'")
  end
end
