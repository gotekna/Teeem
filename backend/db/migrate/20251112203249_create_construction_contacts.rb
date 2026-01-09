class CreateConstructionContacts < ActiveRecord::Migration[8.0]
  def change
    create_table :construction_contacts do |t|
      t.references :construction, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.boolean :primary, default: false, null: false
      t.string :role

      t.timestamps
    end

    add_index :construction_contacts, [ :construction_id, :contact_id ], unique: true
    add_index :construction_contacts, [ :construction_id, :primary ]
  end
end
