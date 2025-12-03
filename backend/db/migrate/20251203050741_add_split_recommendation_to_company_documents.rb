class AddSplitRecommendationToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :company_documents, :ai_contains_multiple_documents, :boolean, default: false
    add_column :company_documents, :ai_split_recommendation, :jsonb
  end
end
