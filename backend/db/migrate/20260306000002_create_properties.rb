class CreateProperties < ActiveRecord::Migration[8.0]
  def change
    create_table :properties do |t|
      t.bigint :tenant_id, null: false
      t.string :property_code
      t.string :name
      t.string :street_address, null: false
      t.string :suburb
      t.string :state
      t.string :postcode
      t.string :country, default: "Australia"

      # Lookups
      t.references :property_type, foreign_key: true
      t.references :property_status, foreign_key: true

      # Property details
      t.integer :bedrooms
      t.integer :bathrooms
      t.integer :parking_spaces
      t.decimal :land_area_sqm, precision: 10, scale: 2
      t.decimal :floor_area_sqm, precision: 10, scale: 2
      t.integer :year_built
      t.text :description

      # SDA (Specialist Disability Accommodation)
      t.string :sda_category # nil, improved_liveability, fully_accessible, robust, high_physical_support
      t.boolean :sda_enrolled, default: false, null: false
      t.date :sda_enrolment_date
      t.string :sda_dwelling_id # NDIS reference number

      # Financial
      t.decimal :weekly_rent_amount, precision: 10, scale: 2
      t.decimal :bond_amount, precision: 10, scale: 2
      t.references :owner_contact, foreign_key: { to_table: :contacts }
      t.references :managing_agent_contact, foreign_key: { to_table: :contacts }

      # Metadata
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :properties, :tenant_id
    add_index :properties, [:tenant_id, :property_code], unique: true
    add_index :properties, :sda_category
    add_index :properties, :sda_enrolled
    add_index :properties, :suburb
  end
end
