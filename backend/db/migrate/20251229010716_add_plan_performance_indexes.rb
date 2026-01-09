# MASTERPIECE: Plans Performance - Phase 1
# Add indexes optimized for cursor-based pagination and filtering
#
class AddPlanPerformanceIndexes < ActiveRecord::Migration[8.0]
  def change
    # Composite index for cursor-based pagination within a job/tab
    # Supports: WHERE job_id = ? AND job_plan_tab_id = ? AND id < ? ORDER BY id DESC
    add_index :job_plans, [:job_id, :job_plan_tab_id, :id],
              name: "idx_job_plans_tab_pagination"

    # Partial index for on_issue revisions (much smaller than full index)
    # Only indexes rows where is_on_issue = true
    add_index :job_plan_revisions, [:job_plan_id],
              where: "is_on_issue = true",
              name: "idx_on_issue_revisions"

    # Index for efficient job-level pagination without tab filter
    # Supports: WHERE job_id = ? AND id < ? ORDER BY id DESC
    unless index_exists?(:job_plans, [:job_id, :id])
      add_index :job_plans, [:job_id, :id], name: "idx_job_plans_job_pagination"
    end
  end
end
