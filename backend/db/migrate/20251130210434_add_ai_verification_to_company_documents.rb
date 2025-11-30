class AddAiVerificationToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    # AI verification fields
    add_column :company_documents, :ai_verified_at, :datetime
    add_column :company_documents, :ai_verification_status, :string  # pending, verified, mismatch, needs_review
    add_column :company_documents, :ai_suggested_name, :string       # What AI thinks the doc should be named
    add_column :company_documents, :ai_suggested_folder, :string     # What folder AI thinks it belongs to
    add_column :company_documents, :ai_suggested_type, :string       # What document type AI thinks it is
    add_column :company_documents, :ai_suggested_fy, :integer, array: true, default: []  # FY AI extracted
    add_column :company_documents, :ai_confidence_score, :decimal    # 0-100 confidence
    add_column :company_documents, :ai_analysis_notes, :text         # AI's explanation

    # User validation fields
    add_column :company_documents, :user_validated_at, :datetime
    add_column :company_documents, :user_validated_by_id, :bigint
    add_column :company_documents, :validation_required, :boolean, default: false  # Flag if user needs to validate

    # Human-readable display title (expanded from abbreviated filename)
    add_column :company_documents, :display_title, :string           # "Company Tax Return 2021" instead of "TD FY21 CTR"

    add_index :company_documents, :ai_verification_status
    add_index :company_documents, :validation_required
    add_foreign_key :company_documents, :users, column: :user_validated_by_id
  end
end
