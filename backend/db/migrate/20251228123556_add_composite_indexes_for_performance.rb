class AddCompositeIndexesForPerformance < ActiveRecord::Migration[8.0]
  def change
    # Ultra Code Review Round 4: Performance optimization indexes

    # job_contacts: Composite index for pipeline_job_to_json helper
    # Query pattern: job.job_contacts.find { |jc| jc.role == "client" }
    add_index :job_contacts, [:job_id, :role], name: "idx_job_contacts_job_role"

    # email_warehouse: Composite index for common filter combination
    # Query pattern: EmailWarehouse.where(job_id: ...).order(received_at: :desc)
    add_index :email_warehouse, [:job_id, :received_at],
              order: { received_at: :desc },
              name: "idx_email_warehouse_job_received"
  end
end
