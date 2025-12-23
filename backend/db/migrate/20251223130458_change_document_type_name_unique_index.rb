class ChangeDocumentTypeNameUniqueIndex < ActiveRecord::Migration[8.0]
  def change
    # Remove the old unique index on name only
    remove_index :document_types, :name, unique: true, if_exists: true

    # Add new composite unique index on name + scope
    # This allows the same name in different scopes (e.g., "Invoice" for company and job)
    add_index :document_types, [:name, :scope], unique: true, name: "index_document_types_on_name_and_scope"
  end
end
