# frozen_string_literal: true

# SitePresenceSession - Photo-verified site check-in/checkout tracking
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# Combines GPS verification (from SmSiteCheckin) with photo-based
# face verification for bulletproof time tracking.
#
class CreateSitePresenceSessions < ActiveRecord::Migration[8.0]
  def change
    create_table :site_presence_sessions do |t|
      # Core relationships
      t.references :worker_profile, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true
      t.references :sm_task, foreign_key: true
      t.references :cost_centre, foreign_key: true

      # Session status
      t.string :session_status, null: false, default: "active", limit: 20
      # "active" = checked in, working
      # "completed" = checked out, hours calculated
      # "incomplete" = checked in but no checkout (auto-flagged)

      # Check-in details
      t.datetime :checkin_at
      t.decimal :latitude_checkin, precision: 10, scale: 7
      t.decimal :longitude_checkin, precision: 10, scale: 7
      t.integer :distance_from_site_checkin              # meters
      t.references :checkin_photo, foreign_key: { to_table: :sm_task_photos, on_delete: :nullify }

      # Check-out details
      t.datetime :checkout_at
      t.decimal :latitude_checkout, precision: 10, scale: 7
      t.decimal :longitude_checkout, precision: 10, scale: 7
      t.integer :distance_from_site_checkout             # meters
      t.references :checkout_photo, foreign_key: { to_table: :sm_task_photos, on_delete: :nullify }

      # Face verification results
      t.boolean :face_verified_checkin, default: false
      t.boolean :face_verified_checkout, default: false
      t.decimal :face_confidence_checkin, precision: 5, scale: 2
      t.decimal :face_confidence_checkout, precision: 5, scale: 2

      # GPS verification
      t.boolean :gps_verified_checkin, default: false
      t.boolean :gps_verified_checkout, default: false

      # AI site visibility analysis
      t.boolean :site_visible_in_checkin_photo, default: false
      t.boolean :site_visible_in_checkout_photo, default: false

      # Time calculations
      t.decimal :total_hours, precision: 5, scale: 2
      t.decimal :break_minutes, precision: 5, scale: 0, default: 0
      t.decimal :billable_hours, precision: 5, scale: 2

      # Approval workflow
      t.string :approval_status, default: "pending", limit: 20
      # "pending", "approved", "rejected", "auto_approved"
      t.references :approved_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.datetime :approved_at
      t.text :rejection_reason

      # Anomaly detection flags
      t.jsonb :anomalies, default: []                    # Array of detected anomalies

      # Notes
      t.text :worker_notes                               # Notes from worker
      t.text :admin_notes                                # Notes from admin/approver

      # Device info
      t.string :device_info, limit: 255
      t.string :app_version, limit: 20

      t.timestamps
    end

    # Indexes
    add_index :site_presence_sessions, :session_status
    add_index :site_presence_sessions, :approval_status
    add_index :site_presence_sessions, :checkin_at
    add_index :site_presence_sessions, :checkout_at
    add_index :site_presence_sessions, [:worker_profile_id, :checkin_at]
    add_index :site_presence_sessions, [:job_id, :checkin_at]

    # Find active sessions for a worker
    add_index :site_presence_sessions, [:worker_profile_id, :session_status],
              name: "idx_site_presence_worker_status"

    # Find sessions needing approval
    add_index :site_presence_sessions, [:approval_status, :created_at],
              name: "idx_site_presence_approval_queue"
  end
end
