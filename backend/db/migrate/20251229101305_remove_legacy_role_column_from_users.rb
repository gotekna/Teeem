class RemoveLegacyRoleColumnFromUsers < ActiveRecord::Migration[8.0]
  def change
    # Remove legacy single-role column from users table
    # SSoT for roles is now: user_roles + roles tables (many-to-many)
    # This column was deprecated in favor of the multi-role system
    remove_column :users, :role, :string, default: "user", null: false
  end
end
