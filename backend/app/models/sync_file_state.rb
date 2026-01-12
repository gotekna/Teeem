# frozen_string_literal: true

# SyncFileState - Tracks sync state for each file on a desktop client
#
# This is the backend's view of what's on the client. The client reports
# its state, and this table helps detect conflicts and track sync progress.
#
class SyncFileState < ApplicationRecord
  belongs_to :desktop_client
  belongs_to :sync_subscription

  # Sync status values
  STATUSES = %w[synced pending_download pending_upload conflict placeholder error].freeze

  # Validations
  validates :remote_path, presence: true, uniqueness: { scope: :desktop_client_id }
  validates :file_name, presence: true
  validates :sync_status, inclusion: { in: STATUSES }

  # Scopes
  scope :synced, -> { where(sync_status: "synced") }
  scope :pending_download, -> { where(sync_status: "pending_download") }
  scope :pending_upload, -> { where(sync_status: "pending_upload") }
  scope :conflicts, -> { where(sync_status: "conflict") }
  scope :placeholders, -> { where(is_placeholder: true) }
  scope :pinned, -> { where(is_pinned: true) }
  scope :deleted, -> { where(is_deleted: true) }
  scope :not_deleted, -> { where(is_deleted: false) }
  scope :with_errors, -> { where("error_count > 0") }
  scope :needs_action, -> { where(sync_status: %w[pending_download pending_upload conflict]) }

  # Delegate
  delegate :user, :organization, to: :desktop_client

  # Update from remote change (cloud file changed)
  def update_from_remote!(remote_data)
    new_status = determine_status_from_remote(remote_data)

    update!(
      remote_item_id: remote_data[:item_id],
      remote_etag: remote_data[:etag],
      remote_content_hash: remote_data[:content_hash],
      remote_modified_at: remote_data[:modified_at],
      file_size: remote_data[:size],
      sync_status: new_status,
      error_count: 0,
      last_error: nil
    )
  end

  # Update from local change (client reported change)
  def update_from_local!(local_data)
    new_status = determine_status_from_local(local_data)

    update!(
      local_content_hash: local_data[:content_hash],
      local_modified_at: local_data[:modified_at],
      is_placeholder: local_data[:is_placeholder] || false,
      sync_status: new_status
    )
  end

  # Mark as synced (both sides match)
  def mark_synced!(content_hash: nil)
    update!(
      sync_status: "synced",
      is_placeholder: false,
      last_synced_at: Time.current,
      local_content_hash: content_hash || remote_content_hash,
      error_count: 0,
      last_error: nil
    )
  end

  # Mark as placeholder (file visible but not downloaded)
  def mark_as_placeholder!
    update!(
      sync_status: "placeholder",
      is_placeholder: true,
      local_content_hash: nil
    )
  end

  # Pin file for offline access
  def pin!
    update!(is_pinned: true)
    # If placeholder, trigger download
    update!(sync_status: "pending_download") if is_placeholder?
  end

  # Unpin file
  def unpin!
    update!(is_pinned: false)
  end

  # Mark for deletion
  def mark_deleted!
    update!(is_deleted: true, sync_status: "pending_upload")
  end

  # Record sync error
  def record_error!(message)
    update!(
      error_count: error_count + 1,
      last_error: message,
      sync_status: error_count >= 3 ? "error" : sync_status
    )
  end

  # Detect if there's a conflict
  def has_conflict?
    return false if remote_content_hash.blank? || local_content_hash.blank?
    return false if remote_content_hash == local_content_hash

    # Both sides have different content and both modified since last sync
    local_changed = local_modified_at && last_synced_at && local_modified_at > last_synced_at
    remote_changed = remote_modified_at && last_synced_at && remote_modified_at > last_synced_at

    local_changed && remote_changed
  end

  # Resolve conflict
  def resolve_conflict!(resolution)
    case resolution
    when "keep_local"
      update!(sync_status: "pending_upload")
    when "keep_remote"
      update!(sync_status: "pending_download", local_content_hash: nil)
    when "keep_both"
      # This creates a new file for local version, downloads remote
      # The client handles creating "file (local copy).ext"
      update!(sync_status: "pending_download")
    end
  end

  # Get download URL for this file
  def download_url
    return nil unless remote_item_id.present?

    provider = organization.document_storage
    provider.download_url(remote_item_id, expires_in: 3600)
  rescue StandardError => e
    Rails.logger.error("Failed to get download URL for #{remote_path}: #{e.message}")
    nil
  end

  # Format for API response
  def as_json(options = {})
    {
      id: id,
      remote_path: remote_path,
      file_name: file_name,
      file_size: file_size,
      sync_status: sync_status,
      is_placeholder: is_placeholder,
      is_pinned: is_pinned,
      remote_modified_at: remote_modified_at,
      local_modified_at: local_modified_at,
      last_synced_at: last_synced_at,
      has_error: error_count > 0,
      last_error: last_error
    }
  end

  private

  def determine_status_from_remote(remote_data)
    # If local hasn't been modified, just needs download
    return "pending_download" if local_content_hash.blank?

    # If hashes match, already synced
    return "synced" if remote_data[:content_hash] == local_content_hash

    # If local was modified since last sync, it's a conflict
    if local_modified_at && last_synced_at && local_modified_at > last_synced_at
      return "conflict"
    end

    # Otherwise, remote is newer
    "pending_download"
  end

  def determine_status_from_local(local_data)
    # If remote hasn't been set, this is initial sync
    return "pending_upload" if remote_content_hash.blank?

    # If hashes match, already synced
    return "synced" if local_data[:content_hash] == remote_content_hash

    # If remote was modified since last sync, it's a conflict
    if remote_modified_at && last_synced_at && remote_modified_at > last_synced_at
      return "conflict"
    end

    # Otherwise, local is newer
    "pending_upload"
  end
end
