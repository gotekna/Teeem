# frozen_string_literal: true

class CreateNotebookPageAttachments < ActiveRecord::Migration[8.0]
  def change
    create_table :notebook_page_attachments do |t|
      t.references :page, null: false, foreign_key: { to_table: :notebook_pages }
      t.references :uploaded_by, foreign_key: { to_table: :users }
      t.string :file_name, null: false
      t.string :content_type
      t.string :storage_key, null: false
      t.integer :file_size

      t.timestamps
    end

    add_index :notebook_page_attachments, :storage_key, unique: true
  end
end
