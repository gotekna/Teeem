# frozen_string_literal: true

module Api
  module V1
    class PolarisCredentialsController < ApplicationController
      before_action :set_credential, only: [:show, :update, :destroy, :test]

      # GET /api/v1/polaris_credentials
      # Get current PolarMail configuration
      def index
        credential = PolarisCredential.for_org(current_organization).active.first

        if credential
          render json: {
            success: true,
            data: credential_json(credential),
            configured: true
          }
        else
          render json: {
            success: true,
            data: nil,
            configured: false
          }
        end
      end

      # GET /api/v1/polaris_credentials/:id
      def show
        render json: {
          success: true,
          data: credential_json(@credential)
        }
      end

      # POST /api/v1/polaris_credentials
      # Create or update PolarMail configuration
      def create
        # Deactivate existing credential if present
        existing = PolarisCredential.for_org(current_organization).active.first
        existing&.update!(is_active: false)

        credential = PolarisCredential.new(
          organization: current_organization,
          api_key: params[:admin_username],
          api_secret: params[:admin_password],
          is_active: true,
          status: "pending"
        )

        if credential.save
          # Test connection immediately
          if credential.test_connection!
            render json: {
              success: true,
              data: credential_json(credential),
              message: "Connected successfully to EmailArray"
            }, status: :created
          else
            render json: {
              success: true,
              data: credential_json(credential),
              message: "Credentials saved but connection test failed. Please verify your credentials."
            }, status: :created
          end
        else
          render json: {
            success: false,
            error: credential.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PUT /api/v1/polaris_credentials/:id
      def update
        @credential.assign_attributes(
          api_key: params[:admin_username] || @credential.api_key,
          api_secret: params[:admin_password] || @credential.api_secret,
          status: "pending"
        )

        if @credential.save
          # Re-test connection
          @credential.test_connection!

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

      # DELETE /api/v1/polaris_credentials/:id
      def destroy
        @credential.update!(is_active: false)
        render json: { success: true }
      end

      # POST /api/v1/polaris_credentials/:id/test
      # Test PolarMail connection
      def test
        if @credential.test_connection!
          render json: {
            success: true,
            data: {
              connected: true,
              message: "Successfully connected to EmailArray"
            }
          }
        else
          render json: {
            success: false,
            error: @credential.error_message || "Connection test failed"
          }
        end
      end

      private

      def set_credential
        @credential = PolarisCredential.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Credential not found" }, status: :not_found
      end

      def credential_json(credential)
        {
          id: credential.id,
          admin_username: credential.admin_username,
          status: credential.status,
          is_active: credential.is_active,
          last_connected_at: credential.last_connected_at,
          last_error_at: credential.last_error_at,
          error_message: credential.error_message,
          created_at: credential.created_at
          # Note: admin_password is NOT included for security
        }
      end
    end
  end
end
