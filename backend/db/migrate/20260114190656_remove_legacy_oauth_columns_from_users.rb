class RemoveLegacyOauthColumnsFromUsers < ActiveRecord::Migration[8.0]
  def change
    # Remove legacy OAuth columns that are no longer used
    # SSoT for Microsoft tokens is now:
    # - MicrosoftCredential (org-level SharePoint/OneDrive)
    # - UserMicrosoftToken (user-level email)
    remove_column :users, :oauth_token, :text
    remove_column :users, :oauth_expires_at, :datetime
  end
end
