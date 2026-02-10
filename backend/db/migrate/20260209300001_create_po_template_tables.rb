class CreatePoTemplateTables < ActiveRecord::Migration[8.0]
  def change
    # PO Template Packs - named template collections (e.g., "Standard House", "Townhouse")
    create_table :po_template_packs do |t|
      t.string   :name, null: false
      t.text     :description
      t.boolean  :is_active, default: true, null: false
      t.integer  :position, default: 0
      t.bigint   :tenant_id
      t.string   :sync_key
      t.bigint   :created_by_id
      t.bigint   :updated_by_id
      t.timestamps
    end

    add_index :po_template_packs, :tenant_id
    add_index :po_template_packs, [:tenant_id, :sync_key], unique: true, where: "sync_key IS NOT NULL"
    add_index :po_template_packs, [:tenant_id, :name], unique: true

    # PO Template Items - each PO definition within a pack
    create_table :po_template_items do |t|
      t.references :po_template_pack, null: false, foreign_key: true
      t.string   :name, null: false
      t.bigint   :sm_schedule_master_id
      t.bigint   :supplier_id
      t.string   :supplier_sync_key
      t.integer  :position, default: 0, null: false
      t.decimal  :budget, precision: 15, scale: 2
      t.text     :notes
      t.string   :status_on_create, default: "draft"
      t.bigint   :tenant_id
      t.string   :sync_key
      t.timestamps
    end

    add_index :po_template_items, :tenant_id
    add_index :po_template_items, [:tenant_id, :sync_key], unique: true, where: "sync_key IS NOT NULL"
    add_index :po_template_items, :sm_schedule_master_id
    add_index :po_template_items, :supplier_id

    # PO Template Line Items - line items per template PO
    create_table :po_template_line_items do |t|
      t.references :po_template_item, null: false, foreign_key: true
      t.bigint   :pricebook_item_id
      t.string   :pricebook_item_code
      t.text     :description, null: false
      t.decimal  :quantity, precision: 15, scale: 3, default: 1.0, null: false
      t.decimal  :unit_price, precision: 15, scale: 2, default: 0.0, null: false
      t.string   :gst_code, default: "GST"
      t.integer  :line_number, default: 1, null: false
      t.timestamps
    end

    add_index :po_template_line_items, :pricebook_item_id
  end
end
