module Api
  module V1
    class ContactGroupsController < ApplicationController
      before_action :set_contact

      # GET /api/v1/contacts/:contact_id/contact_groups
      def index
        @contact_groups = @contact.contact_groups.order(:name)

        render json: {
          success: true,
          contact_groups: @contact_groups.as_json
        }
      end

      private

      def set_contact
        @contact = Contact.find(params[:contact_id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
      end
    end
  end
end
