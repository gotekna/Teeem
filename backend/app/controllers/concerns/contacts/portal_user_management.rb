# frozen_string_literal: true

# SSoT: Portal User Management concern for ContactsController
# Extracted from contacts_controller.rb to reduce file size and improve maintainability
#
# Methods:
#   - create_portal_user: POST /api/v1/contacts/:id/portal_user
#   - update_portal_user: PATCH /api/v1/contacts/:id/portal_user
#   - delete_portal_user: DELETE /api/v1/contacts/:id/portal_user
#
module Contacts
  module PortalUserManagement
    extend ActiveSupport::Concern

    # POST /api/v1/contacts/:id/portal_user
    def create_portal_user
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

        # Note: Password should be displayed to user immediately in the UI
        # and then securely transmitted separately (e.g., via email)
        # We no longer return it in the API response for security
        render json: {
          success: true,
          portal_user: @contact.portal_user.as_json(only: [ :id, :email, :portal_type, :active, :created_at ]),
          message: "Portal access enabled successfully. Password has been set."
        }
      rescue => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end
    end

    # PATCH /api/v1/contacts/:id/portal_user
    def update_portal_user
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
          portal_user: portal_user.as_json(only: [ :id, :email, :portal_type, :active, :created_at ])
        }
        # Add message if password was changed
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

    # DELETE /api/v1/contacts/:id/portal_user
    def delete_portal_user
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
  end
end
