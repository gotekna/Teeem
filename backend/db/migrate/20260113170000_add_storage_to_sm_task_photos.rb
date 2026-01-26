# frozen_string_literal: true

# Add storage columns to SmTaskPhoto for Wasabi integration
#
# SSoT: SmTaskPhoto will use StorableDocument concern to integrate with
# the storage system. The document_type_id links to DocumentType which
# determines the folder (via primary_tab) and filename (via file_name template).
#
class AddStorageToSmTaskPhotos < ActiveRecord::Migration[8.0]
  def change
    # Link to DocumentType SSoT (determines folder + filename)
    # Falls back to task.completion_document_type if not set directly
    add_reference :sm_task_photos, :document_type, foreign_key: true

    # Storage columns (same pattern as JobDocument, CorporateCompanyDocument, PeopleDocument)
    add_column :sm_task_photos, :storage_path, :string
    add_column :sm_task_photos, :storage_item_id, :string
    add_column :sm_task_photos, :storage_provider, :string, limit: 20

    # Migration tracking (for Cloudinary → Wasabi migration)
    add_column :sm_task_photos, :migration_status, :string, limit: 20
    add_column :sm_task_photos, :migration_error, :text
    add_column :sm_task_photos, :migration_started_at, :datetime
    add_column :sm_task_photos, :migration_completed_at, :datetime

    add_index :sm_task_photos, :storage_provider
    add_index :sm_task_photos, :migration_status
  end
end
