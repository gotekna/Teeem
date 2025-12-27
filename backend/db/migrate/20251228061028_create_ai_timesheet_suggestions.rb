# frozen_string_literal: true

# AiTimesheetSuggestion - ML-generated timesheet entries from photo evidence
#
# Part of Site Presence & Cost Intelligence System
# See: .claude/plans/piped-orbiting-whisper.md
#
# AI aggregates evidence from photos, GPS check-ins, and calendar to suggest
# time entries. Workers can accept, modify, or reject suggestions.
#
class CreateAiTimesheetSuggestions < ActiveRecord::Migration[8.0]
  def change
    create_table :ai_timesheet_suggestions do |t|
      # Target
      t.references :worker_profile, null: false, foreign_key: true
      t.references :job, null: false, foreign_key: true
      t.date :suggestion_date, null: false

      # Suggested values
      t.datetime :suggested_start_time
      t.datetime :suggested_end_time
      t.decimal :suggested_hours, precision: 5, scale: 2
      t.decimal :suggested_break_minutes, precision: 5, scale: 0, default: 0

      # Evidence used to generate suggestion
      t.jsonb :photo_evidence, default: []    # Array of {photo_id, timestamp, type}
      t.jsonb :gps_evidence, default: []      # Array of {checkin_id, timestamp, type}
      t.jsonb :calendar_evidence, default: [] # Array of calendar event references

      # AI analysis
      t.decimal :confidence_score, precision: 5, scale: 2  # 0-100
      t.text :reasoning                                     # AI explanation
      t.string :model_version, limit: 50                    # AI model version used

      # Work type detection
      t.string :detected_work_type, limit: 50  # "framing", "electrical", etc.
      t.integer :detected_progress_percent

      # User action
      t.string :status, default: "pending", limit: 20
      # "pending", "accepted", "modified", "rejected", "expired"
      t.references :actioned_by, foreign_key: { to_table: :users, on_delete: :nullify }
      t.datetime :actioned_at
      t.text :user_notes

      # If accepted/modified, link to created entry
      t.references :labour_cost_entry, foreign_key: { on_delete: :nullify }

      # Expiry (suggestions expire after X days if not actioned)
      t.datetime :expires_at

      t.timestamps
    end

    # Indexes
    add_index :ai_timesheet_suggestions, :suggestion_date
    add_index :ai_timesheet_suggestions, :status
    add_index :ai_timesheet_suggestions, :confidence_score
    add_index :ai_timesheet_suggestions, [:worker_profile_id, :suggestion_date],
              name: "idx_ai_suggestions_worker_date"
    add_index :ai_timesheet_suggestions, [:status, :expires_at],
              name: "idx_ai_suggestions_pending"
  end
end
