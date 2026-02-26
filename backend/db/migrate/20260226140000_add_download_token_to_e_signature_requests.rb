# frozen_string_literal: true

# Replace MessageVerifier-based download tokens with database-stored tokens.
#
# Root cause: MessageVerifier uses SECRET_KEY_BASE which differs per Heroku app
# (staging, beta, production). Since all environments share the same database,
# completion can trigger on any app, but the download URL always points to production.
# If completion runs on staging, the token is signed with staging's secret but
# production can't verify it → "Invalid or expired download link".
#
# Fix: Store a random token in the DB. Any environment can verify it by lookup.
class AddDownloadTokenToESignatureRequests < ActiveRecord::Migration[7.2]
  def up
    add_column :e_signature_requests, :download_token, :string
    add_index :e_signature_requests, :download_token, unique: true

    # Backfill tokens for existing completed requests so their download links work
    ESignatureRequest.where(status: "completed", download_token: nil).find_each do |req|
      req.update_column(:download_token, SecureRandom.urlsafe_base64(32))
    end
  end

  def down
    remove_column :e_signature_requests, :download_token
  end
end
