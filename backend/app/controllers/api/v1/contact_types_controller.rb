# frozen_string_literal: true

module Api
  module V1
    class ContactTypesController < ApplicationController
      before_action :set_contact_type, only: [ :show, :update, :destroy ]

      # GET /api/v1/contact_types
      # Returns all contact types (active and inactive) for admin management
      def index
        # If ?for_select=true, return simplified format for dropdowns
        if params[:for_select] == "true"
          render json: ContactType.for_select
        else
          contact_types = ContactType.ordered
          render json: contact_types.map { |ct| contact_type_json(ct) }
        end
      end

      # GET /api/v1/contact_types/:id
      def show
        render json: contact_type_json(@contact_type)
      end

      # POST /api/v1/contact_types
      def create
        @contact_type = ContactType.new(contact_type_params)
        @contact_type.position ||= (ContactType.maximum(:position) || 0) + 1

        if @contact_type.save
          render json: contact_type_json(@contact_type), status: :created
        else
          render json: { errors: @contact_type.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/contact_types/:id
      def update
        if @contact_type.update(contact_type_params)
          render json: contact_type_json(@contact_type)
        else
          render json: { errors: @contact_type.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/contact_types/:id
      def destroy
        # Check if any contacts are using this type
        # contact_types in contacts is stored as JSON array of IDs like [1, 2]
        usage_count = Contact.where("contact_types::text LIKE ?", "%#{@contact_type.id}%").count

        if usage_count > 0
          render json: {
            error: "Cannot delete: #{usage_count} contacts are using this type",
            usage_count: usage_count
          }, status: :conflict
        else
          @contact_type.destroy
          render json: { success: true }
        end
      end

      # POST /api/v1/contact_types/reorder
      def reorder
        params[:order].each_with_index do |id, index|
          ContactType.where(id: id).update_all(position: index + 1)
        end
        render json: { success: true }
      end

      private

      def set_contact_type
        @contact_type = ContactType.find(params[:id])
      end

      def contact_type_params
        params.require(:contact_type).permit(:name, :display_name, :tab_label, :description, :active, :position)
      end

      def contact_type_json(ct)
        {
          id: ct.id,
          name: ct.name,
          display_name: ct.display_name,
          tab_label: ct.tab_label,
          description: ct.description,
          active: ct.active,
          position: ct.position,
          created_at: ct.created_at,
          updated_at: ct.updated_at
        }
      end
    end
  end
end
