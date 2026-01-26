# frozen_string_literal: true

module Api
  module V1
    class CloudflareCredentialsController < ApplicationController
      before_action :set_credential, only: [:show, :update, :destroy, :test]

      # GET /api/v1/cloudflare_credentials
      # Get current Cloudflare configuration
      def index
        credential = CloudflareCredential.active_credential(current_organization)

        if credential
          render json: {
            success: true,
            data: credential_json(credential)
          }
        else
          render json: {
            success: true,
            data: nil,
            configured: false
          }
        end
      end

      # GET /api/v1/cloudflare_credentials/:id
      def show
        render json: {
          success: true,
          data: credential_json(@credential)
        }
      end

      # POST /api/v1/cloudflare_credentials
      # Create or update Cloudflare configuration
      def create
        # Deactivate existing credential if present
        existing = CloudflareCredential.active_credential(current_organization)
        existing&.deactivate!

        credential = CloudflareCredential.new(
          organization: current_organization,
          api_token: params[:api_token],
          account_id: params[:account_id],
          email: params[:email],
          is_active: true,
          status: :pending
        )

        if credential.save
          # Test connection in background
          TestCloudflareConnectionJob.perform_later(credential.id)

          render json: {
            success: true,
            data: credential_json(credential)
          }, status: :created
        else
          render json: {
            success: false,
            error: credential.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PUT /api/v1/cloudflare_credentials/:id
      def update
        if @credential.update(credential_params)
          # Reset status and re-test
          @credential.update!(status: :pending)
          TestCloudflareConnectionJob.perform_later(@credential.id)

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

      # DELETE /api/v1/cloudflare_credentials/:id
      def destroy
        @credential.deactivate!
        render json: { success: true }
      end

      # POST /api/v1/cloudflare_credentials/:id/test
      # Test Cloudflare connection
      def test
        service = CloudflareService.new(@credential)

        if service.test_connection
          @credential.mark_connected!

          # Also get zone count for feedback
          zones = service.list_zones

          render json: {
            success: true,
            data: {
              connected: true,
              zones_count: zones.count,
              zones: zones.first(10).map { |z| { name: z["name"], id: z["id"], status: z["status"] } }
            }
          }
        else
          @credential.mark_error!("Connection test failed")

          render json: {
            success: false,
            error: "Failed to connect to Cloudflare. Please check your API token."
          }
        end
      rescue CloudflareService::AuthenticationError => e
        @credential.mark_error!(e.message)
        render json: {
          success: false,
          error: "Authentication failed: #{e.message}"
        }, status: :unauthorized
      rescue CloudflareService::ApiError => e
        @credential.mark_error!(e.message)
        render json: {
          success: false,
          error: "API error: #{e.message}"
        }, status: :unprocessable_entity
      end

      # GET /api/v1/cloudflare_credentials/zones
      # List available zones (domains) in Cloudflare
      def zones
        credential = CloudflareCredential.active_credential(current_organization)

        unless credential&.status_connected?
          render json: {
            success: false,
            error: "Cloudflare not connected"
          }, status: :unprocessable_entity
          return
        end

        service = CloudflareService.new(credential)
        zones = service.list_zones

        render json: {
          success: true,
          data: zones.map { |z|
            {
              id: z["id"],
              name: z["name"],
              status: z["status"],
              name_servers: z["name_servers"]
            }
          }
        }
      rescue CloudflareService::ApiError => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      private

      def set_credential
        @credential = CloudflareCredential.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Credential not found" }, status: :not_found
      end

      def credential_params
        params.permit(:api_token, :account_id, :email)
      end

      def credential_json(credential)
        {
          id: credential.id,
          account_id: credential.account_id,
          email: credential.email,
          status: credential.status,
          is_active: credential.is_active,
          last_connected_at: credential.last_connected_at,
          last_error_at: credential.last_error_at,
          error_message: credential.error_message,
          created_at: credential.created_at
          # Note: api_token is NOT included for security
        }
      end
    end
  end
end
