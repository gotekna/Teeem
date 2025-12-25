# Create unreal_measurements table for storing 3D takeoff measurements
# from the Unreal Engine quantity takeoff application
class CreateUnrealMeasurements < ActiveRecord::Migration[7.1]
  def change
    create_table :unreal_measurements do |t|
      # Core associations
      t.references :job, null: false, foreign_key: true
      t.references :job_plan, foreign_key: true
      t.references :pricebook_item, foreign_key: { to_table: :pricebook }
      t.references :job_colour_selection, foreign_key: true

      # Session tracking (groups related measurements)
      t.string :session_id, null: false

      # Measurement data
      t.string :measurement_type, null: false  # area, length, count
      t.decimal :value, precision: 15, scale: 4, null: false
      t.string :unit, null: false  # m2, m, ea

      # Classification
      t.string :category       # e.g., "Flooring", "Walls", "Electrical"
      t.string :subcategory    # e.g., "Tiles", "Paint", "GPOs"
      t.text :notes

      # Geometry data (polygon points, line endpoints, etc.)
      t.jsonb :geometry_data, default: {}

      # Sync tracking
      t.references :synced_to_po, foreign_key: { to_table: :purchase_orders }
      t.datetime :synced_at

      t.timestamps
    end

    # Indexes for common queries
    # Note: t.references already creates indexes for job_id, job_plan_id, pricebook_item_id,
    # job_colour_selection_id, and synced_to_po_id
    add_index :unreal_measurements, :session_id
    add_index :unreal_measurements, :measurement_type
    add_index :unreal_measurements, :category
    add_index :unreal_measurements, [:job_id, :session_id]
  end
end
