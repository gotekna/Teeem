class CreateEmailJobProposals < ActiveRecord::Migration[8.0]
  def change
    create_table :email_job_proposals do |t|
      # Associations
      t.references :email_warehouse, foreign_key: { to_table: :email_warehouse }, null: false
      t.references :created_by_user, foreign_key: { to_table: :users }, null: false
      t.references :job, foreign_key: true, null: true # Null until approved

      # AI-extracted data stored as JSON
      # Structure: {
      #   job_title: "123 Main Street, Suburb",
      #   customer: { name: "John Smith", email: "...", phone: "...", company: "..." },
      #   description: "Client wants new deck",
      #   scope_of_work: "30sqm hardwood deck with railing",
      #   contract_value: 15000,
      #   job_type: "renovation",
      #   urgency: "normal",
      #   attachments_mentioned: ["deck_plan.pdf"],
      #   confidence_score: 0.85,
      #   missing_info: ["start_date"]
      # }
      t.jsonb :extracted_data, default: {}, null: false

      # AI processing metadata
      t.text :ai_prompt
      t.text :ai_response_raw
      t.integer :processing_time_ms
      t.string :ai_model_used

      # Status tracking
      t.string :status, default: 'pending', null: false
      # Status values: pending, approved, rejected, error
      t.text :rejection_reason
      t.text :error_message

      # Approval tracking
      t.references :approved_by_user, foreign_key: { to_table: :users }
      t.datetime :approved_at

      t.timestamps
    end

    # Indexes for common queries
    add_index :email_job_proposals, :status
    add_index :email_job_proposals, [ :email_warehouse_id, :status ]
    add_index :email_job_proposals, :created_at
  end
end
