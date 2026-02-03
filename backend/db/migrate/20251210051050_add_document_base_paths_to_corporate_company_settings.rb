class AddDocumentBasePathsToCorporateCompanySettings < ActiveRecord::Migration[8.0]
  def change
    add_column :corporate_settings, :company_documents_base_path, :string, default: "/Teeem/Companies"
    add_column :corporate_settings, :people_documents_base_path, :string, default: "/Teeem/Director IDs"
    add_column :corporate_settings, :job_documents_base_path, :string, default: "/Teeem/Jobs"
  end
end
