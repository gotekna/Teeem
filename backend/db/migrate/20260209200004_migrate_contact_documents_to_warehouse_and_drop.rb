# frozen_string_literal: true

class MigrateContactDocumentsToWarehouseAndDrop < ActiveRecord::Migration[7.2]
  def up
    # Step 1: Backfill linkable (Contact) from contact_documents.contact_id
    # ~10K WarehouseDocuments with documentable_type "ContactDocument" need their
    # linkable set so warehouse_path_computer can resolve tokens without raw SQL.
    execute <<-SQL
      UPDATE warehouse_documents wd
      SET linkable_type = 'Contact',
          linkable_id = cd.contact_id
      FROM contact_documents cd
      WHERE wd.documentable_type = 'ContactDocument'
        AND wd.documentable_id = cd.id
        AND wd.linkable_id IS NULL
        AND cd.contact_id IS NOT NULL
    SQL

    # Step 2: Backfill metadata.document_type_id from contact_documents.document_type_id
    # ~2,333 rows have a document_type_id needed for WFDT folder resolution.
    execute <<-SQL
      UPDATE warehouse_documents wd
      SET metadata = COALESCE(wd.metadata, '{}'::jsonb) || jsonb_build_object('document_type_id', cd.document_type_id)
      FROM contact_documents cd
      WHERE wd.documentable_type = 'ContactDocument'
        AND wd.documentable_id = cd.id
        AND (wd.metadata IS NULL OR (wd.metadata->>'document_type_id') IS NULL)
        AND cd.document_type_id IS NOT NULL
    SQL

    # Step 3: Drop the legacy table — data is now baked into WarehouseDocument
    drop_table :contact_documents
  end

  def down
    raise ActiveRecord::IrreversibleMigration,
      "contact_documents data has been migrated into warehouse_documents (linkable + metadata). " \
      "WarehouseDocument is the SSoT — this migration cannot be reversed."
  end
end
