class AddAlignmentToCaseContacts < ActiveRecord::Migration[8.0]
  def change
    add_column :case_contacts, :alignment, :string, default: 'neutral'
    add_index :case_contacts, :alignment
  end
end
