class AddMicrosoftCredentialIdToEmailRules < ActiveRecord::Migration[8.0]
  def change
    add_column :email_rules, :microsoft_credential_id, :bigint
    add_column :email_rules, :mailbox_email, :string  # For MS365: which mailbox the rule applies to
    add_index :email_rules, :microsoft_credential_id
    add_foreign_key :email_rules, :microsoft_credentials, on_delete: :cascade
  end
end
