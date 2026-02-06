# frozen_string_literal: true

# Extends UnrealMeasurement for browser-based PDF takeoff
#
# Adds fields for:
# - Page tracking (which page was measured)
# - Layer assignment (visual grouping)
# - Deduction support (subtract areas from parent)
# - Source tracking (UE5 3D vs PDF 2D)
#
class AddTakeoffFieldsToUnrealMeasurements < ActiveRecord::Migration[8.0]
  def change
    # Page and layer references
    add_column :unreal_measurements, :page_number, :integer
    add_reference :unreal_measurements, :takeoff_layer, foreign_key: true

    # Deduction support (for subtracting areas like windows from walls)
    add_column :unreal_measurements, :is_deduction, :boolean, default: false, null: false
    add_reference :unreal_measurements, :parent_measurement,
                  foreign_key: { to_table: :unreal_measurements }

    # Source tracking (was this measured in UE5 3D or browser PDF?)
    add_column :unreal_measurements, :source, :string, default: "unreal"
    # Values: "unreal" (3D app), "pdf_takeoff" (browser), "manual" (typed in)

    # Display label (for count markers: "1", "2", "3", etc.)
    add_column :unreal_measurements, :display_label, :string

    # Color override (if not using layer color)
    add_column :unreal_measurements, :color, :string

    # Indexes for common queries
    add_index :unreal_measurements, :page_number
    add_index :unreal_measurements, :source
    add_index :unreal_measurements, :is_deduction
    add_index :unreal_measurements, [:job_plan_id, :page_number]
  end
end
