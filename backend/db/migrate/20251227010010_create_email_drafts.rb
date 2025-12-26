class CreateEmailDrafts < ActiveRecord::Migration[8.0]
  def change
    create_table :email_drafts do |t|
      t.references :user, null: false, foreign_key: true
      t.references :organization, null: false, foreign_key: true
      t.references :imap_credential, foreign_key: true
      t.string :from_address
      t.text :to_addresses, null: false
      t.text :cc_addresses
      t.text :bcc_addresses
      t.string :subject, null: false, limit: 998
      t.text :body, null: false
      t.string :reply_to_message_id
      t.jsonb :attachments, default: []
      t.string :status, default: 'draft', null: false

      t.timestamps
    end

    add_index :email_drafts, [:user_id, :updated_at], name: 'idx_email_drafts_user_recent'
    add_index :email_drafts, [:user_id, :status], name: 'idx_email_drafts_user_status'
  end
end
