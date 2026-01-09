# MASTERPIECE: Plans Performance - Phase 1
# Add counter cache columns to eliminate N+1 queries for counts
#
# SSoT: These columns become THE source of truth for plan counts.
# Rails counter_cache + custom callbacks keep them in sync.
#
class AddPlanCounterCaches < ActiveRecord::Migration[8.0]
  def change
    # Jobs table - total plans and on-issue plans per job
    add_column :jobs, :plans_count, :integer, default: 0, null: false
    add_column :jobs, :on_issue_plans_count, :integer, default: 0, null: false

    # Job Plan Tabs - plans per tab category (Contract Drawings, etc.)
    add_column :job_plan_tabs, :plans_count, :integer, default: 0, null: false
    add_column :job_plan_tabs, :on_issue_plans_count, :integer, default: 0, null: false

    # Job Plans - revision count per plan
    add_column :job_plans, :revisions_count, :integer, default: 0, null: false

    # Index for efficient tab-level queries
    add_index :job_plan_tabs, [:job_id, :plans_count], name: "idx_job_plan_tabs_count"
  end
end
