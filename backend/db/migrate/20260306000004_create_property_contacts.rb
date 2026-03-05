class CreatePropertyContacts < ActiveRecord::Migration[8.0]
  def change
    create_table :property_contacts do |t|
      t.bigint :tenant_id, null: false
      t.references :property, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true

      t.string :role, null: false # owner, tenant, co_tenant, guarantor, agent, property_manager, sda_participant
      t.boolean :is_primary, default: false, null: false
      t.date :start_date
      t.date :end_date
      t.text :notes

      t.timestamps
    end

    add_index :property_contacts, :tenant_id
    add_index :property_contacts, :role
    add_index :property_contacts, [:property_id, :contact_id, :role], unique: true, name: "idx_prop_contact_role_unique"
  end
end
