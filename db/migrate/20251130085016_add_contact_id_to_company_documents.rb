class AddContactIdToCompanyDocuments < ActiveRecord::Migration[8.0]
  def change
    # contact_id is optional - documents can belong to company OR contact (not both required)
    add_reference :company_documents, :contact, null: true, foreign_key: true

    # Also make company_id optional for documents that belong only to contacts
    change_column_null :company_documents, :company_id, true
  end
end
