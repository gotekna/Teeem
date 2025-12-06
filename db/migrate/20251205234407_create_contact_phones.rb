class CreateContactPhones < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_phones do |t|
      t.references :contact, null: false, foreign_key: true
      t.string :phone_number, null: false
      t.string :phone_type, null: false, default: 'mobile' # mobile, office, fax, home
      t.boolean :is_primary, default: false, null: false
      t.string :label
      t.integer :position, default: 0

      t.timestamps
    end

    add_index :contact_phones, [ :contact_id, :is_primary ], where: "is_primary = true", name: "index_contact_phones_on_primary"
    add_index :contact_phones, [ :contact_id, :position ]
  end
end
