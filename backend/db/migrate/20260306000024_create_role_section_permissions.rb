# frozen_string_literal: true

class CreateRoleSectionPermissions < ActiveRecord::Migration[7.2]
  def change
    create_table :role_section_permissions do |t|
      t.references :role, null: false, foreign_key: true
      t.string :permission_key, null: false
      t.integer :level, null: false, default: 0

      t.timestamps
    end

    add_index :role_section_permissions, [:role_id, :permission_key], unique: true, name: "idx_role_section_perms_unique"
  end
end
