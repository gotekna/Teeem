# frozen_string_literal: true

module Api
  module V1
    # S3CompatibleCredentialsController - Manage S3-compatible storage credentials
    #
    # Endpoints:
    #   GET  /api/v1/s3_compatible_credentials - List all credentials for tenant
    #   POST /api/v1/s3_compatible_credentials - Create new credential
    #   GET  /api/v1/s3_compatible_credentials/:id - Show credential
    #   PATCH /api/v1/s3_compatible_credentials/:id - Update credential
    #   DELETE /api/v1/s3_compatible_credentials/:id - Delete credential
    #   POST /api/v1/s3_compatible_credentials/:id/test - Test connection
    #
    class S3CompatibleCredentialsController < ApplicationController
      before_action :require_admin
      before_action :set_credential, only: %i[show update destroy test]

      # GET /api/v1/s3_compatible_credentials
      # SSoT (Feb 2026): Uses tenant-scoped lookup
      def index
        credentials = S3CompatibleCredential.for_tenant(current_tenant).order(:name)

        render json: {
          success: true,
          data: credentials.map { |c| credential_json(c) }
        }
      end

      # GET /api/v1/s3_compatible_credentials/:id
      def show
        render json: {
          success: true,
          data: credential_json(@credential)
        }
      end

      # POST /api/v1/s3_compatible_credentials
      # SSoT (Feb 2026): Uses tenant-scoped lookup
      def create
        @credential = S3CompatibleCredential.new(credential_params)
        @credential.tenant = current_tenant
        @credential.organization = current_organization # DEPRECATED: kept for backwards compat

        if @credential.save
          render json: {
            success: true,
            data: credential_json(@credential)
          }, status: :created
        else
          render json: {
            success: false,
            error: @credential.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/s3_compatible_credentials/:id
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

      # DELETE /api/v1/s3_compatible_credentials/:id
      def destroy
        # Check if credential is in use by backup configurations
        if BackupConfiguration.where(primary_credential_id: @credential.id)
            .or(BackupConfiguration.where(secondary_credential_id: @credential.id)).exists?
          return render json: {
            success: false,
            error: "Cannot delete credential that is in use by backup configuration"
          }, status: :unprocessable_entity
        end

        @credential.destroy

        render json: {
          success: true,
          message: "Credential deleted successfully"
        }
      end

      # POST /api/v1/s3_compatible_credentials/:id/test
      # SSoT (Jan 2026): bucket comes from WarehouseProvider, or optionally from params for testing
      def test
        test_bucket = params[:bucket].presence
        if @credential.test_connection!(test_bucket)
          render json: {
            success: true,
            message: "Connection successful",
            data: credential_json(@credential.reload)
          }
        else
          render json: {
            success: false,
            error: @credential.metadata["last_error"] || "Connection failed",
            data: credential_json(@credential.reload)
          }, status: :unprocessable_entity
        end
      end

      private

      def set_credential
        # SSoT (Feb 2026): Uses tenant-scoped lookup
        @credential = S3CompatibleCredential.for_tenant(current_tenant).find(params[:id])
      end

      # SSoT (Jan 2026): bucket removed from params - WarehouseProvider.bucket is SSoT
      def credential_params
        params.require(:s3_compatible_credential).permit(
          :name, :provider_type, :endpoint, :region,
          :access_key_id, :secret_access_key, :is_active
        )
      end

      # SSoT (Jan 2026): bucket removed from credential response
      # Bucket is now in WarehouseProvider only - not credential
      def credential_json(credential)
        {
          id: credential.id,
          name: credential.name,
          providerType: credential.provider_type,
          providerName: credential.provider_display_name,
          endpoint: credential.endpoint,
          region: credential.region,
          # bucket removed - WarehouseProvider.bucket is SSoT
          status: credential.status,
          isActive: credential.is_active,
          isConnected: credential.connected?,
          createdAt: credential.created_at,
          updatedAt: credential.updated_at
        }
      end
    end
  end
end
