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
#     bucket: "teeem-documents",
#     access_key_id: "...",
#     secret_access_key: "..."
#   )
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
  validates :bucket, presence: true
  validates :access_key_id, presence: true
  validates :secret_access_key, presence: true
  validates :status, inclusion: { in: STATUSES }, allow_nil: true

  # Endpoint required for non-AWS providers
  validates :endpoint, presence: true, unless: -> { provider_type == "aws_s3" }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :connected, -> { where(status: "connected") }
  scope :for_organization, ->(org) { where(organization_id: org.id) }

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
  def bucket_url
    case provider_type
    when "aws_s3"
      "https://#{bucket}.s3.#{region}.amazonaws.com"
    when "backblaze_b2"
      "https://#{bucket}.s3.#{region}.backblazeb2.com"
    else
      "#{endpoint}/#{bucket}"
    end
  end

  # Build an AWS S3 client for this credential
  # @return [Aws::S3::Client]
  def build_client
    options = {
      access_key_id: access_key_id,
      secret_access_key: secret_access_key,
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
  # @return [Boolean] True if connection successful
  def test_connection!
    client = build_client
    client.head_bucket(bucket: bucket)
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

  private

  def set_defaults
    self.status ||= "pending"
    self.metadata ||= {}
    self.root_path ||= ""

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
