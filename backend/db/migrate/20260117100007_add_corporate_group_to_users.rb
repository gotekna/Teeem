# frozen_string_literal: true

# Multi-tenancy: Add corporate_group_id to users table
# Users can belong to a tenant (corporate group), or NULL for unassigned users
class AddCorporateGroupToUsers < ActiveRecord::Migration[8.0]
  def change
    # Allow NULL because migration task will assign users after this runs
    add_reference :users, :corporate_group, foreign_key: { to_table: :corporate_groups }, index: true
  end
end
