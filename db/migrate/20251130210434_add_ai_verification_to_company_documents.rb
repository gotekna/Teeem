class AddAiVerificationToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :company_documents, :ai_verified_at, :datetime
    add_column :company_documents, :ai_verification_status, :string
    add_column :company_documents, :ai_suggested_name, :string
    add_column :company_documents, :ai_suggested_folder, :string
    add_column :company_documents, :ai_confidence_score, :decimal
    add_column :company_documents, :user_validated_at, :datetime
    add_column :company_documents, :user_validated_by_id, :bigint
  end
end
