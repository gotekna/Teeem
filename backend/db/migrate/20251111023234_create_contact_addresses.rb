class CreateContactAddresses < ActiveRecord::Migration[8.0]
  def change
    create_table :contact_addresses do |t|
      t.references :contact, null: false, foreign_key: true
      t.string :address_type # STREET, POBOX, DELIVERY
      t.string :line1
      t.string :line2
      t.string :line3
      t.string :line4
      t.string :city
      t.string :region
      t.string :postal_code
      t.string :country
      t.string :attention_to
      t.boolean :is_primary, default: false

      t.timestamps
    end

    add_index :contact_addresses, :address_type
    add_index :contact_addresses, [ :contact_id, :is_primary ]
    add_index :contact_addresses, [ :contact_id, :address_type ]
  end
end
