# frozen_string_literal: true

# Add site presence and cost tracking fields to Jobs
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
class AddSitePresenceFieldsToJobs < ActiveRecord::Migration[8.0]
  def change
    # Cost centre assignment
    add_reference :jobs, :cost_centre, foreign_key: { on_delete: :nullify }

    # Site presence requirements
    add_column :jobs, :site_radius_meters, :integer, default: 100
    add_column :jobs, :require_photo_checkin, :boolean, default: false
    add_column :jobs, :require_photo_checkout, :boolean, default: false
    add_column :jobs, :require_face_verification, :boolean, default: false

    # Budget tracking (quick access without joining job_cost_budgets)
    add_column :jobs, :labour_budget, :decimal, precision: 14, scale: 2
    add_column :jobs, :labour_actual_cached, :decimal, precision: 14, scale: 2, default: 0
    add_column :jobs, :labour_variance_percent, :decimal, precision: 5, scale: 2

    # Site location for GPS verification
    add_column :jobs, :site_latitude, :decimal, precision: 10, scale: 7
    add_column :jobs, :site_longitude, :decimal, precision: 10, scale: 7
  end
end
