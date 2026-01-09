class ChangeContactTypeToArray < ActiveRecord::Migration[7.0]
  def up
    # Add new column for array of types
    add_column :contacts, :contact_types, :string, array: true, default: []

    # Migrate existing data
    Contact.reset_column_information
    Contact.find_each do |contact|
      if contact.contact_type.present?
        contact.update_column(:contact_types, [ contact.contact_type ])
      end
    end

    # Remove old column
    remove_column :contacts, :contact_type

    # Add index on new column
    add_index :contacts, :contact_types, using: 'gin'
  end

  def down
    # Add back old column
    add_column :contacts, :contact_type, :string, default: "customer"

    # Migrate data back (take first type)
    Contact.reset_column_information
    Contact.find_each do |contact|
      if contact.contact_types.present?
        contact.update_column(:contact_type, contact.contact_types.first)
      end
    end

    # Remove array column
    remove_column :contacts, :contact_types

    # Add back index
    add_index :contacts, :contact_type
  end
end
