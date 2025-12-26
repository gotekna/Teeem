class AddCertificateDocumentTypeIdsToSmScheduleMaster < ActiveRecord::Migration[8.0]
  def change
    # Add to template (sm_schedule_master)
    add_column :sm_schedule_master, :certificate_document_type_ids, :jsonb, default: []

    # Add to job tasks (sm_tasks) for syncing
    add_column :sm_tasks, :certificate_document_type_ids, :jsonb, default: []
  end
end
