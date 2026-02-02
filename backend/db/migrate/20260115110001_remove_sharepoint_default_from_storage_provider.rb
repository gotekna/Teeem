# frozen_string_literal: true

# Remove "sharepoint" database default from storage_provider columns
# SSoT: StorableDocument concern now auto-assigns based on StorageConfiguration
class RemoveSharepointDefaultFromStorageProvider < ActiveRecord::Migration[7.2]
  def up
    # Remove defaults - StorableDocument concern handles assignment
    change_column_default :job_documents, :storage_provider, from: "sharepoint", to: nil
    change_column_default :corporate_documents, :storage_provider, from: "sharepoint", to: nil
    change_column_default :people_documents, :storage_provider, from: "sharepoint", to: nil
  end

  def down
    # Restore defaults (for rollback)
    change_column_default :job_documents, :storage_provider, from: nil, to: "sharepoint"
    change_column_default :corporate_documents, :storage_provider, from: nil, to: "sharepoint"
    change_column_default :people_documents, :storage_provider, from: nil, to: "sharepoint"
  end
end
