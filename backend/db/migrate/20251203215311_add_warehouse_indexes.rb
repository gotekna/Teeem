# Warehouse Performance Indexes
# Sprint 1: Add composite indexes for common query patterns used by materialized views
class AddWarehouseIndexes < ActiveRecord::Migration[8.0]
  disable_ddl_transaction!  # Allow concurrent index creation

  def change
    # Tasks (SM) - Dashboard and job summary queries
    add_index :tasks, [ :job_id, :status, :start_date ],
              name: 'idx_tasks_job_status_start',
              algorithm: :concurrently,
              if_not_exists: true

    add_index :tasks, [ :job_id, :status ],
              name: 'idx_tasks_job_status',
              algorithm: :concurrently,
              if_not_exists: true

    # sm_time_entries - Already has [task_id, resource_id, entry_date]
    # Add approved filter for billing queries
    add_index :sm_time_entries, [ :task_id, :entry_date, :approved_at ],
              name: 'idx_sm_time_entries_task_date_approved',
              algorithm: :concurrently,
              if_not_exists: true

    # job_activities - Activity timeline queries
    add_index :job_activities, [ :job_id, :activity_type ],
              name: 'idx_job_activities_job_type',
              algorithm: :concurrently,
              if_not_exists: true

    add_index :job_activities, [ :job_id, :occurred_at ],
              name: 'idx_job_activities_job_occurred',
              algorithm: :concurrently,
              if_not_exists: true

    # company_documents - Document warehouse queries
    add_index :company_documents, [ :company_id, :ai_verification_status ],
              name: 'idx_company_docs_company_ai_status',
              algorithm: :concurrently,
              if_not_exists: true

    add_index :company_documents, [ :company_id, :document_type ],
              name: 'idx_company_docs_company_type',
              algorithm: :concurrently,
              if_not_exists: true

    add_index :company_documents, [ :company_id, :folder ],
              name: 'idx_company_docs_company_folder',
              algorithm: :concurrently,
              if_not_exists: true

    # email_warehouse - Already well indexed, add job + received_at for timeline
    add_index :email_warehouse, [ :job_id, :is_latest_in_thread, :received_at ],
              name: 'idx_email_warehouse_job_latest_received',
              algorithm: :concurrently,
              if_not_exists: true

    # purchase_orders - Reconciliation queries
    add_index :purchase_orders, [ :job_id, :supplier_id, :status ],
              name: 'idx_po_job_supplier_status',
              algorithm: :concurrently,
              if_not_exists: true

    # external_invoices - Reconciliation queries
    add_index :external_invoices, [ :job_id, :contact_id, :status ],
              name: 'idx_ext_inv_job_contact_status',
              algorithm: :concurrently,
              if_not_exists: true
  end
end
