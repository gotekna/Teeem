class RenameConstructionToJob < ActiveRecord::Migration[8.0]
  def change
    # Rename main tables
    rename_table :constructions, :jobs
    rename_table :construction_contacts, :job_contacts
    rename_table :construction_documentation_tabs, :job_documentation_tabs

    # Rename foreign key columns in all tables that reference constructions
    rename_column :chat_messages, :construction_id, :job_id
    rename_column :job_documentation_tabs, :construction_id, :job_id
    rename_column :job_contacts, :construction_id, :job_id
    rename_column :emails, :construction_id, :job_id
    rename_column :estimates, :construction_id, :job_id
    rename_column :document_tasks, :construction_id, :job_id
    rename_column :financial_transactions, :construction_id, :job_id
    rename_column :maintenance_requests, :construction_id, :job_id
    rename_column :meetings, :construction_id, :job_id
    rename_column :one_drive_credentials, :construction_id, :job_id
    rename_column :rain_logs, :construction_id, :job_id
    rename_column :projects, :construction_id, :job_id
    rename_column :quote_requests, :construction_id, :job_id
    rename_column :purchase_orders, :construction_id, :job_id
    rename_column :schedule_tasks, :construction_id, :job_id
    rename_column :sm_hold_logs, :construction_id, :job_id
    rename_column :sm_rollover_logs, :construction_id, :job_id
    rename_column :sm_tasks, :construction_id, :job_id
    rename_column :supplier_ratings, :construction_id, :job_id
    rename_column :whs_inductions, :construction_id, :job_id
    rename_column :whs_incidents, :construction_id, :job_id
    rename_column :whs_inspections, :construction_id, :job_id
    rename_column :whs_swms, :construction_id, :job_id
  end
end
