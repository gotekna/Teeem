# frozen_string_literal: true

# Migration for AI Assistant Phases 2-5
#
# Adds:
# - assistant_preferences JSONB on users (learning, notification routing, autopilot)
# - slack_user_id on users (for Slack integration)
# - channel index on assistant_conversations
#
class AddAssistantPhase2Fields < ActiveRecord::Migration[7.2]
  def change
    # User preferences for assistant (Phase 5 - learning + notification routing)
    unless column_exists?(:users, :assistant_preferences)
      add_column :users, :assistant_preferences, :jsonb, default: {}
    end

    # Slack user ID for linking accounts (Phase 3)
    unless column_exists?(:users, :slack_user_id)
      add_column :users, :slack_user_id, :string
      add_index :users, :slack_user_id, unique: true, where: "slack_user_id IS NOT NULL"
    end

    # Better indexing for assistant conversations by channel
    unless index_exists?(:assistant_conversations, [:user_id, :channel])
      add_index :assistant_conversations, [:user_id, :channel]
    end
  end
end
