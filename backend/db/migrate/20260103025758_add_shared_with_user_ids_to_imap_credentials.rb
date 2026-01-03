class AddSharedWithUserIdsToImapCredentials < ActiveRecord::Migration[8.0]
  def change
    add_column :imap_credentials, :shared_with_user_ids, :integer, array: true, default: []
  end
end
