class AddContactFolderFormatToCompanySettings < ActiveRecord::Migration[8.0]
  def change
    # Format options: 'id_name' (default), 'name_only', 'id_only'
    # Examples for contact "ABC Supplies" (ID: 123):
    #   id_name:   "123 - ABC Supplies"
    #   name_only: "ABC Supplies"
    #   id_only:   "123"
    add_column :company_settings, :contact_folder_format, :string, default: 'id_name'
  end
end
