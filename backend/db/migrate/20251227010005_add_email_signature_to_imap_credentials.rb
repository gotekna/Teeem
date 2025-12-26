class AddEmailSignatureToImapCredentials < ActiveRecord::Migration[8.0]
  def change
    add_column :imap_credentials, :email_signature, :text
  end
end
