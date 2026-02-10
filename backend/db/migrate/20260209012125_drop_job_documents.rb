# frozen_string_literal: true

class DropJobDocuments < ActiveRecord::Migration[7.1]
  def up
    # Remove FK from signature_usages before dropping the table
    remove_foreign_key :signature_usages, :job_documents, if_exists: true
    remove_column :signature_usages, :job_document_id, if_exists: true

    drop_table :job_documents, if_exists: true
  end

  def down
    raise ActiveRecord::IrreversibleMigration,
      "Cannot restore job_documents table. WarehouseDocument is the SSoT."
  end
end
