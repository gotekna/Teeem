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
      def index
        credentials = current_organization.s3_compatible_credentials.order(:name)

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
      def create
        @credential = current_organization.s3_compatible_credentials.build(credential_params)

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
      # SSoT (Jan 2026): bucket comes from StorageConfiguration, or optionally from params for testing
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
        @credential = current_organization.s3_compatible_credentials.find(params[:id])
      end

      # SSoT (Jan 2026): bucket removed from params - StorageConfiguration.bucket is SSoT
      def credential_params
        params.require(:s3_compatible_credential).permit(
          :name, :provider_type, :endpoint, :region,
          :access_key_id, :secret_access_key, :is_active
        )
      end

      # SSoT (Jan 2026): bucket removed from credential response
      # Bucket is now in StorageConfiguration only - not credential
      def credential_json(credential)
        {
          id: credential.id,
          name: credential.name,
          providerType: credential.provider_type,
          providerName: credential.provider_display_name,
          endpoint: credential.endpoint,
          region: credential.region,
          # bucket removed - StorageConfiguration.bucket is SSoT
          status: credential.status,
          isActive: credential.is_active,
          isConnected: credential.connected?,
          createdAt: credential.created_at,
          updatedAt: credential.updated_at
        }
      end

      def current_organization
        ActsAsTenant.current_tenant
      end
    end
  end
end
