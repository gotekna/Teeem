class CreateEmails < ActiveRecord::Migration[8.0]
  def change
    create_table :emails do |t|
      t.references :construction, null: true, foreign_key: true
      t.references :user, null: true, foreign_key: true

      # Email headers
      t.string :from_email, null: false
      t.text :to_emails # JSON array of recipient emails
      t.text :cc_emails # JSON array of CC emails
      t.text :bcc_emails # JSON array of BCC emails
      t.text :subject

      # Email body
      t.text :body_text # Plain text version
      t.text :body_html # HTML version

      # Email metadata
      t.string :message_id # Unique message ID from email headers
      t.string :in_reply_to # For threading
      t.text :references # For threading
      t.datetime :received_at

      # Attachments
      t.boolean :has_attachments, default: false
      t.integer :attachment_count, default: 0

      # Raw email for backup/debugging
      t.text :raw_email

      t.timestamps
    end

    add_index :emails, :message_id, unique: true
    add_index :emails, :from_email
    add_index :emails, [ :construction_id, :received_at ]
    add_index :emails, :received_at
  end
end
