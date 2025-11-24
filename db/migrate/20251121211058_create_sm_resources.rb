class CreateSmResources < ActiveRecord::Migration[8.0]
  def change
    create_table :sm_resources do |t|
      # Type
      t.string :resource_type, null: false, limit: 20 # person, equipment, material

      # Identity
      t.string :name, null: false, limit: 255
      t.string :code, limit: 50
      t.text :description

      # For People
      t.references :user, foreign_key: { on_delete: :nullify }
      t.references :contact, foreign_key: { to_table: :contacts, on_delete: :nullify }
      t.string :trade, limit: 100
      t.decimal :hourly_rate, precision: 10, scale: 2

      # For Equipment
      t.references :asset, foreign_key: false # Assets table may not exist yet
      t.decimal :daily_rate, precision: 10, scale: 2

      # For Materials
      t.string :unit, limit: 50
      t.decimal :unit_cost, precision: 10, scale: 2

      # Availability
      t.boolean :is_active, default: true
      t.decimal :availability_hours_per_day, precision: 4, scale: 2, default: 8.0

      t.timestamps
    end

    # Indexes
    add_index :sm_resources, :resource_type
    add_index :sm_resources, :code, unique: true, where: "code IS NOT NULL"
    add_index :sm_resources, :is_active
  end
end
