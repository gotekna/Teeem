# frozen_string_literal: true

# TakeoffLayer - Groups measurements by layer for visual organization
#
# Each job can have multiple takeoff layers (like CAD layers).
# Measurements are assigned to layers for visual grouping and color coding.
#
# Example layers:
#   - "Flooring" (blue)
#   - "Walls" (green)
#   - "Electrical" (yellow)
#   - "Plumbing" (red)
#
class CreateTakeoffLayers < ActiveRecord::Migration[8.0]
  def change
    create_table :takeoff_layers do |t|
      t.references :tenant, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true

      t.string :name, null: false  # Layer name (e.g., "Flooring", "Walls")
      t.string :color, null: false, default: "#3B82F6"  # Hex color for display
      t.integer :display_order, null: false, default: 0  # Sort order in UI
      t.boolean :visible, null: false, default: true  # Can toggle visibility
      t.boolean :locked, null: false, default: false  # Prevent edits when locked

      t.timestamps
    end

    # Index for sorting
    add_index :takeoff_layers, [:job_id, :display_order]

    # Unique layer names per job
    add_index :takeoff_layers, [:job_id, :name], unique: true
  end
end
