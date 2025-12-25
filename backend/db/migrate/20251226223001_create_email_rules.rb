class CreateEmailRules < ActiveRecord::Migration[8.0]
  def change
    create_table :email_rules do |t|
      t.references :user, null: false, foreign_key: true
      t.references :imap_credential, null: true, foreign_key: true

      t.string :name, null: false
      t.integer :priority, default: 0
      t.boolean :is_active, default: true
      t.boolean :stop_processing, default: false

      t.jsonb :conditions, default: {}
      t.jsonb :actions, default: {}

      t.integer :emails_matched, default: 0
      t.datetime :last_matched_at

      t.timestamps
    end

    add_index :email_rules, [:user_id, :priority]
    add_index :email_rules, [:imap_credential_id, :is_active]
  end
end
