class AddRelationshipFieldsToCaseContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :case_contacts, :relationship_type, :string
    add_column :case_contacts, :relationship_description, :text
    add_column :case_contacts, :display_position, :jsonb, default: {}

    add_index :case_contacts, :relationship_type
  end
end
