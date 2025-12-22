# World-Class Asset Register - Phase 1: Enhance Assets Table
class EnhanceAssetsForRegister < ActiveRecord::Migration[8.0]
  def change
    # Asset identification
    add_column :assets, :asset_number, :string            # ABC-VEH-001
    add_column :assets, :serial_number, :string
    add_column :assets, :registration_number, :string     # Vehicles

    # Location and assignment
    add_column :assets, :location, :string
    add_column :assets, :assigned_user_id, :bigint        # User allocation

    # Vehicle/Equipment tracking
    add_column :assets, :odometer_reading, :integer       # Current km
    add_column :assets, :hours_reading, :integer          # Equipment hours
    add_column :assets, :last_reading_date, :date

    # Property-specific fields
    add_column :assets, :address, :string
    add_column :assets, :land_area_sqm, :decimal, precision: 12, scale: 2
    add_column :assets, :building_area_sqm, :decimal, precision: 12, scale: 2
    add_column :assets, :construction_date, :date         # For Div 43 rate

    # Metadata for extensibility
    add_column :assets, :metadata, :jsonb, default: {}

    # Indexes
    add_index :assets, :asset_number, unique: true
    add_index :assets, :assigned_user_id
    add_index :assets, :registration_number

    # Foreign key for user allocation
    add_foreign_key :assets, :users, column: :assigned_user_id
  end
end
