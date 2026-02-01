# frozen_string_literal: true

# SyncSubscription - Tracks which folders a desktop client wants to sync
#
# Users select jobs, companies, or contacts to sync to their local machine.
# Each subscription can have custom file type overrides.
#
class SyncSubscription < ApplicationRecord
  belongs_to :desktop_client
  belongs_to :syncable, polymorphic: true  # Job, Corporate, Contact

  has_many :sync_file_states, dependent: :destroy

  # Validations
  validates :syncable_type, inclusion: { in: %w[Job Corporate Contact] }
  validates :syncable_id, uniqueness: { scope: [:desktop_client_id, :syncable_type] }

  # Scopes
  scope :enabled, -> { where(enabled: true) }
  scope :disabled, -> { where(enabled: false) }
  scope :for_jobs, -> { where(syncable_type: "Job") }
  scope :for_companies, -> { where(syncable_type: "Corporate") }
  scope :for_contacts, -> { where(syncable_type: "Contact") }
  scope :needs_sync, -> { where("last_sync_at IS NULL OR last_sync_at < ?", 5.minutes.ago) }

  # Delegate to desktop client
  delegate :user, :organization, to: :desktop_client

  # Get the remote path for this subscription based on syncable type
  # SSoT: Uses WarehouseProvider for base paths
  def remote_path
    config = WarehouseProvider.instance
    case syncable_type
    when "Job"
      # SSoT: Use WarehouseProvider.job_path for consistent folder naming
      job = syncable
      config&.job_path(job.job_code) || "/Jobs/#{job.job_code}"
    when "Corporate"
      company = syncable
      base = config.path_for(:corporate)
      "/#{base}/#{company.name}".gsub(/[<>:"\/\\|?*]/, "_")
    when "Contact"
      contact = syncable
      base = config.path_for(:contact)
      "/#{base}/#{contact.full_name}".gsub(/[<>:"\/\\|?*]/, "_")
    end
  end

  # Get storage folder ID for this subscription
  def storage_folder_id
    case syncable_type
    when "Job"
      syncable.storage_folder_id
    when "Corporate"
      syncable.storage_folder_id
    when "Contact"
      # Contacts may not have dedicated storage folders
      nil
    end
  end

  # Check if a file should be synced based on exclusion rules
  def should_sync_file?(filename, file_size)
    extension = File.extname(filename).downcase

    # Check subscription-level overrides first
    if file_type_overrides["include"]&.include?(extension)
      return true
    end
    if file_type_overrides["exclude"]&.include?(extension)
      return false
    end

    # Fall back to user/org exclusion rules
    exclusion_rules = SyncExclusionRule.effective_rules_for(
      organization: organization,
      user: user
    )

    exclusion_rules.none? { |rule| rule.matches?(filename, file_size) }
  end

  # Record sync completion
  def record_sync!(files_count:, bytes_count:, delta_token: nil)
    update!(
      last_sync_at: Time.current,
      files_synced: files_count,
      bytes_synced: bytes_count,
      delta_token: delta_token
    )
  end

  # Get display name for this subscription
  def display_name
    case syncable_type
    when "Job"
      job = syncable
      "Job #{job.job_number} - #{job.title}"
    when "Corporate"
      syncable.name
    when "Contact"
      syncable.full_name
    end
  end

  # Get document count for this subscription
  # SSoT: WarehouseDocument is now THE ONE table for all document metadata
  def document_count
    case syncable_type
    when "Job"
      WarehouseDocument.where(linkable_type: "Job", linkable_id: syncable_id).count
    when "Corporate"
      WarehouseDocument.where(linkable_type: "Corporate", linkable_id: syncable_id).count
    when "Contact"
      WarehouseDocument.where(linkable_type: "Contact", linkable_id: syncable_id).count
    else
      0
    end
  end

  # Serialize for API response
  def as_json(options = {})
    {
      id: id,
      syncable_type: syncable_type,
      syncable_id: syncable_id,
      display_name: display_name,
      remote_path: remote_path,
      include_subfolders: include_subfolders,
      enabled: enabled,
      file_type_overrides: file_type_overrides,
      last_sync_at: last_sync_at,
      files_synced: files_synced,
      bytes_synced: bytes_synced,
      document_count: document_count
    }
  end
end
