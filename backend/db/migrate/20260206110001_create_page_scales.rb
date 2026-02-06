# frozen_string_literal: true

# PageScale - Stores scale calibration per page for PDF takeoff measurements
#
# Each job plan page can have its own scale factor (drawings may have different scales).
# User calibrates by drawing a reference line and entering the real-world length.
#
# Example workflow:
#   1. User draws line across known dimension (e.g., door = 820mm)
#   2. System calculates: scale_factor = reference_length_mm / reference_length_px
#   3. All measurements on this page use this scale_factor for conversion
#
class CreatePageScales < ActiveRecord::Migration[8.0]
  def change
    create_table :page_scales do |t|
      t.references :tenant, null: false, foreign_key: true
      t.references :job_plan, null: false, foreign_key: true
      t.references :job_plan_revision, foreign_key: true

      # Page identification
      t.integer :page_number, null: false, default: 1

      # Scale calibration data
      t.decimal :scale_factor, precision: 15, scale: 8  # mm per canvas pixel
      t.decimal :reference_length_mm, precision: 15, scale: 4  # Real-world length user entered
      t.decimal :reference_length_px, precision: 15, scale: 4  # Pixel length of calibration line
      t.string :scale_label  # Display label like "1:100" or "1:50"

      # Calibration line geometry (stored for display/editing)
      t.jsonb :calibration_line, default: {}  # {x1, y1, x2, y2, canvasWidth, canvasHeight}

      # AI-detected scale (future enhancement)
      t.string :ai_detected_scale  # AI's guess at scale from title block
      t.decimal :ai_confidence, precision: 5, scale: 4  # 0.0 to 1.0

      # Tracking
      t.references :calibrated_by, foreign_key: { to_table: :users }
      t.datetime :calibrated_at

      t.timestamps
    end

    # Unique constraint: one scale per page per plan
    add_index :page_scales, [:job_plan_id, :page_number], unique: true
    add_index :page_scales, [:job_plan_revision_id, :page_number]
  end
end
