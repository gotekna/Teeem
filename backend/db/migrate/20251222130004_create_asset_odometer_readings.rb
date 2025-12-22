# World-Class Asset Register - Phase 1: Asset Odometer/Hours Readings
class CreateAssetOdometerReadings < ActiveRecord::Migration[8.0]
  def change
    create_table :asset_odometer_readings do |t|
      t.references :asset, null: false, foreign_key: true
      t.references :user, foreign_key: true                # Who recorded it

      t.date :reading_date, null: false
      t.integer :odometer_km                               # For vehicles
      t.integer :hours                                     # For equipment
      t.string :reading_type, default: "manual"            # photo, manual, service
      t.text :notes

      # Active Storage will handle the photo attachment
      # In model: has_one_attached :photo

      t.timestamps
    end

    add_index :asset_odometer_readings, [:asset_id, :reading_date], name: "idx_asset_odometer_asset_date"
    add_index :asset_odometer_readings, :reading_type
  end
end
