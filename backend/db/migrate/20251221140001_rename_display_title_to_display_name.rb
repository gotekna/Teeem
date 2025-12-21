# SSoT Refactor: display_name matches DocumentType naming convention
class RenameDisplayTitleToDisplayName < ActiveRecord::Migration[8.0]
  def change
    rename_column :corporate_company_documents, :display_title, :display_name
  end
end
