# frozen_string_literal: true

# Add source and external_id to ContactDocument for SSoT consistency
# These columns enable tracking documents from external sources (Xero, SharePoint, etc.)
# and prevent duplicate imports via unique constraint on external_id
class AddSourceAndExternalIdToContactDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :contact_documents, :source, :string, default: "manual"
    add_column :contact_documents, :external_id, :string

    # Index for faster lookups by source
    add_index :contact_documents, :source

    # Unique index on source + external_id to prevent duplicate imports
    add_index :contact_documents, [:source, :external_id], unique: true, where: "external_id IS NOT NULL"
  end
end
