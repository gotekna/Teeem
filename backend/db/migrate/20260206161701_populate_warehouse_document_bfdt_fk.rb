# frozen_string_literal: true

# SSoT (Feb 2026): Populate base_folder_document_type_id FK on WarehouseDocuments
#
# This migration links existing WarehouseDocuments to their BaseFolderDocumentType
# by matching:
#   1. metadata['document_type_id'] → BaseFolderDocumentType.document_type_id
#   2. source_type → WarehouseType.code → BaseFolder.warehouse_type_id
#
# Most documents (emails) don't have document_type_id and will remain NULL.
# That's fine - the FK is optional.
#
class PopulateWarehouseDocumentBfdtFk < ActiveRecord::Migration[7.2]
  def up
    # Build source_type → warehouse_type.code mapping
    # Note: source_type values should match warehouse_type codes
    source_to_warehouse_type = {
      'job' => 'job',
      'contact' => 'contact',
      'corporate' => 'corporate',
      'task' => 'task',
      'people' => 'people',
      'xero' => 'xero',
      'email' => 'email',
      'email_attachment' => 'email'
    }

    updated_count = 0
    skipped_count = 0

    # Process documents that have document_type_id in metadata
    # Using raw SQL for performance on large tables
    execute <<~SQL
      WITH doc_type_matches AS (
        SELECT
          wd.id AS warehouse_document_id,
          wd.source_type,
          (wd.metadata->>'document_type_id')::integer AS doc_type_id,
          wd.tenant_id
        FROM warehouse_documents wd
        WHERE wd.metadata->>'document_type_id' IS NOT NULL
          AND wd.base_folder_document_type_id IS NULL
      ),
      bfdt_matches AS (
        SELECT
          dtm.warehouse_document_id,
          bfdt.id AS bfdt_id
        FROM doc_type_matches dtm
        JOIN base_folder_document_types bfdt ON bfdt.document_type_id = dtm.doc_type_id
        JOIN base_folders bf ON bf.id = bfdt.base_folder_id
        JOIN warehouse_types wt ON wt.id = bf.warehouse_type_id
        WHERE wt.code = dtm.source_type
          AND bf.tenant_id = dtm.tenant_id
      )
      UPDATE warehouse_documents wd
      SET
        base_folder_document_type_id = bm.bfdt_id,
        updated_at = NOW()
      FROM bfdt_matches bm
      WHERE wd.id = bm.warehouse_document_id
    SQL

    # Report results
    linked_count = WarehouseDocument.where.not(base_folder_document_type_id: nil).count
    total_count = WarehouseDocument.count
    puts "Linked #{linked_count}/#{total_count} WarehouseDocuments to BaseFolderDocumentType"
  end

  def down
    # Clear all FKs (reversible for safety)
    execute <<~SQL
      UPDATE warehouse_documents
      SET base_folder_document_type_id = NULL, updated_at = NOW()
      WHERE base_folder_document_type_id IS NOT NULL
    SQL
  end
end
