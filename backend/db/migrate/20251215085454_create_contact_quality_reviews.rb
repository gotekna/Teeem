class CreateContactQualityReviews < ActiveRecord::Migration[7.1]
  def change
    create_table :contact_quality_reviews do |t|
      t.references :contact, null: false, foreign_key: true
      t.references :suggested_company, foreign_key: { to_table: :contacts }
      t.string :issue_type, null: false
      t.string :status, default: "pending", null: false
      t.string :recommended_action, null: false
      t.integer :confidence_score, default: 0
      t.jsonb :analysis_data, default: {}
      t.jsonb :abr_data
      t.string :email_domain
      t.string :derived_company_name
      t.text :review_notes
      t.references :reviewed_by, foreign_key: { to_table: :users }
      t.datetime :reviewed_at

      t.timestamps
    end

    add_index :contact_quality_reviews, :status
    add_index :contact_quality_reviews, :issue_type
    add_index :contact_quality_reviews, [:contact_id, :issue_type], unique: true, name: "idx_quality_reviews_contact_issue"
  end
end
