# frozen_string_literal: true

class CreateAssistantTables < ActiveRecord::Migration[8.0]
  def change
    # Multi-turn conversation history per user
    create_table :assistant_conversations do |t|
      t.references :user, null: false, foreign_key: true
      t.references :tenant, null: false, foreign_key: true
      t.string :title, limit: 255
      t.string :channel, limit: 50, null: false, default: "web"
      t.string :status, limit: 20, null: false, default: "active"
      t.jsonb :metadata, default: {}
      t.datetime :last_message_at
      t.timestamps
    end

    add_index :assistant_conversations, [:user_id, :status]
    add_index :assistant_conversations, [:user_id, :channel]
    add_index :assistant_conversations, :last_message_at

    # Individual messages within a conversation
    create_table :assistant_messages do |t|
      t.references :assistant_conversation, null: false, foreign_key: true
      t.string :role, limit: 20, null: false # user, assistant, tool_call, tool_result
      t.text :content
      t.string :content_type, limit: 30, default: "text" # text, voice_transcript, tool_use
      t.jsonb :tool_calls, default: [] # for assistant messages with tool use
      t.jsonb :tool_results, default: [] # for tool result messages
      t.jsonb :metadata, default: {} # token counts, model used, etc.
      t.timestamps
    end

    add_index :assistant_messages, [:assistant_conversation_id, :created_at],
              name: "idx_assistant_msgs_conversation_created"

    # Audit log of all AI-initiated actions (drafts, tasks, alerts)
    create_table :assistant_actions do |t|
      t.references :user, null: false, foreign_key: true
      t.references :tenant, null: false, foreign_key: true
      t.references :assistant_conversation, foreign_key: true
      t.string :action_type, limit: 50, null: false # draft_email, create_task, update_task, alert, search
      t.string :status, limit: 20, null: false, default: "pending" # pending, approved, rejected, executed, failed
      t.text :description # human-readable description of what the action does
      t.jsonb :action_data, default: {} # the actual payload (email draft, task params, etc.)
      t.jsonb :result_data, default: {} # result after execution
      t.string :source_type # SyncedEmail, SmTask, Notification, SmsMessage - what triggered this
      t.bigint :source_id # ID of the source record
      t.datetime :approved_at
      t.datetime :executed_at
      t.timestamps
    end

    add_index :assistant_actions, [:user_id, :status]
    add_index :assistant_actions, [:user_id, :action_type]
    add_index :assistant_actions, [:source_type, :source_id]
    add_index :assistant_actions, :status

    # Monitor alerts - proactive notifications from the monitor job
    create_table :assistant_alerts do |t|
      t.references :user, null: false, foreign_key: true
      t.references :tenant, null: false, foreign_key: true
      t.string :alert_type, limit: 50, null: false # urgent_email, overdue_task, schedule_delay, etc.
      t.string :priority, limit: 20, null: false, default: "medium" # low, medium, high, critical
      t.string :status, limit: 20, null: false, default: "pending" # pending, seen, actioned, dismissed
      t.string :title, limit: 255, null: false
      t.text :summary
      t.jsonb :context_data, default: {} # relevant data for the alert
      t.string :source_type # what model triggered the alert
      t.bigint :source_id
      t.references :assistant_action, foreign_key: true # linked action (draft reply, task, etc.)
      t.datetime :seen_at
      t.datetime :actioned_at
      t.timestamps
    end

    add_index :assistant_alerts, [:user_id, :status]
    add_index :assistant_alerts, [:user_id, :priority]
    add_index :assistant_alerts, [:source_type, :source_id]
    add_index :assistant_alerts, :alert_type
  end
end
