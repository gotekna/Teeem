class CreateEmailCaseProposals < ActiveRecord::Migration[8.0]
  def change
    create_table :email_case_proposals do |t|
      t.references :email_warehouse, foreign_key: { to_table: :email_warehouse }
      t.references :case_record, foreign_key: { to_table: :cases }
      t.references :created_by, foreign_key: { to_table: :users }
      t.references :approved_by, foreign_key: { to_table: :users }

      t.string :status, default: 'pending', null: false
      t.jsonb :extracted_data, default: {}
      t.text :ai_prompt
      t.text :ai_response_raw
      t.integer :processing_time_ms
      t.string :ai_model_used
      t.decimal :confidence_score, precision: 3, scale: 2
      t.text :rejection_reason
      t.text :error_message
      t.datetime :approved_at

      # Additional folders to index into the case
      t.jsonb :folder_paths, default: []

      t.timestamps
    end

    add_index :email_case_proposals, :status
    add_index :email_case_proposals, [ :email_warehouse_id, :status ]
  end
end
