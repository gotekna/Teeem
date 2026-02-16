# frozen_string_literal: true

class AddProviderDraftFieldsToEmailDrafts < ActiveRecord::Migration[7.1]
  def change
    add_column :email_drafts, :provider_draft_id, :string
    add_column :email_drafts, :provider_type, :string
    add_column :email_drafts, :microsoft_credential_id, :bigint
    add_column :email_drafts, :provider_synced_at, :datetime
    add_column :email_drafts, :provider_sync_error, :string

    add_index :email_drafts, :microsoft_credential_id
    add_index :email_drafts, :provider_draft_id
  end
end
