# frozen_string_literal: true

# SSoT: Portal Users Controller - Converted from concerns/contacts/portal_user_management.rb
# Part of ADR-001: Contacts Controller Decomposition
#
# Actions:
#   - create: POST /api/v1/contacts/portal_users/:contact_id
#   - update: PATCH /api/v1/contacts/portal_users/:contact_id
#   - destroy: DELETE /api/v1/contacts/portal_users/:contact_id
#
module Api
  module V1
    module Contacts
      class PortalUsersController < ApplicationController
        before_action :authorize_request
        before_action :set_contact

        # POST /api/v1/contacts/portal_users/:contact_id
        def create
          portal_type = params[:portal_type] || "supplier"
          email = params[:email]
          password = params[:password]

          if email.blank? || password.blank?
            return render json: {
              success: false,
              error: "Email and password are required"
            }, status: :unprocessable_entity
          end

          begin
            @contact.enable_portal!(portal_type, email: email, password: password)

            render json: {
              success: true,
              portal_user: @contact.portal_user.as_json(only: [:id, :email, :portal_type, :active, :created_at]),
              message: "Portal access enabled successfully. Password has been set."
            }
          rescue => e
            render json: {
              success: false,
              error: e.message
            }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/contacts/portal_users/:contact_id
        def update
          portal_user = @contact.portal_user

          unless portal_user
            return render json: {
              success: false,
              error: "No portal user exists for this contact"
            }, status: :not_found
          end

          update_params = {}
          update_params[:email] = params[:email] if params[:email].present?
          update_params[:password] = params[:password] if params[:password].present?
          update_params[:portal_type] = params[:portal_type] if params[:portal_type].present?
          update_params[:active] = params[:active] unless params[:active].nil?

          if portal_user.update(update_params)
            response_data = {
              success: true,
              portal_user: portal_user.as_json(only: [:id, :email, :portal_type, :active, :created_at])
            }
            if params[:password].present?
              response_data[:message] = "Portal user updated successfully. Password has been changed."
            end
            render json: response_data
          else
            render json: {
              success: false,
              errors: portal_user.errors.full_messages
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/contacts/portal_users/:contact_id
        def destroy
          portal_user = @contact.portal_user

          unless portal_user
            return render json: {
              success: false,
              error: "No portal user exists for this contact"
            }, status: :not_found
          end

          portal_user.destroy
          @contact.update(portal_enabled: false)

          render json: {
            success: true,
            message: "Portal user deleted successfully"
          }
        end

        private

        def set_contact
          @contact = Contact.find(params[:contact_id])
        rescue ActiveRecord::RecordNotFound
          render json: {
            success: false,
            error: "Contact not found"
          }, status: :not_found
        end
      end
    end
  end
end
