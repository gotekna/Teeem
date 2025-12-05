class EnhanceCaseContacts < ActiveRecord::Migration[8.0]
  def change
    # Add reason field (required for new records)
    add_column :case_contacts, :reason, :text, null: false, default: ''

    # Add added_by_id to track who added the contact
    add_column :case_contacts, :added_by_id, :bigint
    add_index :case_contacts, :added_by_id
    add_foreign_key :case_contacts, :users, column: :added_by_id

    # Remove default from reason after adding column
    # (allows existing records to have empty string, but new ones require value via model validation)
    change_column_default :case_contacts, :reason, from: '', to: nil
  end
end
