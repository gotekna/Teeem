class RemoveCertificateFieldsFromScheduleMaster < ActiveRecord::Migration[8.0]
  def change
    # Remove from template (sm_schedule_master)
    remove_column :sm_schedule_master, :require_certificate, :boolean
    remove_column :sm_schedule_master, :cert_lag_days, :integer
    remove_column :sm_schedule_master, :certificate_document_type_ids, :jsonb

    # Remove from job tasks (sm_tasks) - note: cert_lag_days was never added to sm_tasks
    remove_column :sm_tasks, :require_certificate, :boolean
    remove_column :sm_tasks, :certificate_document_type_ids, :jsonb
  end
end
