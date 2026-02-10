# frozen_string_literal: true

class CreatePdfGenerations < ActiveRecord::Migration[8.0]
  def change
    create_table :pdf_generations do |t|
      t.string :status, null: false, default: "pending"
      t.string :generator_type, null: false
      t.jsonb :generator_params, null: false, default: {}
      t.references :user, foreign_key: true
      t.references :tenant, foreign_key: true
      t.references :storage_blob, foreign_key: true
      t.string :result_filename
      t.string :error_message
      t.timestamps
    end

    add_index :pdf_generations, :status
    add_index :pdf_generations, [:user_id, :status]
  end
end
