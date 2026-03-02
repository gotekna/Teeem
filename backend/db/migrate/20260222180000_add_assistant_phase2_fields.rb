# frozen_string_literal: true

# Migration for AI Assistant Phases 2-5
#
# Adds:
# - assistant_preferences JSONB on users (learning, notification routing, autopilot)
# - slack_user_id on users (for Slack integration)
# - channel index on assistant_conversations
#
class AddAssistantPhase2Fields < ActiveRecord::Migration[7.2]
  def up
    # User preferences for assistant (Phase 5 - learning + notification routing)
    add_column :users, :assistant_preferences, :jsonb, default: {}, if_not_exists: true

    # Slack user ID for linking accounts (Phase 3)
    add_column :users, :slack_user_id, :string, if_not_exists: true
    add_index :users, :slack_user_id, unique: true, where: "slack_user_id IS NOT NULL", if_not_exists: true

    # Better indexing for assistant conversations by channel
    add_index :assistant_conversations, [:user_id, :channel], if_not_exists: true
  end

  def down
    remove_index :assistant_conversations, [:user_id, :channel], if_exists: true
    remove_index :users, :slack_user_id, if_exists: true
    remove_column :users, :slack_user_id, if_exists: true
    remove_column :users, :assistant_preferences, if_exists: true
  end
end
