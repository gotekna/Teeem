class DropLegacyEmailsTable < ActiveRecord::Migration[8.0]
  def up
    # SSoT: email_warehouses table is THE ONE for all email storage
    # This legacy emails table has:
    # - No model class (Email doesn't exist)
    # - No code references (confirmed via grep)
    # - All functionality migrated to EmailWarehouse model

    drop_table :emails, if_exists: true do |t|
      # Schema preserved for reference/rollback
      t.bigint :job_id
      t.bigint :user_id
      t.string :from_email, null: false
      t.text :to_emails
      t.text :cc_emails
      t.text :bcc_emails
      t.text :subject
      t.text :body_text
      t.text :body_html
      t.string :message_id
      t.string :in_reply_to
      t.text :references
      t.datetime :received_at
      t.boolean :has_attachments, default: false
      t.integer :attachment_count, default: 0
      t.text :raw_email
      t.timestamps
    end
  end

  def down
    # Recreate table structure (data will be lost)
    create_table :emails, id: :bigint do |t|
      t.bigint :job_id
      t.bigint :user_id
      t.string :from_email, null: false
      t.text :to_emails
      t.text :cc_emails
      t.text :bcc_emails
      t.text :subject
      t.text :body_text
      t.text :body_html
      t.string :message_id
      t.string :in_reply_to
      t.text :references
      t.datetime :received_at
      t.boolean :has_attachments, default: false
      t.integer :attachment_count, default: 0
      t.text :raw_email
      t.timestamps
    end
  end
end
