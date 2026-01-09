class CreateSupplierContacts < ActiveRecord::Migration[8.0]
  def change
    create_table :supplier_contacts do |t|
      t.references :supplier, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.boolean :is_primary, default: false

      t.timestamps
    end

    add_index :supplier_contacts, [ :supplier_id, :contact_id ], unique: true
  end
end
