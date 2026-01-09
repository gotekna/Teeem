class CreateContactEmails < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_emails do |t|
      t.references :contact, null: false, foreign_key: true
      t.string :email, null: false
      t.boolean :is_primary, default: false, null: false
      t.string :label
      t.integer :position, default: 0

      t.timestamps
    end

    add_index :contact_emails, [ :contact_id, :is_primary ], where: "is_primary = true", name: "index_contact_emails_on_primary"
    add_index :contact_emails, [ :contact_id, :position ]
  end
end
