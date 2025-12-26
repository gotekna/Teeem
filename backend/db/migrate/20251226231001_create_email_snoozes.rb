# frozen_string_literal: true

class CreateEmailSnoozes < ActiveRecord::Migration[8.0]
  def change
    create_table :email_snoozes do |t|
      # Note: email_warehouse table uses singular name
      t.bigint :email_warehouse_id, null: false, index: true
      t.references :user, null: false, foreign_key: true
      t.datetime :snooze_until, null: false
      t.boolean :is_active, default: true
      t.string :reason  # Optional note for why snoozed
      t.datetime :woken_at  # When the snooze was triggered

      t.timestamps
    end

    # Foreign key to email_warehouse (singular table name)
    add_foreign_key :email_snoozes, :email_warehouse, column: :email_warehouse_id

    # Fast lookup for wakeup job (find active snoozes ready to wake)
    add_index :email_snoozes, [:snooze_until, :is_active],
              where: "is_active = true",
              name: "idx_email_snoozes_pending_wakeup"

    # Fast lookup by user for "my snoozed emails"
    add_index :email_snoozes, [:user_id, :is_active],
              where: "is_active = true",
              name: "idx_email_snoozes_user_active"

    # Prevent duplicate active snoozes for same email/user
    add_index :email_snoozes, [:email_warehouse_id, :user_id],
              unique: true,
              where: "is_active = true",
              name: "idx_email_snoozes_unique_active"
  end
end
