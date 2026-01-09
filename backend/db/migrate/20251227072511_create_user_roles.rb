class CreateUserRoles < ActiveRecord::Migration[8.0]
  def change
    create_table :user_roles do |t|
      t.references :user, null: false, foreign_key: true
      t.references :role, null: false, foreign_key: true

      t.timestamps
    end

    # Prevent duplicate user-role assignments
    add_index :user_roles, [:user_id, :role_id], unique: true

    # Migrate existing role data from string column to join table
    reversible do |dir|
      dir.up do
        execute <<-SQL
          INSERT INTO user_roles (user_id, role_id, created_at, updated_at)
          SELECT u.id, r.id, NOW(), NOW()
          FROM users u
          JOIN roles r ON r.name = u.role
          WHERE u.role IS NOT NULL AND u.role != ''
        SQL
      end
    end
  end
end
