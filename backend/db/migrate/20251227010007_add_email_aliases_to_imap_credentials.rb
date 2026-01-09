class AddEmailAliasesToImapCredentials < ActiveRecord::Migration[8.0]
  def change
    # Array of alternate email addresses user can send from
    # e.g., ["sales@company.com", "info@company.com"]
    add_column :imap_credentials, :email_aliases, :text, array: true, default: []
  end
end
