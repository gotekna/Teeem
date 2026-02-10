# frozen_string_literal: true

# FRC (Feb 2026): Missing index on assigned_role caused full table scans
# in for_user_roles scope. This column is used in WHERE conditions for
# role-based task assignment (department roles + job-specific roles).
# Composite index with assigned_user_id covers the common WHERE pattern:
#   WHERE assigned_role = ? AND assigned_user_id IS NULL
class AddIndexSmTasksOnAssignedRole < ActiveRecord::Migration[7.2]
  disable_ddl_transaction!

  def change
    add_index :sm_tasks, [:assigned_role, :assigned_user_id],
              name: "idx_sm_tasks_role_user",
              algorithm: :concurrently
  end
end
