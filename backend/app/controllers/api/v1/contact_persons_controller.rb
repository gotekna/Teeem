module Api
  module V1
    class ContactPersonsController < ApplicationController
      before_action :set_contact
      before_action :set_contact_person, only: [ :update, :destroy ]

      # GET /api/v1/contacts/:contact_id/contact_persons
      def index
        @contact_persons = @contact.contact_persons.order(is_primary: :desc, created_at: :asc)

        render json: {
          success: true,
          contact_persons: @contact_persons.as_json
        }
      end

      # POST /api/v1/contacts/:contact_id/contact_persons
      def create
        @contact_person = @contact.contact_persons.new(contact_person_params)

        if @contact_person.save
          render json: {
            success: true,
            contact_person: @contact_person.as_json
          }, status: :created
        else
          render json: {
            success: false,
            error: @contact_person.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/contacts/:contact_id/contact_persons/:id
      def update
        if @contact_person.update(contact_person_params)
          render json: {
            success: true,
            contact_person: @contact_person.as_json
          }
        else
          render json: {
            success: false,
            error: @contact_person.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/contacts/:contact_id/contact_persons/:id
      def destroy
        @contact_person.destroy
        render json: { success: true }
      end

      private

      def set_contact
        @contact = Contact.find(params[:contact_id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact not found" }, status: :not_found
      end

      def set_contact_person
        @contact_person = @contact.contact_persons.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Contact person not found" }, status: :not_found
      end

      def contact_person_params
        params.require(:contact_person).permit(
          :first_name, :last_name, :email, :mobile, :role,
          :include_in_emails, :is_primary
        )
      end
    end
  end
end
