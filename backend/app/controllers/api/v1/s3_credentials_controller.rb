# frozen_string_literal: true

# S3CredentialsController - Manage S3-compatible storage credentials
#
# Supports: AWS S3, Backblaze B2, MinIO, Wasabi, Synology NAS
#
class Api::V1::S3CredentialsController < ApplicationController
  before_action :set_credential, only: [:show, :update, :destroy, :test_connection]

  # GET /api/v1/s3_credentials
  # List organization's S3 credentials
  def index
    credentials = S3CompatibleCredential.order(created_at: :desc)

    render json: {
      success: true,
      data: credentials.map { |c| credential_json(c) }
    }
  end

  # GET /api/v1/s3_credentials/:id
  def show
    render json: {
      success: true,
      data: credential_json(@credential, include_sensitive: false)
    }
  end

  # POST /api/v1/s3_credentials
  # Add a new S3 credential
  # SSoT (Jan 2026): bucket comes from params for initial test, then from WarehouseProvider
  def create
    credential = S3CompatibleCredential.new(credential_params)

    # Test connection before saving (bucket from params for validation)
    if credential.valid?
      begin
        client = credential.build_client
        # Use bucket from params for testing (SSoT bucket will be in WarehouseProvider)
        test_bucket = params.dig(:s3_credential, :bucket).presence || WarehouseProvider.instance&.bucket
        raise "No bucket configured. Set bucket in Storage Configuration first." unless test_bucket.present?
        client.head_bucket(bucket: test_bucket)
        credential.status = "connected"
      rescue Aws::S3::Errors::ServiceError => e
        return render json: {
          success: false,
          error: "Connection failed: #{friendly_error_message(e)}"
        }, status: :unprocessable_entity
      rescue RuntimeError => e
        return render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end
    end

    if credential.save
      render json: {
        success: true,
        data: credential_json(credential),
        message: "S3 storage connected successfully"
      }, status: :created
    else
      render json: {
        success: false,
        error: credential.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/s3_credentials/:id
  def update
    if @credential.update(credential_params)
      render json: {
        success: true,
        data: credential_json(@credential)
      }
    else
      render json: {
        success: false,
        error: @credential.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/s3_credentials/:id
  def destroy
    @credential.destroy!

    render json: {
      success: true,
      message: "S3 credential deleted"
    }
  end

  # POST /api/v1/s3_credentials/:id/test_connection
  # Test the S3 connection
  # SSoT (Jan 2026): bucket comes from WarehouseProvider or params
  def test_connection
    begin
      test_bucket = params[:bucket].presence
      if @credential.test_connection!(test_bucket)
        render json: {
          success: true,
          message: "Connection successful",
          data: {
            # bucket removed - WarehouseProvider.bucket is SSoT
            region: @credential.region,
            provider: @credential.provider_display_name
          }
        }
      else
        render json: {
          success: false,
          error: @credential.metadata["last_error"] || "Connection failed"
        }, status: :unprocessable_entity
      end
    rescue Aws::S3::Errors::ServiceError => e
      render json: {
        success: false,
        error: friendly_error_message(e)
      }, status: :unprocessable_entity
    rescue RuntimeError => e
      render json: {
        success: false,
        error: e.message
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/s3_credentials/test
  # Test connection without saving (for new credential form)
  # SSoT (Jan 2026): bucket comes from params for form validation
  def test
    credential = S3CompatibleCredential.new(credential_params)

    unless credential.valid?
      return render json: {
        success: false,
        error: credential.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end

    begin
      client = credential.build_client
      # Use bucket from params for testing (SSoT bucket will be in WarehouseProvider)
      test_bucket = params.dig(:s3_credential, :bucket).presence || WarehouseProvider.instance&.bucket
      raise "No bucket configured. Provide bucket in request or set in Storage Configuration." unless test_bucket.present?
      client.head_bucket(bucket: test_bucket)

      render json: {
        success: true,
        message: "Connection successful",
        data: {
          # bucket removed from response - WarehouseProvider.bucket is SSoT
          region: credential.region,
          provider: credential.provider_display_name
        }
      }
    rescue Aws::S3::Errors::ServiceError => e
      render json: {
        success: false,
        error: friendly_error_message(e)
      }, status: :unprocessable_entity
    rescue RuntimeError => e
      render json: {
        success: false,
        error: e.message
      }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/s3_credentials/providers
  # List available S3 provider presets
  def providers
    providers = [
      {
        id: "backblaze_b2",
        name: "Backblaze B2",
        description: "Low-cost cloud storage (~$0.006/GB/month)",
        endpoint_template: "https://s3.{region}.backblazeb2.com",
        region_hint: "e.g., us-west-004",
        help_url: "https://www.backblaze.com/docs/cloud-storage-s3-compatible-api"
      },
      {
        id: "aws_s3",
        name: "Amazon S3",
        description: "AWS cloud storage",
        endpoint_template: nil, # AWS S3 doesn't need custom endpoint
        region_hint: "e.g., us-east-1, ap-southeast-2",
        help_url: "https://docs.aws.amazon.com/s3/"
      },
      {
        id: "wasabi",
        name: "Wasabi",
        description: "Hot cloud storage, no egress fees",
        endpoint_template: "https://s3.{region}.wasabisys.com",
        region_hint: "e.g., us-east-1, ap-southeast-2",
        help_url: "https://docs.wasabi.com/docs/s3-api"
      },
      {
        id: "minio",
        name: "MinIO (Self-Hosted)",
        description: "Free, self-hosted S3-compatible storage",
        endpoint_template: "https://your-server:9000",
        region_hint: "Usually: us-east-1",
        help_url: "https://min.io/docs/minio/linux/index.html"
      },
      {
        id: "synology",
        name: "Synology NAS",
        description: "S3 Server on Synology NAS",
        endpoint_template: "https://your-nas-ip:5001",
        region_hint: "Usually: us-east-1",
        help_url: "https://kb.synology.com/en-global/DSM/help/S3Server/S3Server_desc"
      },
      {
        id: "other",
        name: "Other S3-Compatible",
        description: "Any S3-compatible storage provider",
        endpoint_template: "https://your-endpoint",
        region_hint: "Check your provider's documentation",
        help_url: nil
      }
    ]

    render json: {
      success: true,
      data: providers
    }
  end

  # GET /api/v1/s3_credentials/status
  # Get overall S3 storage status
  # SSoT (Jan 2026): bucket comes from WarehouseProvider, not credential
  def status
    credential = S3CompatibleCredential.active.connected.first

    if credential
      render json: {
        success: true,
        connected: true,
        data: {
          name: credential.name,
          provider: credential.provider_display_name,
          # bucket comes from WarehouseProvider SSoT
          bucket: WarehouseProvider.instance&.bucket,
          region: credential.region,
          status: credential.status
        }
      }
    else
      render json: {
        success: true,
        connected: false
      }
    end
  end

  # GET /api/v1/s3_credentials/:id/browse
  # Browse bucket contents
  def browse
    set_credential
    path = params[:path] || ""

    provider = DocumentProviders::S3Compatible.new(@credential)
    items = provider.list_folder(path)

    render json: {
      success: true,
      data: {
        path: path,
        items: items
      }
    }
  rescue => e
    render json: {
      success: false,
      error: "Failed to browse: #{e.message}"
    }, status: :unprocessable_entity
  end

  private

  def set_credential
    @credential = S3CompatibleCredential.find(params[:id])
  end

  # SSoT (Jan 2026): bucket removed from params - WarehouseProvider.bucket is SSoT
  def credential_params
    params.require(:s3_credential).permit(
      :name,
      :provider_type,
      :endpoint,
      :region,
      # bucket removed - WarehouseProvider.bucket is SSoT
      :access_key_id,
      :secret_access_key,
      :root_path,
      :is_active
    )
  end

  # SSoT (Jan 2026): bucket removed from credential response
  # Bucket is now in WarehouseProvider only - not credential
  def credential_json(credential, include_sensitive: false)
    json = {
      id: credential.id,
      name: credential.name,
      provider_type: credential.provider_type,
      provider_display_name: credential.provider_display_name,
      endpoint: credential.endpoint,
      region: credential.region,
      # bucket removed - WarehouseProvider.bucket is SSoT
      root_path: credential.root_path,
      is_active: credential.is_active,
      status: credential.status,
      created_at: credential.created_at,
      updated_at: credential.updated_at
    }

    # Never include secret_access_key, optionally include access_key_id
    if include_sensitive
      json[:access_key_id] = credential.access_key_id
    else
      # Show masked version
      key = credential.access_key_id.to_s
      json[:access_key_id_masked] = key.length > 8 ? "#{key[0..3]}...#{key[-4..]}" : "****"
    end

    json
  end

  def friendly_error_message(error)
    case error
    when Aws::S3::Errors::NoSuchBucket
      "Bucket '#{@credential&.bucket || 'unknown'}' does not exist"
    when Aws::S3::Errors::AccessDenied
      "Access denied. Check your access key and secret key."
    when Aws::S3::Errors::InvalidAccessKeyId
      "Invalid access key ID"
    when Aws::S3::Errors::SignatureDoesNotMatch
      "Invalid secret access key"
    when Aws::S3::Errors::PermanentRedirect
      "Bucket exists in a different region. Check region setting."
    else
      error.message
    end
  end
end
