# frozen_string_literal: true

class DropUnusedPermissionTables < ActiveRecord::Migration[7.2]
  def up
    drop_table :user_permissions if table_exists?(:user_permissions)
    drop_table :role_permissions if table_exists?(:role_permissions)
    drop_table :permissions if table_exists?(:permissions)
  end

  def down
    create_table :permissions do |t|
      t.string :name, null: false
      t.text :description
      t.string :category
      t.boolean :enabled, default: true, null: false
      t.timestamps
    end
    add_index :permissions, :name, unique: true
    add_index :permissions, :category

    create_table :role_permissions do |t|
      t.string :role, null: false
      t.bigint :permission_id, null: false
      t.timestamps
    end
    add_index :role_permissions, :permission_id
    add_index :role_permissions, [:role, :permission_id], unique: true

    create_table :user_permissions do |t|
      t.bigint :user_id, null: false
      t.bigint :permission_id, null: false
      t.boolean :granted, null: false
      t.timestamps
    end
    add_index :user_permissions, :permission_id
    add_index :user_permissions, [:user_id, :permission_id], unique: true
    add_index :user_permissions, :user_id
  end
end
