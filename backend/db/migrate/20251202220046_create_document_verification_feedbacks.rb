class CreateDocumentVerificationFeedbacks < ActiveRecord::Migration[8.0]
  def change
    create_table :document_verification_feedbacks do |t|
      t.references :company_document, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true

      # What AI suggested
      t.string :ai_suggested_name
      t.string :ai_suggested_folder
      t.string :ai_suggested_type
      t.string :ai_suggested_fy
      t.integer :ai_confidence

      # What user chose
      t.string :user_final_name
      t.string :user_final_folder
      t.string :user_final_type
      t.string :user_final_fy

      # Feedback type: 'accepted', 'rejected', 'modified'
      t.string :action, null: false

      # Optional: why user disagreed
      t.text :rejection_reason

      # Context for learning
      t.text :document_text_snippet # First ~500 chars of extracted text
      t.string :company_code        # Company code for pattern learning

      t.timestamps
    end

    add_index :document_verification_feedbacks, :action
    add_index :document_verification_feedbacks, :company_code
    add_index :document_verification_feedbacks, [ :company_code, :action ]
  end
end
