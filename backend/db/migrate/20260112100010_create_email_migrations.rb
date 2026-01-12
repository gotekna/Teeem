# frozen_string_literal: true

class CreateEmailMigrations < ActiveRecord::Migration[8.0]
  def change
    create_table :email_migrations do |t|
      t.references :email_subscription, null: false, foreign_key: true
      t.references :email_mailbox, foreign_key: true
      t.references :initiated_by, foreign_key: { to_table: :users }
      t.references :microsoft_credential, foreign_key: true
      t.string :migration_type, null: false  # full_mailbox, emails_only, calendar_only, contacts_only
      t.string :status, default: "pending", null: false
      t.string :source_email
      t.string :source_tenant_id
      t.integer :total_items, default: 0
      t.integer :processed_items, default: 0
      t.integer :failed_items, default: 0
      t.bigint :total_bytes, default: 0
      t.bigint :processed_bytes, default: 0
      t.datetime :started_at
      t.datetime :completed_at
      t.datetime :failed_at
      t.text :error_message
      t.jsonb :migration_log, default: {}
      t.jsonb :options, default: {}
      t.boolean :is_self_service, default: false

      t.timestamps
    end

    add_index :email_migrations, :status
    add_index :email_migrations, :is_self_service
    add_index :email_migrations, :migration_type
  end
end
