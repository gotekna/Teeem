class ChangeAssignedRoleToAssignedRolesInUsers < ActiveRecord::Migration[8.0]
  def up
    # Add new jsonb column for multiple assigned roles
    add_column :users, :assigned_roles, :jsonb, default: []

    # Migrate existing data from assigned_role to assigned_roles
    execute <<-SQL
      UPDATE users
      SET assigned_roles = CASE
        WHEN assigned_role IS NOT NULL AND assigned_role != ''
        THEN jsonb_build_array(assigned_role)
        ELSE '[]'::jsonb
      END
    SQL

    # Remove the old column
    remove_column :users, :assigned_role
  end

  def down
    # Add back the old column
    add_column :users, :assigned_role, :string

    # Migrate data back (take first role from array)
    execute <<-SQL
      UPDATE users
      SET assigned_role = CASE
        WHEN jsonb_array_length(assigned_roles) > 0
        THEN assigned_roles->>0
        ELSE NULL
      END
    SQL

    # Remove the new column
    remove_column :users, :assigned_roles
  end
end
