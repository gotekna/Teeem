class AddOcrAndHumanConfidenceToCorporateCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_company_documents, :ocr_confidence, :decimal
    add_column :corporate_company_documents, :human_confidence, :decimal
    add_column :corporate_company_documents, :ocr_method, :string
  end
end
