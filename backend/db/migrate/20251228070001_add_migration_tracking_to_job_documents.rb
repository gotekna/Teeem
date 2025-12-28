# frozen_string_literal: true

class AddMigrationTrackingToJobDocuments < ActiveRecord::Migration[8.0]
  def change
    # Track document migration between storage providers
    add_column :job_documents, :migration_status, :string, default: nil
    add_column :job_documents, :migration_started_at, :datetime
    add_column :job_documents, :migration_completed_at, :datetime
    add_column :job_documents, :migration_error, :text
    add_column :job_documents, :source_provider, :string  # Original provider before migration
    add_column :job_documents, :source_item_id, :string   # Original item ID before migration

    add_index :job_documents, :migration_status
  end
end
