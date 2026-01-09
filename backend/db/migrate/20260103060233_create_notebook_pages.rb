# frozen_string_literal: true

class CreateNotebookPages < ActiveRecord::Migration[8.0]
  def change
    create_table :notebook_pages do |t|
      t.references :section, null: false, foreign_key: { to_table: :notebook_sections }
      t.string :title, default: "Untitled", null: false
      t.text :content
      t.jsonb :content_metadata, default: {}
      t.integer :position, default: 0, null: false
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :last_edited_by, foreign_key: { to_table: :users }
      t.boolean :is_pinned, default: false, null: false
      t.datetime :archived_at

      t.timestamps
    end

    add_index :notebook_pages, [:section_id, :position]
    add_index :notebook_pages, :is_pinned
    add_index :notebook_pages, :archived_at
  end
end
