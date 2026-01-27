# frozen_string_literal: true

class AddSyncAllToImapCredentials < ActiveRecord::Migration[7.0]
  def change
    add_column :imap_credentials, :sync_all, :boolean, default: false, null: false
  end
end
