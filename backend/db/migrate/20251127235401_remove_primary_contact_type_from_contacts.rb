class RemovePrimaryContactTypeFromContacts < ActiveRecord::Migration[8.0]
  def change
    # Remove redundant column - use contact_types[0] instead
    # primary_contact_type was auto-set from contact_types.first anyway
    remove_column :contacts, :primary_contact_type, :string
  end
end
