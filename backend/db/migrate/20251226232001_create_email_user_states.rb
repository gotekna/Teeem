# frozen_string_literal: true

class CreateEmailUserStates < ActiveRecord::Migration[8.0]
  def change
    create_table :email_user_states do |t|
      # Note: email_warehouse table uses singular name
      t.bigint :email_warehouse_id, null: false, index: true
      t.references :user, null: false, foreign_key: true

      # Pin/Star flags
      t.boolean :is_pinned, default: false
      t.boolean :is_starred, default: false
      t.string :star_color  # For multi-star system (red, orange, yellow, green, blue, purple)

      # Follow-up reminder
      t.datetime :remind_at
      t.boolean :reminder_sent, default: false

      # Read/Archive state (per-user, not global)
      t.boolean :is_read, default: false
      t.boolean :is_archived, default: false

      # Priority override (user can mark as important/not important)
      t.string :priority  # "high", "normal", "low"

      # Custom notes
      t.text :notes

      t.timestamps
    end

    # Foreign key to email_warehouse (singular table name)
    add_foreign_key :email_user_states, :email_warehouse, column: :email_warehouse_id

    # Each user can only have one state per email
    add_index :email_user_states, [:email_warehouse_id, :user_id],
              unique: true,
              name: "idx_email_user_states_unique"

    # Fast lookup for pinned emails
    add_index :email_user_states, [:user_id, :is_pinned],
              where: "is_pinned = true",
              name: "idx_email_user_states_pinned"

    # Fast lookup for starred emails
    add_index :email_user_states, [:user_id, :is_starred],
              where: "is_starred = true",
              name: "idx_email_user_states_starred"

    # Fast lookup for reminders
    add_index :email_user_states, [:user_id, :remind_at],
              where: "remind_at IS NOT NULL AND reminder_sent = false",
              name: "idx_email_user_states_reminders"

    # Fast lookup for archived
    add_index :email_user_states, [:user_id, :is_archived],
              where: "is_archived = true",
              name: "idx_email_user_states_archived"
  end
end
