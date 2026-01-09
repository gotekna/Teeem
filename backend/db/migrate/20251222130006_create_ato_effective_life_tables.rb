# World-Class Asset Register - Phase 1: ATO Effective Life Lookup Tables
class CreateAtoEffectiveLifeTables < ActiveRecord::Migration[8.0]
  def change
    # ATO Asset Categories (hierarchical)
    create_table :ato_effective_life_categories do |t|
      t.string :code, null: false
      t.string :name, null: false
      t.string :parent_code                                # For hierarchical structure
      t.text :description
      t.boolean :active, default: true

      t.timestamps
    end

    add_index :ato_effective_life_categories, :code, unique: true
    add_index :ato_effective_life_categories, :parent_code

    # ATO Effective Life Rates
    create_table :ato_effective_life_rates do |t|
      t.references :ato_effective_life_category, null: false, foreign_key: true

      t.string :description, null: false                   # "Motor vehicles - cars"
      t.decimal :effective_life_years, precision: 5, scale: 2, null: false

      # Pre-calculated rates for convenience
      t.decimal :straight_line_rate, precision: 8, scale: 4      # 100 / life
      t.decimal :diminishing_value_rate, precision: 8, scale: 4  # 200 / life

      # Date range for which this rate applies
      t.date :effective_from, null: false
      t.date :effective_until                              # NULL = current

      # Division 43 (capital works) specific
      t.boolean :is_division_43, default: false
      t.string :division_43_category                       # construction, structural_improvements
      t.decimal :division_43_rate, precision: 5, scale: 2  # 2.5 or 4.0

      t.timestamps
    end

    add_index :ato_effective_life_rates, :description
    add_index :ato_effective_life_rates, [:ato_effective_life_category_id, :effective_from], name: "idx_ato_rates_category_date"
    add_index :ato_effective_life_rates, :is_division_43
  end
end
