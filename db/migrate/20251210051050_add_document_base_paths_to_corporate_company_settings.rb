class AddDocumentBasePathsToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_company_settings, :company_documents_base_path, :string, default: "00 TEEEM PRIVATE"
    add_column :corporate_company_settings, :people_documents_base_path, :string, default: "teeem/Corporate/People"
    add_column :corporate_company_settings, :job_documents_base_path, :string, default: "TEEEM Jobs"
  end
end
