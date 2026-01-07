# frozen_string_literal: true

class CreateNotebookSections < ActiveRecord::Migration[8.0]
  def change
    create_table :notebook_sections do |t|
      t.references :notebook, null: false, foreign_key: true
      t.string :name, null: false
      t.integer :position, default: 0, null: false
      t.string :color
      t.datetime :archived_at

      t.timestamps
    end

    add_index :notebook_sections, [:notebook_id, :position]
    add_index :notebook_sections, :archived_at
  end
end
