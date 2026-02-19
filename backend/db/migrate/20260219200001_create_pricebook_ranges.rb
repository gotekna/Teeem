class CreatePricebookRanges < ActiveRecord::Migration[8.0]
  def change
    create_table :pricebook_ranges do |t|
      t.string :name, null: false
      t.string :display_name
      t.string :color, default: '#6B7280'
      t.string :icon
      t.integer :position, default: 0
      t.boolean :is_active, default: true
      t.bigint :tenant_id
      t.string :sync_key

      t.timestamps
    end

    add_index :pricebook_ranges, [:tenant_id, :name], unique: true
    add_index :pricebook_ranges, :position
    add_index :pricebook_ranges, :is_active
    add_index :pricebook_ranges, :tenant_id
    add_index :pricebook_ranges, [:tenant_id, :sync_key], name: "idx_pricebook_ranges_on_tenant_sync_key", where: "(sync_key IS NOT NULL)"
    add_foreign_key :pricebook_ranges, :tenants
  end
end
