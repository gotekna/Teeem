module Api
  module V1
    class JobContactsController < ApplicationController
      before_action :set_job
      before_action :set_job_contact, only: [ :update, :destroy ]

      # GET /api/v1/jobs/:job_id/job_contacts
      def index
        @job_contacts = @job.job_contacts
                            .includes(contact: :outgoing_relationships)
                            .includes(:user)
                            .order(primary: :desc, created_at: :asc)

        contacts_data = @job_contacts.map do |cc|
          build_job_contact_response(cc)
        end

        render json: { job_contacts: contacts_data }
      end

      # POST /api/v1/jobs/:job_id/job_contacts
      def create
        @job_contact = @job.job_contacts.build(job_contact_params)

        # If this is marked as primary, unmark all other primary contacts first
        if @job_contact.primary
          @job.job_contacts.update_all(primary: false)
        end

        if @job_contact.save
          render json: build_job_contact_response(@job_contact), status: :created
        else
          render json: { errors: @job_contact.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/jobs/:job_id/job_contacts/:id
      def update
        # If changing to primary, unmark all other primary contacts first
        if job_contact_params[:primary] == true || job_contact_params[:primary] == "true"
          @job.job_contacts.where.not(id: @job_contact.id).update_all(primary: false)
        end

        if @job_contact.update(job_contact_params)
          render json: build_job_contact_response(@job_contact)
        else
          render json: { errors: @job_contact.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/jobs/:job_id/job_contacts/:id
      def destroy
        # Prevent deleting the last client contact (internal team can be removed)
        client_contacts = @job.job_contacts.where.not(role: JobContact::INTERNAL_ROLES)
        if !@job_contact.internal_team? && client_contacts.count <= 1
          render json: { error: "Cannot remove the last client contact from a job. At least one client is required." }, status: :unprocessable_entity
          return
        end

        # If deleting the primary contact, make the next contact primary
        if @job_contact.primary
          next_contact = @job.job_contacts.where.not(id: @job_contact.id).where.not(role: JobContact::INTERNAL_ROLES).first
          next_contact&.update(primary: true)
        end

        @job_contact.destroy
        head :no_content
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_job_contact
        @job_contact = @job.job_contacts.find(params[:id])
      end

      def job_contact_params
        params.require(:job_contact).permit(:contact_id, :user_id, :primary, :role)
      end

      def build_job_contact_response(job_contact)
        response = {
          id: job_contact.id,
          contact_id: job_contact.contact_id,
          user_id: job_contact.user_id,
          primary: job_contact.primary,
          role: job_contact.role
        }

        if job_contact.user.present?
          response[:user] = job_contact.user.as_json
          response[:relationships_count] = 0
          response[:relationships] = []
        elsif job_contact.contact.present?
          response[:contact] = job_contact.contact.as_json
          # Add company_name alias for frontend compatibility
          response[:contact][:company_name] = job_contact.contact.company_name_or_trust

          # Include relationship details
          relationships = job_contact.contact.outgoing_relationships.includes(:related_contact)
          response[:relationships_count] = relationships.count
          response[:relationships] = relationships.map do |rel|
            {
              id: rel.id,
              relationship_type: rel.relationship_type,
              related_contact: {
                id: rel.related_contact.id,
                display_name: rel.related_contact.display_name,
                company_name: rel.related_contact.company_name_or_trust,
                email: rel.related_contact.email,
                mobile_phone: rel.related_contact.mobile_phone
              }
            }
          end
        end

        response
      end
    end
  end
end
