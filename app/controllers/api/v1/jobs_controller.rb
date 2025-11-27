module Api
  module V1
    class JobsController < ApplicationController
      before_action :set_job, only: [:show, :update, :destroy, :saved_messages, :emails, :documentation_tabs, :import_xero_bills, :link_xero_tracking, :xero_tracking_options]

      # GET /api/v1/jobs
      # GET /api/v1/jobs?status=Active
      # GET /api/v1/jobs?contact_id=123
      def index
        @jobs = Job.includes(:job_type, :job_status, :job_stage).all

        # Filter by contact_id if provided - only return jobs where this contact is a client
        # (not representative, broker, etc. - only actual client role)
        if params[:contact_id].present?
          @jobs = @jobs.joins(:job_contacts)
                       .where(job_contacts: { contact_id: params[:contact_id], role: 'client' })
                       .distinct
        end

        # Filter by status if provided (default to Active jobs, unless filtering by contact)
        status_filter = params[:status]
        status_filter ||= "Active" unless params[:contact_id].present?
        @jobs = @jobs.where(status: status_filter) if status_filter.present?

        # Pagination
        page = params[:page]&.to_i || 1
        per_page = params[:per_page]&.to_i || 50

        # Get total count before limiting results to avoid separate COUNT query
        total_count = @jobs.count
        total_pages = (total_count.to_f / per_page).ceil

        @jobs = @jobs.order(created_at: :desc)
                                       .limit(per_page)
                                       .offset((page - 1) * per_page)

        # Include job_type and job_status in response
        jobs_with_associations = @jobs.map do |job|
          job.as_json.merge(
            job_type: job.job_type&.as_json(only: [:id, :name, :icon]),
            job_status: job.job_status&.as_json(only: [:id, :name, :color])
          )
        end

        render json: {
          jobs: jobs_with_associations,
          pagination: {
            current_page: page,
            total_pages: total_pages,
            total_count: total_count,
            per_page: per_page
          }
        }
      end

      # GET /api/v1/jobs/:id
      def show
        # Include contacts with their relationships in the response
        job_json = @job.as_json
        job_json[:contacts] = @job.job_contacts
                                                     .includes(contact: :outgoing_relationships)
                                                     .where.not(contact_id: nil)
                                                     .order(primary: :desc, created_at: :asc)
                                                     .map do |cc|
          next unless cc.contact # Skip if contact was deleted

          {
            id: cc.id,
            contact_id: cc.contact_id,
            primary: cc.primary,
            role: cc.role,
            contact: cc.contact.as_json(
              only: [:id, :first_name, :last_name, :full_name, :company_name, :email, :mobile_phone, :office_phone]
            ),
            relationships_count: cc.contact.outgoing_relationships.count
          }
        end.compact

        render json: job_json
      end

      # POST /api/v1/jobs
      def create
        @job = Job.new(job_params)

        if @job.save
          # Enqueue OneDrive folder creation if requested
          folder_creation_enqueued = false
          if params[:create_onedrive_folders] == true || params[:create_onedrive_folders] == "true"
            @job.create_folders_if_needed!(params[:template_id])
            folder_creation_enqueued = true
          end

          # Instantiate schedule template if provided
          template_instantiation_result = nil
          if params[:template_id].present?
            template_instantiation_result = instantiate_schedule_template(params[:template_id])
          end

          response_data = @job.as_json.merge(
            folder_creation_enqueued: folder_creation_enqueued
          )

          # Add template instantiation info if applicable
          if template_instantiation_result
            response_data[:template_instantiation] = template_instantiation_result
          end

          render json: response_data, status: :created
        else
          render json: { errors: @job.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PUT/PATCH /api/v1/jobs/:id
      def update
        if @job.update(job_params)
          render json: @job
        else
          render json: { errors: @job.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/jobs/:id
      def destroy
        @job.destroy
        head :no_content
      end

      # GET /api/v1/jobs/:id/saved_messages
      def saved_messages
        @messages = @job.chat_messages
                                  .where(saved_to_job: true)
                                  .includes(:user)
                                  .order(created_at: :desc)

        render json: @messages.as_json(
          include: { user: { only: [:id, :name, :email] } },
          methods: :formatted_timestamp
        )
      end

      # GET /api/v1/jobs/:id/emails
      def emails
        @emails = @job.emails
                              .includes(:user)
                              .order(received_at: :desc)

        render json: @emails
      end

      # GET /api/v1/jobs/:id/documentation_tabs
      def documentation_tabs
        @tabs = @job.job_documentation_tabs
                            .active
                            .ordered

        render json: @tabs
      end

      # POST /api/v1/jobs/:id/import_xero_bills
      # Import bills from Xero that are tracked to this job
      def import_xero_bills
        service = XeroBillImportService.new(@job)
        result = service.import_bills

        render json: result
      rescue XeroBillImportService::NotConnectedError => e
        render json: { success: false, error: e.message }, status: :service_unavailable
      rescue XeroBillImportService::NoTrackingOptionError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue StandardError => e
        Rails.logger.error("Xero bill import error: #{e.message}")
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/jobs/:id/link_xero_tracking
      # Link this job to a Xero tracking option
      def link_xero_tracking
        tracking_option_id = params[:tracking_option_id]
        tracking_option_name = params[:tracking_option_name]

        unless tracking_option_id.present?
          return render json: { success: false, error: 'tracking_option_id is required' }, status: :bad_request
        end

        if @job.update(
          xero_tracking_option_id: tracking_option_id,
          xero_tracking_option_name: tracking_option_name
        )
          render json: {
            success: true,
            job: @job.as_json(only: [:id, :title, :xero_tracking_option_id, :xero_tracking_option_name])
          }
        else
          render json: { success: false, errors: @job.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/jobs/:id/xero_tracking_options
      # Get available Xero tracking options and suggest a match for this job
      def xero_tracking_options
        tracking_options = XeroBillImportService.fetch_tracking_options

        # Find suggested match based on job title/location
        suggested_match = XeroBillImportService.match_job_to_tracking_option(@job, tracking_options)

        render json: {
          success: true,
          tracking_options: tracking_options.map { |o| { id: o['TrackingOptionID'], name: o['Name'] } },
          current_option: @job.xero_tracking_option_id.present? ? {
            id: @job.xero_tracking_option_id,
            name: @job.xero_tracking_option_name
          } : nil,
          suggested_match: suggested_match ? {
            id: suggested_match['TrackingOptionID'],
            name: suggested_match['Name']
          } : nil
        }
      rescue StandardError => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      private

      def set_job
        @job = Job.find(params[:id])
      end

      def job_params
        params.require(:job).permit(
          :title,
          :contract_value,
          # live_profit and profit_percentage are calculated fields, not user-editable
          :stage,
          :status,
          :ted_number,
          :certifier_job_no,
          :start_date,
          :location,
          :latitude,
          :longitude,
          :site_supervisor_name,
          :site_supervisor_email,
          :site_supervisor_phone,
          :design_id,
          :design_name,
          :job_type_id,
          :job_status_id,
          :job_stage_id
        )
      end

      def instantiate_schedule_template(template_id)
        # Find the template
        template = ScheduleTemplate.find_by(id: template_id)
        unless template
          Rails.logger.warn("Template #{template_id} not found for job #{@job.id}")
          return { success: false, error: "Template not found" }
        end

        # Get or create the project for this job
        # The project is needed for the template instantiation service
        project = @job.project
        unless project
          # Create a project using the job's helper method
          project = @job.create_project!(
            project_manager: current_user,
            name: "#{@job.title} - Master Schedule"
          )
        end

        # Instantiate the template using the service
        result = Schedule::TemplateInstantiator.new(
          project: project,
          template: template
        ).call

        if result[:success]
          Rails.logger.info("Successfully instantiated template #{template.name} for job #{@job.id}")
          {
            success: true,
            template_name: template.name,
            tasks_created: result[:tasks].count,
            project_id: project.id
          }
        else
          Rails.logger.error("Failed to instantiate template: #{result[:errors].join(', ')}")
          {
            success: false,
            errors: result[:errors]
          }
        end
      rescue StandardError => e
        Rails.logger.error("Exception instantiating template: #{e.message}")
        Rails.logger.error(e.backtrace.join("\n"))
        {
          success: false,
          error: e.message
        }
      end
    end
  end
end
