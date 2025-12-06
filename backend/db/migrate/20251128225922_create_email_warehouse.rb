class CreateEmailWarehouse < ActiveRecord::Migration[8.0]
  def change
    create_table :email_warehouse do |t|
      # Unique identifier from Outlook - used for deduplication
      t.string :internet_message_id, null: false, index: { unique: true }
      t.string :outlook_id  # Outlook's internal ID (can vary per mailbox)
      t.string :conversation_id  # For threading emails together

      # Email content
      t.string :subject
      t.text :body_text
      t.text :body_html
      t.string :from_email
      t.string :from_name
      t.text :to_emails, array: true, default: []
      t.text :cc_emails, array: true, default: []
      t.text :bcc_emails, array: true, default: []

      # Metadata
      t.datetime :received_at
      t.datetime :sent_at
      t.boolean :has_attachments, default: false
      t.integer :attachment_count, default: 0
      t.string :importance  # low, normal, high
      t.boolean :is_read, default: false
      t.string :folder_name  # inbox, sent, etc.

      # Threading/conversation support
      t.string :in_reply_to  # Reference to parent email
      t.text :references, array: true, default: []  # Full thread chain
      t.boolean :is_latest_in_thread, default: true  # For showing only latest

      # Job matching
      t.references :job, foreign_key: true, index: true
      t.string :match_type  # auto, manual, suggested
      t.float :match_confidence  # 0.0 to 1.0 for auto-matches
      t.datetime :matched_at

      # Sync tracking
      t.references :synced_by_user, foreign_key: { to_table: :users }
      t.datetime :first_synced_at
      t.datetime :last_synced_at

      # Search optimization
      t.tsvector :searchable

      t.timestamps
    end

    # Index for conversation threading
    add_index :email_warehouse, :conversation_id
    add_index :email_warehouse, :received_at
    add_index :email_warehouse, :from_email
    add_index :email_warehouse, :is_latest_in_thread

    # Full-text search index
    add_index :email_warehouse, :searchable, using: :gin

    # Composite index for job emails query
    add_index :email_warehouse, [ :job_id, :received_at ]
    add_index :email_warehouse, [ :job_id, :is_latest_in_thread ]

    # GIN index on array columns for searching recipients
    add_index :email_warehouse, :to_emails, using: :gin
    add_index :email_warehouse, :cc_emails, using: :gin

    # Create sync status table to track sync progress per user
    create_table :email_sync_statuses do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.string :status, default: 'pending'  # pending, syncing, completed, failed
      t.datetime :last_sync_at
      t.datetime :sync_started_at
      t.datetime :oldest_email_synced  # How far back we've synced
      t.integer :total_emails_synced, default: 0
      t.integer :emails_synced_this_run, default: 0
      t.text :last_error
      t.string :sync_cursor  # For pagination/delta sync

      t.timestamps
    end
  end
end
