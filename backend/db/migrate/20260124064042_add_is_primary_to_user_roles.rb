# frozen_string_literal: true

# Add is_primary column to user_roles table
# Users with multiple roles can designate one as "primary" to determine default settings
# Only one role per user can be marked as primary (enforced by partial unique index)
class AddIsPrimaryToUserRoles < ActiveRecord::Migration[7.2]
  def up
    add_column :user_roles, :is_primary, :boolean, default: false, null: false

    # Add partial unique index: only one is_primary=true per user
    add_index :user_roles, [:user_id],
              where: "is_primary = true",
              unique: true,
              name: "index_user_roles_on_user_id_primary"

    # Auto-set primary for users with exactly one role
    # Users with multiple roles will need to choose their primary role manually
    execute <<-SQL
      WITH single_role_users AS (
        SELECT user_id
        FROM user_roles
        GROUP BY user_id
        HAVING COUNT(*) = 1
      )
      UPDATE user_roles
      SET is_primary = true
      WHERE user_id IN (SELECT user_id FROM single_role_users);
    SQL
  end

  def down
    remove_index :user_roles, name: "index_user_roles_on_user_id_primary"
    remove_column :user_roles, :is_primary
  end
end
