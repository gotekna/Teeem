# frozen_string_literal: true

# Add site presence verification fields to SmTaskPhoto
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
class AddSitePresenceFieldsToSmTaskPhotos < ActiveRecord::Migration[8.0]
  def change
    # Check-in/checkout photo flags
    add_column :sm_task_photos, :is_checkin_photo, :boolean, default: false
    add_column :sm_task_photos, :is_checkout_photo, :boolean, default: false

    # Face verification results
    add_column :sm_task_photos, :face_verification_result, :jsonb
    add_column :sm_task_photos, :face_match_confidence, :decimal, precision: 5, scale: 2
    add_column :sm_task_photos, :face_verified, :boolean, default: false

    # Site visibility analysis (AI)
    add_column :sm_task_photos, :site_visibility_score, :decimal, precision: 5, scale: 2
    add_column :sm_task_photos, :site_visible, :boolean
    add_column :sm_task_photos, :ai_analysis, :jsonb

    # Weather/conditions detected
    add_column :sm_task_photos, :weather_detected, :string, limit: 30
    add_column :sm_task_photos, :lighting_conditions, :string, limit: 30

    # GPS from photo EXIF
    add_column :sm_task_photos, :exif_latitude, :decimal, precision: 10, scale: 7
    add_column :sm_task_photos, :exif_longitude, :decimal, precision: 10, scale: 7
    add_column :sm_task_photos, :exif_timestamp, :datetime

    # Indexes
    add_index :sm_task_photos, :is_checkin_photo
    add_index :sm_task_photos, :is_checkout_photo
    add_index :sm_task_photos, :face_verified
  end
end
