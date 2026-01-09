# frozen_string_literal: true

class CreateScheduledEmails < ActiveRecord::Migration[7.1]
  def change
    create_table :scheduled_emails do |t|
      # Account to send from (nullable - can be outlook or ms365)
      t.references :imap_credential, foreign_key: true
      t.string :microsoft_credential_id  # For MS365 org accounts
      t.string :account_type, limit: 20  # "imap", "outlook", "ms365"
      t.string :mailbox_email  # For MS365 shared mailboxes

      # Audit
      t.references :created_by, foreign_key: { to_table: :users }

      # Recipients
      t.text :to_addresses, null: false  # JSON array
      t.text :cc_addresses  # JSON array
      t.text :bcc_addresses  # JSON array

      # Content
      t.string :subject, null: false
      t.text :body, null: false

      # Attachments stored as JSON with file metadata
      t.jsonb :attachments, default: []

      # Reply context
      t.string :reply_to_message_id

      # Schedule
      t.datetime :scheduled_for, null: false
      t.string :status, limit: 20, default: "pending", null: false
      t.datetime :sent_at
      t.datetime :cancelled_at
      t.text :error_message

      t.timestamps
    end

    add_index :scheduled_emails, [:status, :scheduled_for], name: "idx_scheduled_emails_due"
    add_index :scheduled_emails, :scheduled_for
  end
end
