# Add archival columns to jobs for warehouse scale management
# Sprint 8: Scale Preparation
class AddArchivalToJobs < ActiveRecord::Migration[8.0]
  def change
    # Archival tracking
    add_column :jobs, :archived_at, :datetime
    add_column :jobs, :archive_reason, :string
    add_column :jobs, :archived_by_id, :bigint

    # Indexes for efficient querying
    add_index :jobs, :archived_at
    add_index :jobs, [ :archived_at, :job_status_id ], name: 'idx_jobs_archived_status'

    # Foreign key for archived_by (optional - user who archived)
    add_foreign_key :jobs, :users, column: :archived_by_id, on_delete: :nullify
  end
end
