class CreateSdaPriceGuides < ActiveRecord::Migration[7.1]
  def change
    create_table :sda_price_guides do |t|
      t.string :financial_year, null: false             # "2025-26"
      t.string :version, null: false                    # "2.0"
      t.date :valid_from, null: false                   # 2025-07-01
      t.date :valid_to                                  # 2026-06-30
      t.boolean :current, default: false, null: false   # Only one active at a time
      t.string :source_url                              # NDIS download URL
      t.jsonb :metadata, default: {}                    # CPI rate, amendment notes, etc.
      t.timestamps
    end

    add_index :sda_price_guides, :financial_year
    add_index :sda_price_guides, :current

    # Benchmark rates per combination of dwelling/building/category/sprinklers/GST/OOA
    create_table :sda_benchmark_rates do |t|
      t.references :sda_price_guide, null: false, foreign_key: true

      t.string :dwelling_stock_type, null: false        # post_2023_new_build, pre_2023_new_build, existing_stock, legacy_stock
      t.string :building_type, null: false              # apartment_1br_1res, apartment_2br_1res, etc.
      t.integer :max_residents, null: false             # 1, 2, 3, 4, 5, 6, 7...
      t.string :design_category, null: false            # improved_liveability, fully_accessible, robust, robust_breakout_room, high_physical_support
      t.boolean :fire_sprinklers, default: false        # with/without
      t.boolean :gst_credits_claimed, default: true     # input tax credits claimed or not
      t.boolean :onsite_overnight_assistance, default: false  # OOA

      t.integer :annual_base_price, null: false         # Annual benchmark amount per participant ($)

      t.timestamps
    end

    add_index :sda_benchmark_rates, [:sda_price_guide_id, :dwelling_stock_type, :building_type,
      :design_category, :fire_sprinklers, :gst_credits_claimed, :onsite_overnight_assistance],
      unique: true, name: "idx_sda_rates_unique_combo"

    # Location factors per SA4 region per building type
    create_table :sda_location_factors do |t|
      t.references :sda_price_guide, null: false, foreign_key: true

      t.string :sa4_region, null: false                 # "QLD - Brisbane - North"
      t.string :stock_type, null: false                 # new_build, existing_legacy (different factor tables)
      t.string :building_type, null: false              # apartment_1br_1res, etc.
      t.decimal :factor, precision: 4, scale: 2, null: false  # e.g. 0.98

      t.timestamps
    end

    add_index :sda_location_factors, [:sda_price_guide_id, :sa4_region, :stock_type, :building_type],
      unique: true, name: "idx_sda_location_unique"

    # MRRC rates (Maximum Reasonable Rent Contribution)
    create_table :sda_mrrc_rates do |t|
      t.references :sda_price_guide, null: false, foreign_key: true

      t.string :participant_type, null: false            # single, couple_each, couple_combined
      t.string :payment_type, null: false                # mrrc, maximum_board

      t.decimal :dsp_rate, precision: 10, scale: 2       # Disability Support Pension component
      t.decimal :pension_supplement, precision: 10, scale: 2
      t.decimal :cra_rate, precision: 10, scale: 2       # Commonwealth Rent Assistance
      t.decimal :energy_supplement, precision: 10, scale: 2
      t.decimal :total_fortnightly, precision: 10, scale: 2
      t.decimal :total_annual, precision: 10, scale: 2

      t.timestamps
    end

    add_index :sda_mrrc_rates, [:sda_price_guide_id, :participant_type, :payment_type],
      unique: true, name: "idx_sda_mrrc_unique"

    # Add fire sprinklers and location to properties
    change_table :properties do |t|
      t.boolean :sda_fire_sprinklers, default: false
      t.string :sda_location_sa4                       # SA4 region for location factor lookup
    end
  end
end
