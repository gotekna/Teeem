# frozen_string_literal: true

# WorkerProfile - Unified employee/subcontractor profile for cost tracking
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# This model unifies employees (via User) and subcontractors (via Contact)
# into a single profile for time tracking and cost allocation.
#
class CreateWorkerProfiles < ActiveRecord::Migration[8.0]
  def change
    create_table :worker_profiles do |t|
      # Identity - polymorphic via user or contact (index: false to allow unique conditional indexes)
      t.references :user, foreign_key: { on_delete: :nullify }, index: false
      t.references :contact, foreign_key: { to_table: :contacts, on_delete: :nullify }, index: false

      # Worker classification
      t.string :worker_type, null: false, limit: 20  # "employee", "subcontractor", "contractor"
      t.string :name, null: false, limit: 100        # Display name

      # Face verification (AWS Rekognition)
      t.string :profile_photo_url                    # Cloudinary URL for face verification
      t.jsonb :face_encoding                         # AWS Rekognition face vector
      t.boolean :face_verified, default: false
      t.datetime :face_verified_at

      # Primary cost centre assignment
      t.references :cost_centre, foreign_key: { on_delete: :nullify }

      # Employee pay rates (simPRO-style)
      t.decimal :hourly_rate, precision: 10, scale: 2
      t.decimal :overtime_rate_1_5x, precision: 10, scale: 2
      t.decimal :overtime_rate_2x, precision: 10, scale: 2
      t.decimal :weekend_rate, precision: 10, scale: 2

      # Employment cost loading (super, leave, workers comp as %)
      t.decimal :employment_cost_percent, precision: 5, scale: 2, default: 28.5

      # Subcontractor rates (alternative to hourly)
      t.decimal :day_rate, precision: 10, scale: 2
      t.decimal :call_out_fee, precision: 10, scale: 2

      # Australian tax details
      t.string :abn, limit: 20                       # For subcontractors
      t.string :tax_file_number_provided, limit: 10  # "yes", "no", "exempt"

      # Status
      t.boolean :active, default: true

      # Metadata
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    # Indexes
    add_index :worker_profiles, :worker_type
    add_index :worker_profiles, :active
    add_index :worker_profiles, :abn, unique: true, where: "abn IS NOT NULL"

    # Ensure a user or contact has only one worker profile
    add_index :worker_profiles, :user_id, unique: true, where: "user_id IS NOT NULL"
    add_index :worker_profiles, :contact_id, unique: true, where: "contact_id IS NOT NULL"
  end
end
