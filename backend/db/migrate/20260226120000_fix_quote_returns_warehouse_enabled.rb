# frozen_string_literal: true

# Fix: Quote Returns folder needs warehouse_enabled=true so that:
# 1. Documents can be filed under it (WarehouseDocumentCreator uses warehouse_folder_id)
# 2. It appears in the admin Document Types folder picker (filters by warehouse_enabled=true)
# 3. The "Quote Response" document type can be linked to it
#
# Also re-links the "Quote Response" document type to the Quote Returns folder
# in case the previous migration (20260226110000) couldn't find it.
class FixQuoteReturnsWarehouseEnabled < ActiveRecord::Migration[8.0]
  def up
    # Enable warehouse storage and set folder_segment on all Quote Returns folders.
    # folder_segment is needed so hierarchy_path shows "Job/Jobs/Quote Returns"
    # instead of "Job/Jobs" (same as parent), which makes the folder picker display wrong.
    execute(<<-SQL.squish)
      UPDATE warehouse_folders
      SET warehouse_enabled = true,
          folder_segment = 'Quote Returns'
      WHERE tab_key = 'quote-returns'
    SQL

    # Re-link "Quote Response" document type to "Quote Returns" folder for each tenant
    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        dt = DocumentType.find_by(name: "Quote Response", scope: "job")
        next unless dt

        qr_folder = WarehouseFolder
          .joins(:warehouse_type)
          .where(warehouse_types: { code: "job" })
          .find_by(tab_key: "quote-returns")
        next unless qr_folder

        # Only add if not already linked (explicit tenant_id for join table)
        existing = WarehouseFolderDocumentType.find_by(
          warehouse_folder_id: qr_folder.id,
          document_type_id: dt.id,
          tenant_id: tenant.id
        )
        unless existing
          WarehouseFolderDocumentType.create!(
            warehouse_folder_id: qr_folder.id,
            document_type_id: dt.id,
            tenant_id: tenant.id,
            is_primary: true
          )
        end

        # Also clean up any bad link (wrong folder) from previous migration
        WarehouseFolderDocumentType
          .where(document_type_id: dt.id, tenant_id: tenant.id)
          .where.not(warehouse_folder_id: qr_folder.id)
          .destroy_all
      end
    end
  end

  def down
    execute(<<-SQL.squish)
      UPDATE warehouse_folders
      SET warehouse_enabled = false
      WHERE tab_key = 'quote-returns'
    SQL
  end
end
