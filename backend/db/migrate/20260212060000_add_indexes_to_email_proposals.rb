class AddIndexesToEmailProposals < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def change
    # email_job_proposals - currently has ZERO indexes (2828 slow queries, avg 471ms)
    add_index :email_job_proposals, :email_warehouse_id, algorithm: :concurrently,
              name: "idx_email_job_proposals_warehouse"
    add_index :email_job_proposals, :status, algorithm: :concurrently,
              name: "idx_email_job_proposals_status"
    add_index :email_job_proposals, :created_by_user_id, algorithm: :concurrently,
              name: "idx_email_job_proposals_created_by"
    add_index :email_job_proposals, :job_id, algorithm: :concurrently,
              name: "idx_email_job_proposals_job"
    add_index :email_job_proposals, [:email_warehouse_id, :status], algorithm: :concurrently,
              name: "idx_email_job_proposals_warehouse_status"

    # email_case_proposals - currently has ZERO indexes (2818 slow queries, avg 470ms)
    add_index :email_case_proposals, :email_warehouse_id, algorithm: :concurrently,
              name: "idx_email_case_proposals_warehouse"
    add_index :email_case_proposals, :status, algorithm: :concurrently,
              name: "idx_email_case_proposals_status"
    add_index :email_case_proposals, :created_by_id, algorithm: :concurrently,
              name: "idx_email_case_proposals_created_by"
    add_index :email_case_proposals, :case_record_id, algorithm: :concurrently,
              name: "idx_email_case_proposals_case"
    add_index :email_case_proposals, [:email_warehouse_id, :status], algorithm: :concurrently,
              name: "idx_email_case_proposals_warehouse_status"
  end
end
