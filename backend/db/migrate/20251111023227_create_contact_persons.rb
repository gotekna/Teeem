class CreateContactPersons < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_persons do |t|
      t.references :contact, null: false, foreign_key: true
      t.string :first_name
      t.string :last_name
      t.string :email
      t.boolean :include_in_emails, default: true
      t.boolean :is_primary, default: false
      t.string :xero_contact_person_id

      t.timestamps
    end

    add_index :contact_persons, :email
    add_index :contact_persons, :xero_contact_person_id
    add_index :contact_persons, [ :contact_id, :is_primary ]
  end
end
