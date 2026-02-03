class RemoveTitleFromCorporateCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    # SSoT: file_name is THE filename field. title is now fully deprecated.
    # Data was migrated in 20251221140000_consolidate_title_to_file_name
    remove_column :corporate_documents, :title, :string
  end
end
