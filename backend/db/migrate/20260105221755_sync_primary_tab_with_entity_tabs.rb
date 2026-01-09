class SyncPrimaryTabWithEntityTabs < ActiveRecord::Migration[8.0]
  def up
    # SSoT: Sync primary_tab column with first EntityTab for all document types
    execute <<~SQL
      UPDATE document_types dt
      SET primary_tab = et.display_name
      FROM (
        SELECT DISTINCT ON (etdt.document_type_id)
          etdt.document_type_id,
          et.display_name
        FROM entity_tab_document_types etdt
        JOIN entity_tabs et ON et.id = etdt.entity_tab_id
        ORDER BY etdt.document_type_id, etdt.id ASC
      ) et
      WHERE dt.id = et.document_type_id
    SQL

    # Clear primary_tab for document types with no entity tabs
    execute <<~SQL
      UPDATE document_types
      SET primary_tab = NULL
      WHERE id NOT IN (
        SELECT DISTINCT document_type_id FROM entity_tab_document_types
      )
      AND primary_tab IS NOT NULL
    SQL
  end

  def down
    # No rollback needed - this is a data sync
  end
end
