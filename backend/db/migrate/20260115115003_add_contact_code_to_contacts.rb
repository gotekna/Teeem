# frozen_string_literal: true

class AddContactCodeToContacts < ActiveRecord::Migration[8.0]
  def up
    # Add contact_code column (nullable initially for backfill)
    add_column :contacts, :contact_code, :string

    # Backfill existing contacts with "C" + id
    Contact.reset_column_information
    Contact.find_each do |contact|
      contact.update_column(:contact_code, "C#{contact.id}")
    end

    # Now make it NOT NULL and add unique index
    change_column_null :contacts, :contact_code, false
    add_index :contacts, :contact_code, unique: true
  end

  def down
    remove_index :contacts, :contact_code
    remove_column :contacts, :contact_code
  end
end
