# frozen_string_literal: true

class CreateEmailMigrationInvites < ActiveRecord::Migration[8.0]
  def change
    create_table :email_migration_invites do |t|
      t.references :email_subscription, null: false, foreign_key: true
      t.references :contact, null: false, foreign_key: true
      t.references :created_by, foreign_key: { to_table: :users }
      t.string :token, null: false
      t.string :status, default: "pending", null: false  # pending, payment_pending, payment_complete, migrating, completed, expired, cancelled
      t.decimal :total_monthly, precision: 10, scale: 2
      t.jsonb :mailboxes_data, default: []  # Snapshot of mailboxes at invite time
      t.datetime :expires_at
      t.datetime :viewed_at
      t.integer :view_count, default: 0
      t.datetime :payment_completed_at
      t.datetime :migration_started_at
      t.datetime :completed_at

      t.timestamps
    end

    add_index :email_migration_invites, :token, unique: true
    add_index :email_migration_invites, :status
    add_index :email_migration_invites, :expires_at
  end
end
