class FixLegacyGlobalUniqueIndexOnDocumentTypes < ActiveRecord::Migration[8.0]
  def change
    # Remove legacy global unique index that conflicts with multi-tenant setup
    remove_index :document_types, name: :index_document_types_on_name_and_scope, if_exists: true

    # Add tenant-scoped unique index
    add_index :document_types, [:company_group_id, :name, :scope],
              name: :idx_document_types_tenant_name_scope,
              unique: true,
              where: "company_group_id IS NOT NULL"
  end
end
