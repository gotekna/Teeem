class AddNavPositionToImapCredentials < ActiveRecord::Migration[8.0]
  def change
    add_column :imap_credentials, :nav_position, :integer, default: 0
  end
end
