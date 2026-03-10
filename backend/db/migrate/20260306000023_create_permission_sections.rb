# frozen_string_literal: true

class CreatePermissionSections < ActiveRecord::Migration[7.2]
  def change
    create_table :permission_sections do |t|
      t.string :key, null: false
      t.string :section, null: false
      t.string :sub_feature
      t.string :display_name, null: false
      t.text :description
      t.integer :position, null: false, default: 0
      t.boolean :is_section_header, null: false, default: false
      t.integer :available_levels, array: true, null: false, default: []

      t.timestamps
    end

    add_index :permission_sections, :key, unique: true
    add_index :permission_sections, :section
    add_index :permission_sections, [:section, :position]
  end
end
