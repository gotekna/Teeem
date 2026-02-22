# frozen_string_literal: true

# Phase 2: Add suggested_action_data to assistant_alerts
# Each alert can include a pre-filled action (e.g., "Draft follow-up reply to Jason").
# User taps "Handle it" and the assistant chat opens with the action pre-loaded.
class AddSuggestedActionToAssistantAlerts < ActiveRecord::Migration[7.1]
  def change
    add_column :assistant_alerts, :suggested_action_data, :jsonb
  end
end
