class AddIncludeAllEmailsToCaseContacts < ActiveRecord::Migration[8.0]
  def change
    # Add flag to case_contacts
    add_column :case_contacts, :include_all_emails, :boolean, default: false, null: false
    add_index :case_contacts, [ :case_id, :include_all_emails ]

    # Add tracking to case_emails to show which were auto-linked
    add_column :case_emails, :auto_linked, :boolean, default: false, null: false
    add_column :case_emails, :auto_linked_via_contact_id, :bigint
    add_index :case_emails, [ :case_id, :auto_linked ]
    add_index :case_emails, :auto_linked_via_contact_id

    add_foreign_key :case_emails, :contacts, column: :auto_linked_via_contact_id
  end
end
