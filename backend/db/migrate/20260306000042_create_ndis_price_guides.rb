class CreateNdisPriceGuides < ActiveRecord::Migration[7.1]
  def change
    create_table :ndis_price_guides do |t|
      t.string :design_category, null: false
      t.string :building_type
      t.integer :resident_count, null: false
      t.decimal :daily_rate, precision: 10, scale: 2, null: false
      t.date :effective_from, null: false
      t.date :effective_to
      t.string :support_item_number
      t.string :financial_year  # e.g. "2025-26"
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :ndis_price_guides,
              [:design_category, :resident_count, :effective_from],
              name: "idx_price_guides_category_residents_date",
              unique: true
    add_index :ndis_price_guides, :design_category
    add_index :ndis_price_guides, :effective_from
  end
end
