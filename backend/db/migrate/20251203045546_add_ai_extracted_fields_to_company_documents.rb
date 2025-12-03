class AddAiExtractedFieldsToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    add_column :company_documents, :ai_extracted_description, :string
    add_column :company_documents, :ai_extracted_date, :date
    add_column :company_documents, :ai_source_page, :integer
    add_column :company_documents, :ai_source_quote, :text
  end
end
