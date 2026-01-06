# SSoT Cleanup: Remove deprecated assigned_roles column
# Roles are now stored ONLY in user_roles join table (User has_many :roles, through: :user_roles)
class RemoveAssignedRolesFromUsers < ActiveRecord::Migration[8.0]
  def change
    remove_column :users, :assigned_roles, :jsonb, default: []
  end
end
