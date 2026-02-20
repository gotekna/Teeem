# frozen_string_literal: true

# Create tenders table - Tender Sections for grouping PO line items into
# professional tender documents (like Cost Centres for cost allocation).
#
# Each tender section represents a category in the final tender PDF:
# "Base Price & Essential Inclusions", "Site Costs", "Authority Conditions", etc.
#
class CreateTenders < ActiveRecord::Migration[8.0]
  def change
    create_table :tenders do |t|
      t.bigint :tenant_id, null: false

      # Identity
      t.string :code, null: false, limit: 20       # "TS-001"
      t.string :name, null: false, limit: 100       # "Base Price & Essential Inclusions"
      t.text :description

      # Classification
      t.string :section_type, limit: 30, default: "priced"  # priced, note, included, provisional

      # Display
      t.integer :sort_order                         # Order in tender PDF
      t.boolean :show_line_items, default: true     # false = show only section total
      t.text :section_notes                         # Default notes for this section

      # Status
      t.boolean :active, default: true

      # Metadata & sync
      t.jsonb :metadata, default: {}
      t.string :sync_key

      t.timestamps
    end

    add_index :tenders, [:tenant_id, :code], unique: true
    add_index :tenders, :tenant_id
    add_index :tenders, :active
    add_index :tenders, :sort_order
    add_foreign_key :tenders, :tenants, on_delete: :cascade
  end
end
