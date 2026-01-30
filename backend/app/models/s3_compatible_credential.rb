# frozen_string_literal: true

# S3CompatibleCredential - Credentials for S3-compatible document storage
#
# Supports multiple S3-compatible providers:
# - aws_s3: Amazon S3
# - backblaze_b2: Backblaze B2 Cloud Storage
# - minio: Self-hosted MinIO
# - wasabi: Wasabi Hot Cloud Storage
# - synology: Synology NAS with S3 Server
# - other: Generic S3-compatible storage
#
# Usage:
#   credential = S3CompatibleCredential.create!(
#     organization: org,
#     name: "Backblaze B2 Documents",
#     provider_type: "backblaze_b2",
#     endpoint: "https://s3.us-west-004.backblazeb2.com",
#     region: "us-west-004",
#     access_key_id: "...",
#     secret_access_key: "..."
#   )
#
# SSoT (Jan 2026): This model stores AUTH credentials only.
# Bucket is NO LONGER stored here - WarehouseProvider.bucket is THE ONE SSoT.
# test_connection! reads bucket from WarehouseProvider or accepts a test bucket param.
# DocumentProviders should NEVER read bucket from credential.
#
class S3CompatibleCredential < ApplicationRecord
  # Associations
  belongs_to :organization, optional: true

  # Encrypt sensitive credentials
  encrypts :access_key_id
  encrypts :secret_access_key

  # Provider types
  PROVIDER_TYPES = %w[aws_s3 backblaze_b2 minio wasabi synology other].freeze

  # Status values
  STATUSES = %w[pending connected error disconnected].freeze

  # Validations
  validates :name, presence: true
  validates :provider_type, presence: true, inclusion: { in: PROVIDER_TYPES }
  validates :region, presence: true
  # NOTE: bucket validation REMOVED (Jan 2026) - WarehouseProvider.bucket is SSoT
  # The bucket column is kept for backward compatibility but is no longer required
  validates :access_key_id, presence: true
  validates :secret_access_key, presence: true
  validates :status, inclusion: { in: STATUSES }, allow_nil: true

  # Endpoint required for non-AWS providers
  validates :endpoint, presence: true, unless: -> { provider_type == "aws_s3" }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :connected, -> { where(status: "connected") }
  scope :for_organization, ->(org) { where(organization_id: org.id) }
  # Filter to only credentials that can be decrypted (used to skip key mismatches)
  scope :decryptable, -> { all.select(&:decryptable?) }

  # Callbacks
  before_validation :set_defaults
  after_save :clear_client_cache

  # Get the S3 endpoint URL
  # @return [String] The endpoint URL
  def endpoint_url
    return nil if provider_type == "aws_s3"
    endpoint
  end

  # Get the full bucket URL for display
  # SSoT (Jan 2026): Uses WarehouseProvider.bucket, not credential.bucket
  def bucket_url
    ssot_bucket = WarehouseProvider.instance&.bucket
    return nil unless ssot_bucket.present?

    case provider_type
    when "aws_s3"
      "https://#{ssot_bucket}.s3.#{region}.amazonaws.com"
    when "backblaze_b2"
      "https://#{ssot_bucket}.s3.#{region}.backblazeb2.com"
    else
      "#{endpoint}/#{ssot_bucket}"
    end
  end

  # DEPRECATED: bucket now lives in WarehouseProvider (SSoT)
  # This method is kept for backward compatibility but will be removed
  def bucket
    Rails.logger.warn "[DEPRECATED] S3CompatibleCredential#bucket is deprecated. Use WarehouseProvider.instance.bucket instead."
    WarehouseProvider.instance&.bucket || read_attribute(:bucket)
  end

  # Build an AWS S3 client for this credential
  # @return [Aws::S3::Client]
  # @raise [ActiveRecord::Encryption::Errors::Decryption] If credentials cannot be decrypted
  def build_client
    # Use safe accessors to detect decryption issues early
    key_id = safe_access_key_id
    secret = safe_secret_access_key

    unless key_id && secret
      raise ActiveRecord::Encryption::Errors::Decryption,
        "Cannot decrypt S3 credentials (id=#{id}). This usually means the RAILS_MASTER_KEY " \
        "doesn't match the key used to encrypt the data. Try re-creating the credential."
    end

    options = {
      access_key_id: key_id,
      secret_access_key: secret,
      region: region
    }

    # Add custom endpoint for non-AWS providers
    if endpoint.present?
      options[:endpoint] = endpoint
      options[:force_path_style] = true  # Required for most S3-compatible services
    end

    Aws::S3::Client.new(options)
  end

  # Build an AWS S3 Resource for this credential
  # @return [Aws::S3::Resource]
  def build_resource
    Aws::S3::Resource.new(client: build_client)
  end

  # Test the connection
  # @param test_bucket [String, nil] Optional bucket to test (for form validation before StorageConfig exists)
  # @return [Boolean] True if connection successful
  # SSoT (Jan 2026): Bucket comes from WarehouseProvider, not credential
  def test_connection!(test_bucket = nil)
    client = build_client

    # Use provided bucket, or fall back to WarehouseProvider SSoT
    bucket_to_test = test_bucket.presence || WarehouseProvider.instance&.bucket
    raise "No bucket configured. Set bucket in Storage Configuration first." unless bucket_to_test.present?

    client.head_bucket(bucket: bucket_to_test)
    update!(status: "connected")
    true
  rescue Aws::S3::Errors::ServiceError => e
    update!(status: "error", metadata: metadata.merge(last_error: e.message))
    false
  end

  # Mark as disconnected
  def disconnect!
    update!(status: "disconnected", is_active: false)
  end

  # Provider display name
  def provider_display_name
    case provider_type
    when "aws_s3" then "Amazon S3"
    when "backblaze_b2" then "Backblaze B2"
    when "minio" then "MinIO"
    when "wasabi" then "Wasabi"
    when "synology" then "Synology NAS"
    else "S3-Compatible Storage"
    end
  end

  # Alias for provider_display_name (used by backup controller)
  alias_method :provider_name, :provider_display_name

  # Check if connection is active and verified
  def connected?
    status == "connected" && is_active?
  end

  # Safe accessor for encrypted access_key_id (handles decryption errors)
  # Returns nil if decryption fails (key mismatch between environments)
  def safe_access_key_id
    access_key_id
  rescue ActiveRecord::Encryption::Errors::Decryption
    Rails.logger.warn "[S3CompatibleCredential] Decryption failed for access_key_id (id=#{id})"
    nil
  end

  # Safe accessor for encrypted secret_access_key (handles decryption errors)
  # Returns nil if decryption fails (key mismatch between environments)
  def safe_secret_access_key
    secret_access_key
  rescue ActiveRecord::Encryption::Errors::Decryption
    Rails.logger.warn "[S3CompatibleCredential] Decryption failed for secret_access_key (id=#{id})"
    nil
  end

  # Check if credentials can be decrypted (useful for detecting key mismatches)
  def decryptable?
    safe_access_key_id.present? && safe_secret_access_key.present?
  end

  # DEPRECATED: root_path now lives in WarehouseProvider (SSoT)
  # This method is kept for backward compatibility but will be removed
  def root_path
    Rails.logger.warn "[DEPRECATED] S3CompatibleCredential#root_path is deprecated. Use WarehouseProvider.instance.root_path instead."
    WarehouseProvider.instance&.root_path || read_attribute(:root_path) || ""
  end

  private

  def set_defaults
    self.status ||= "pending"
    self.metadata ||= {}
    # NOTE: root_path column removed - now lives in WarehouseProvider (SSoT)

    # Auto-detect region from endpoint for Backblaze B2
    if provider_type == "backblaze_b2" && endpoint.present? && region.blank?
      # Extract region from endpoint like s3.us-west-004.backblazeb2.com
      if endpoint =~ /s3\.([a-z]+-[a-z]+-\d+)\.backblazeb2\.com/
        self.region = $1
      end
    end
  end

  def clear_client_cache
    # Clear any cached clients when credentials change
    @client = nil
    @resource = nil
  end
end
