class AddContentUnavailableToSyncedEmails < ActiveRecord::Migration[8.0]
  def change
    add_column :synced_emails, :content_unavailable, :boolean, default: false, null: false
    add_column :synced_emails, :content_unavailable_reason, :string
    add_index :synced_emails, :content_unavailable, where: "content_unavailable = true"
  end
end
