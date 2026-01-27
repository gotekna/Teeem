# frozen_string_literal: true

# Ultra Email Architecture - Store Once, Link Many
#
# This migration creates the join table linking emails to mailboxes.
# An email can appear in multiple mailboxes (e.g., sent to multiple recipients).
# Each appearance has its own outlook_id, folder_name, and is_read status.
#
# SSoT: Email content is in synced_emails (once). Mailbox appearances here.
#
# Example: Email to James AND Andrew
#   - synced_emails: 1 record (content stored once)
#   - synced_email_mailboxes: 2 records (one per mailbox)
#
class CreateSyncedEmailMailboxes < ActiveRecord::Migration[7.0]
  def change
    create_table :synced_email_mailboxes do |t|
      t.references :synced_email, null: false, foreign_key: true
      t.string :mailbox_owner_email, null: false
      t.string :outlook_id  # Different per mailbox (Graph API ID)
      t.string :folder_name
      t.boolean :is_read, default: false
      t.jsonb :labels, default: []  # Gmail labels (mailbox-specific)
      t.references :microsoft_credential, foreign_key: true

      t.timestamps
    end

    # Unique: one email can only appear once per mailbox
    add_index :synced_email_mailboxes, [:synced_email_id, :mailbox_owner_email],
              unique: true, name: 'idx_email_mailbox_unique'

    # Fast lookup by mailbox (for user's email list)
    add_index :synced_email_mailboxes, [:microsoft_credential_id, :mailbox_owner_email],
              name: 'idx_email_mailbox_credential'

    # Fast lookup by outlook_id (for updates from Graph API)
    add_index :synced_email_mailboxes, [:microsoft_credential_id, :outlook_id],
              name: 'idx_email_mailbox_outlook_id'

    # Fast lookup for unread count queries
    add_index :synced_email_mailboxes, [:mailbox_owner_email, :is_read],
              name: 'idx_email_mailbox_unread'
  end
end
