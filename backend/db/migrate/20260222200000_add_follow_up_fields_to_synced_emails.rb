# frozen_string_literal: true

# Phase 1A: Add follow-up tracking and AI processing fields to synced_emails
# These columns power the EmailIntelligenceService which batch-processes emails
# with Haiku to generate summaries, action items, and follow-up flags.
#
# Note: ai_summary and action_items columns already exist on synced_emails (schema line ~9690).
# This migration adds follow-up tracking and processing timestamp columns.
class AddFollowUpFieldsToSyncedEmails < ActiveRecord::Migration[7.1]
  def change
    add_column :synced_emails, :follow_up_required, :boolean, default: false
    add_column :synced_emails, :follow_up_date, :date
    add_column :synced_emails, :follow_up_reason, :string, limit: 255
    add_column :synced_emails, :ai_processed_at, :datetime

    # Partial indexes for fast batch queries
    # Only index rows where ai_processed_at IS NULL (unprocessed emails)
    add_index :synced_emails, :ai_processed_at,
              where: "ai_processed_at IS NULL",
              name: "index_synced_emails_on_ai_unprocessed"

    # Only index rows where follow_up_required is true
    add_index :synced_emails, :follow_up_required,
              where: "follow_up_required = true",
              name: "index_synced_emails_on_follow_up_required"

    # Composite index for follow-up due queries
    add_index :synced_emails, [:follow_up_required, :follow_up_date],
              where: "follow_up_required = true",
              name: "index_synced_emails_on_follow_up_due"
  end
end
