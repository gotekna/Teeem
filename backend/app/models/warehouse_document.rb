# frozen_string_literal: true

# WarehouseDocument - SSoT for File Warehouse metadata
#
# This is THE universal table for all document warehouse metadata.
# Links ANY document type (JobDocument, EmailAttachment, etc.) to StorageBlob.
#
# Architecture:
#   JobDocument / EmailAttachment / CorporateCompanyDocument
#       └── has_one :warehouse_document, as: :documentable
#               └── belongs_to :storage_blob
#                       └── content_hash (deduplication)
#                       └── storage_path (S3 key)
#
# Two Names:
#   - display_name: What user SEES in File Warehouse UI ("Tax Return FY2024")
#   - send_name: What file is CALLED when downloaded/emailed ("TA Tax Return 2024.pdf")
#
# Virtual Folders:
#   - folder: Virtual path, changing is instant (DB update only, no S3 copy)
#
class WarehouseDocument < ApplicationRecord
  # Polymorphic association to any document model
  belongs_to :documentable, polymorphic: true

  # Link to deduplicated storage blob
  belongs_to :storage_blob, optional: true

  # Validations
  validates :display_name, presence: true
  validates :source_type, presence: true, inclusion: {
    in: %w[corporate job email task people contact user template],
    message: "%{value} is not a valid source type"
  }

  # Scopes
  scope :by_source, ->(source) { where(source_type: source) }
  scope :in_folder, ->(folder) { where(folder: folder) }
  scope :with_blob, -> { where.not(storage_blob_id: nil) }
  scope :without_blob, -> { where(storage_blob_id: nil) }

  # Constants for filename sanitization (Full Sanitization mode)
  MAX_FILENAME_LENGTH = 200
  INVALID_FILENAME_CHARS = /[:\/*?"<>|\\]/

  # SSoT: Get the filename for downloads
  # Uses SendNameResolver for full template expansion and sanitization
  #
  # Priority (handled by SendNameResolver):
  #   1. send_name (if already resolved)
  #   2. DocumentType.file_name template (expanded with context)
  #   3. Source-specific defaults (e.g., "{Subject} - {Date}.eml" for emails)
  #   4. display_name
  #   5. original_filename
  #   6. "document" (last resort)
  #
  def download_filename
    SendNameResolver.new.resolve(self)
  end

  # Legacy method - kept for backwards compatibility
  # Use download_filename instead
  def legacy_download_filename
    raw_name = send_name.presence || display_name
    sanitize_filename(raw_name)
  end

  # SSoT: Get storage path from blob
  def storage_path
    storage_blob&.storage_path
  end

  # SSoT: Get presigned download URL with custom filename
  def download_url(expires_in: 3600)
    return nil unless storage_blob&.storage_path

    provider = DocumentProviders.for_organization(Organization.first)
    provider.download_url(
      storage_blob.storage_path,
      expires_in: expires_in,
      filename: download_filename
    )
  end

  # Update folder (instant - just DB update, no S3 copy)
  def move_to_folder(new_folder)
    update!(folder: new_folder)
  end

  private

  # Full sanitization for 100% accurate filenames
  def sanitize_filename(name)
    return "document" if name.blank?

    # 1. Remove invalid chars (: / \ * ? " < > |)
    clean = name.gsub(INVALID_FILENAME_CHARS, " ")

    # 2. Collapse multiple spaces
    clean = clean.gsub(/\s+/, " ").strip

    # 3. Truncate if too long
    clean = truncate_filename(clean)

    # 4. Ensure extension
    clean = ensure_extension(clean)

    clean
  end

  def truncate_filename(name)
    return name if name.length <= MAX_FILENAME_LENGTH

    ext = File.extname(name)
    base = File.basename(name, ext)
    max_base = MAX_FILENAME_LENGTH - ext.length - 3 # -3 for "..."
    "#{base[0..max_base]}...#{ext}"
  end

  def ensure_extension(name)
    return name if File.extname(name).present?

    # Try to get extension from original_filename or content_type
    ext = if original_filename.present?
            File.extname(original_filename)
          elsif content_type.present?
            MIME::Types[content_type].first&.preferred_extension&.then { |e| ".#{e}" }
          end

    ext ||= ".pdf" # Default fallback
    "#{name}#{ext}"
  end
end
