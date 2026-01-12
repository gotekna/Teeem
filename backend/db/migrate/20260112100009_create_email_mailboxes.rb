# frozen_string_literal: true

class CreateEmailMailboxes < ActiveRecord::Migration[8.0]
  def change
    create_table :email_mailboxes do |t|
      t.references :email_subscription, null: false, foreign_key: true
      t.references :contact, foreign_key: true  # Optional link to existing contact
      t.string :email_address, null: false
      t.string :display_name
      t.string :mailbox_type, default: "user", null: false  # user, shared, resource
      t.string :status, default: "pending", null: false
      t.integer :storage_quota_gb, default: 50
      t.decimal :storage_used_gb, precision: 10, scale: 2
      t.string :polaris_mailbox_id
      t.datetime :provisioned_at
      t.datetime :last_sync_at
      t.jsonb :metadata, default: {}

      t.timestamps
    end

    add_index :email_mailboxes, :email_address, unique: true
    add_index :email_mailboxes, :status
    add_index :email_mailboxes, :polaris_mailbox_id
    add_index :email_mailboxes, :mailbox_type
  end
end
