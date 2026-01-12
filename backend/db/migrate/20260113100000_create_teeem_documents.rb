# frozen_string_literal: true

class CreateTeeemDocuments < ActiveRecord::Migration[8.0]
  def change
    create_table :teeem_documents do |t|
      t.string :name, null: false, default: "Untitled Document"
      t.jsonb :data, null: false, default: {}
      t.references :user, null: false, foreign_key: true
      t.references :job, null: true, foreign_key: true
      t.boolean :is_template, null: false, default: false
      t.text :description
      t.string :storage_path
      t.string :storage_provider

      t.timestamps
    end

    add_index :teeem_documents, :name
    add_index :teeem_documents, :is_template
    add_index :teeem_documents, [:user_id, :updated_at]
    add_index :teeem_documents, [:job_id, :updated_at]
  end
end
