module Api
  module V1
    class JobsController < ApplicationController
      before_action :set_job, only: [ :show, :update, :destroy, :saved_messages, :emails, :sms_messages, :documentation_tabs, :import_xero_bills, :link_xero_tracking, :xero_tracking_options, :activities, :budget_tracking, :merge, :update_stage, :mark_lost, :upload_plan_set, :plan_set, :rename_plans ]

      # GET /api/v1/jobs/pipeline
      # Returns jobs with Enquiry status grouped by stage for the pipeline view
      def pipeline
        enquiry_status = JobStatus.find_by(name: "Enquiry")

        # Get all enquiry stages
        enquiry_stages = JobStage.where(job_status_id: enquiry_status&.id).order(:position)

        # Get all jobs with Enquiry status
        # SSoT: Use Job.with_contacts scope for standard includes
        jobs = Job.with_contacts
                  .where(job_status_id: enquiry_status&.id)
                  .order(created_at: :desc)

        # Group jobs by stage
        jobs_by_stage = {}
        enquiry_stages.each do |stage|
          stage_jobs = jobs.select { |j| j.job_stage_id == stage.id }
          jobs_by_stage[stage.name.downcase.gsub(" ", "_")] = stage_jobs.map { |job| pipeline_job_to_json(job) }
        end

        # Add jobs without a stage to "needs_pricing" (first stage)
        no_stage_jobs = jobs.select { |j| j.job_stage_id.nil? }
        jobs_by_stage["needs_pricing"] ||= []
        jobs_by_stage["needs_pricing"] = no_stage_jobs.map { |job| pipeline_job_to_json(job) } + jobs_by_stage["needs_pricing"]

        # Initialize won array as empty (won jobs move to Pre Contract status)
        jobs_by_stage["won"] = []
        # Ensure lost array exists (should be populated from enquiry_stages if Lost stage exists)
        jobs_by_stage["lost"] ||= []

        # For stats, we can still count won/lost from other statuses
        won_statuses = JobStatus.where(name: [ "Pre Contract", "Contract", "Pre Start", "Active Job", "Handover", "Archived" ])
        won_jobs = Job.where(job_status_id: won_statuses.pluck(:id))
                      .where("created_at > ?", 30.days.ago)

        lost_statuses = JobStatus.where("name LIKE ?", "%Lost%")
        lost_jobs = Job.where(job_status_id: lost_statuses.pluck(:id))
                       .where("created_at > ?", 30.days.ago)

        # Calculate stats
        total_pipeline_value = jobs.sum { |j| j.contract_value || 0 }
        won_value = won_jobs.sum(:contract_value) || 0

        render json: {
          success: true,
          jobs_by_stage: jobs_by_stage,
          stages: enquiry_stages.map { |s| { id: s.id, name: s.name, position: s.position } },
          meta: {
            total_count: jobs.count,
            total_pipeline_value: total_pipeline_value,
            won_count: won_jobs.count,
            won_value: won_value,
            lost_count: lost_jobs.count
          }
        }
      end

      # PATCH /api/v1/jobs/:id/stage
      # Update job stage (for drag-and-drop in pipeline)
      def update_stage
        stage_name = params[:stage]

        if stage_name == "won"
          # Move to Pre Contract status
          pre_contract = JobStatus.find_by(name: "Pre Contract")
          if @job.update(job_status_id: pre_contract&.id, job_stage_id: nil)
            render json: { success: true, job: pipeline_job_to_json(@job) }
          else
            render json: { success: false, errors: @job.errors.full_messages }, status: :unprocessable_entity
          end
        else
          # Find the stage by name
          enquiry_status = JobStatus.find_by(name: "Enquiry")
          stage = JobStage.find_by(job_status_id: enquiry_status&.id, name: stage_name.titleize.gsub("_", " "))

          unless stage
            return render json: { success: false, error: "Invalid stage: #{stage_name}" }, status: :unprocessable_entity
          end

          # Ensure job is in Enquiry status
          @job.job_status_id = enquiry_status.id unless @job.job_status_id == enquiry_status&.id

          if @job.update(job_stage_id: stage.id)
            render json: { success: true, job: pipeline_job_to_json(@job) }
          else
            render json: { success: false, errors: @job.errors.full_messages }, status: :unprocessable_entity
          end
        end
      end

      # PATCH /api/v1/jobs/:id/mark_lost
      # Mark job as lost (changes status to "Lost - Pre Contract")
      def mark_lost
        lost_status = JobStatus.find_by(name: "Lost - Pre Contract")

        unless lost_status
          return render json: { success: false, error: "Lost - Pre Contract status not found" }, status: :unprocessable_entity
        end

        if @job.update(job_status_id: lost_status.id, job_stage_id: nil)
          render json: { success: true, job: pipeline_job_to_json(@job) }
        else
          render json: { success: false, errors: @job.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/jobs
      # GET /api/v1/jobs?status=Active
      # GET /api/v1/jobs?contact_id=123
      def index
        # SSoT: Use Job.with_lookups scope for standard includes
        @jobs = Job.with_lookups

        # Filter by contact_id if provided - only return jobs where this contact is a client
        # (not representative, broker, etc. - only actual client role)
        if params[:contact_id].present?
          @jobs = @jobs.joins(:job_contacts)
                       .where(job_contacts: { contact_id: params[:contact_id], role: "client" })
                       .distinct
        end

        # Filter by job_status.name if provided
        # Note: No default filter - frontend-next handles filtering via saved views
        if params[:status].present?
          @jobs = @jobs.joins(:job_status).where(job_status: { name: params[:status] })
        end

        # Filter by location presence if requested
        if params[:has_location] == "true"
          @jobs = @jobs.where.not(latitude: nil).where.not(longitude: nil)
        end

        # Search functionality
        if params[:search].present?
          search_term = "%#{params[:search].downcase}%"
          if params[:search_all].to_s == "true"
            # Search across multiple columns
            @jobs = @jobs.where(
              "LOWER(jobs.name) LIKE ? OR LOWER(jobs.address) LIKE ? OR CAST(jobs.id AS TEXT) LIKE ?",
              search_term, search_term, search_term
            )
          else
            # Default: search name only
            @jobs = @jobs.where("LOWER(jobs.name) LIKE ?", search_term)
          end
        end

        # Pagination
        page = params[:page]&.to_i || 1
        per_page = params[:per_page]&.to_i || 500

        # Get total count before limiting results
        total_count = @jobs.count
        total_pages = (total_count.to_f / per_page).ceil

        # Return all columns - no column limiting
        @jobs = @jobs.order(created_at: :desc)
                     .limit(per_page)
                     .offset((page - 1) * per_page)

        render json: {
          jobs: @jobs.as_json(
            include: {
              job_type: {},
              job_status: {},
              job_stage: {}
            }
          ),
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

        # Include job_type, job_status, and job_stage associations - all columns
        job_json[:job_type] = @job.job_type&.as_json
        job_json[:job_status] = @job.job_status&.as_json
        job_json[:job_stage] = @job.job_stage&.as_json

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
            contact: cc.contact.as_json,
            relationships_count: cc.contact.outgoing_relationships.count
          }
        end.compact

        # Include estimator analysis from proposal if available
        if @job.email_job_proposal&.extracted_data.present?
          extracted = @job.email_job_proposal.extracted_data
          # Only include if the estimator fields are present
          if extracted["job_summary"].present? || extracted["key_points"].present?
            job_json[:estimator_analysis] = {
              job_summary: extracted["job_summary"],
              key_points: extracted["key_points"],
              estimated_scope: extracted["estimated_scope"],
              recommendations: extracted["recommendations"],
              source: "pdf_extraction",
              extracted_at: @job.email_job_proposal.created_at
            }
          end
        end

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
          include: { user: {} },
          methods: :formatted_timestamp
        )
      end

      # GET /api/v1/jobs/:id/emails
      def emails
        @emails = @job.emails
                              .includes(:user)
                              .order(received_at: :desc)

        render json: { emails: @emails }
      end

      # GET /api/v1/jobs/:id/sms_messages
      # Returns SMS messages for all contacts associated with this job
      def sms_messages
        contact_ids = @job.job_contacts.pluck(:contact_id)

        if contact_ids.empty?
          render json: { sms_messages: [] }
          return
        end

        messages = SmsMessage
          .where(contact_id: contact_ids)
          .includes(:contact, :user)
          .order(created_at: :desc)
          .limit(100)

        render json: {
          sms_messages: messages.as_json(
            include: {
              contact: {},
              user: {}
            }
          )
        }
      end

      # GET /api/v1/jobs/:id/documentation_tabs
      def documentation_tabs
        # Return hierarchical tabs - only root tabs, each with their children
        @tabs = @job.job_documentation_tabs
                            .root_tabs
                            .active
                            .ordered
                            .includes(:children)

        render json: @tabs.map(&:as_nested_json)
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
          return render json: { success: false, error: "tracking_option_id is required" }, status: :bad_request
        end

        if @job.update(
          xero_tracking_option_id: tracking_option_id,
          xero_tracking_option_name: tracking_option_name
        )
          render json: {
            success: true,
            job: @job.as_json
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
          tracking_options: tracking_options.map { |o| { id: o["TrackingOptionID"], name: o["Name"] } },
          current_option: @job.xero_tracking_option_id.present? ? {
            id: @job.xero_tracking_option_id,
            name: @job.xero_tracking_option_name
          } : nil,
          suggested_match: suggested_match ? {
            id: suggested_match["TrackingOptionID"],
            name: suggested_match["Name"]
          } : nil
        }
      rescue StandardError => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # GET /api/v1/jobs/:id/activities
      # Get activity timeline for a job
      def activities
        activities = @job.job_activities
                         .includes(:user)
                         .recent

        # Filter by type if specified
        activities = activities.by_type(params[:type]) if params[:type].present?

        # Filter by date range
        activities = activities.since(params[:since].to_date) if params[:since].present?

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i.clamp(1, 100)
        total_count = activities.count

        activities = activities.offset((page - 1) * per_page).limit(per_page)

        render json: {
          success: true,
          activities: activities.map { |a| serialize_activity(a) },
          meta: {
            total_count: total_count,
            page: page,
            per_page: per_page,
            total_pages: (total_count.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/jobs/:id/budget_tracking
      # Returns budget vs invoiced summary for purchase orders
      def budget_tracking
        purchase_orders = @job.purchase_orders
                              .where.not(status: "cancelled")
                              .includes(:supplier)

        budget_items = purchase_orders.map do |po|
          budgeted = po.total || 0
          invoiced = po.invoiced_amount || 0
          variance = invoiced - budgeted

          {
            id: po.id,
            po_number: po.purchase_order_number,
            supplier_name: po.supplier&.display_name || po.supplier&.company_name || "Unknown Supplier",
            item_description: po.description || po.line_items.first&.description || "No description",
            budgeted: budgeted.to_f.round(2),
            invoiced: invoiced.to_f.round(2),
            variance: variance.to_f.round(2),
            payment_status: po.payment_status || "pending"
          }
        end

        total_budgeted = budget_items.sum { |i| i[:budgeted] }
        total_invoiced = budget_items.sum { |i| i[:invoiced] }
        total_variance = total_invoiced - total_budgeted
        variance_percentage = total_budgeted > 0 ? (total_variance / total_budgeted * 100) : 0

        render json: {
          budget_items: budget_items,
          totals: {
            budgeted: total_budgeted.round(2),
            invoiced: total_invoiced.round(2),
            variance: total_variance.round(2),
            variance_percentage: variance_percentage.round(2)
          }
        }
      end

      # POST /api/v1/jobs/:id/merge
      # Merges secondary jobs into the primary job (this job)
      # Transfers all related records and then deletes the secondary jobs
      def merge
        secondary_job_ids = params[:secondary_job_ids]

        if secondary_job_ids.blank?
          render json: { success: false, error: "No secondary jobs provided" }, status: :unprocessable_entity
          return
        end

        secondary_jobs = Job.where(id: secondary_job_ids)

        if secondary_jobs.count != secondary_job_ids.length
          render json: { success: false, error: "Some secondary jobs not found" }, status: :not_found
          return
        end

        merged_count = 0

        ActiveRecord::Base.transaction do
          secondary_jobs.each do |secondary_job|
            # Transfer all related records to the primary job
            # Job Contacts
            secondary_job.job_contacts.update_all(job_id: @job.id)

            # Purchase Orders
            secondary_job.purchase_orders.update_all(job_id: @job.id) if secondary_job.respond_to?(:purchase_orders)

            # Quotes
            secondary_job.quotes.update_all(job_id: @job.id) if secondary_job.respond_to?(:quotes)

            # Tasks
            secondary_job.tasks.update_all(job_id: @job.id) if secondary_job.respond_to?(:tasks)

            # Chat Messages
            secondary_job.chat_messages.update_all(job_id: @job.id) if secondary_job.respond_to?(:chat_messages)

            # Emails
            secondary_job.emails.update_all(job_id: @job.id) if secondary_job.respond_to?(:emails)

            # Documents
            secondary_job.documents.update_all(job_id: @job.id) if secondary_job.respond_to?(:documents)

            # Notes
            secondary_job.notes.update_all(job_id: @job.id) if secondary_job.respond_to?(:notes)

            # Attachments
            secondary_job.attachments.update_all(attachable_id: @job.id) if secondary_job.respond_to?(:attachments)

            # Job Documentation Tabs
            secondary_job.job_documentation_tabs.update_all(job_id: @job.id) if secondary_job.respond_to?(:job_documentation_tabs)

            # Fill in any blank fields on primary job from secondary job
            Job.column_names.each do |col|
              next if %w[id created_at updated_at].include?(col)
              if @job.send(col).blank? && secondary_job.send(col).present?
                @job.send("#{col}=", secondary_job.send(col))
              end
            end

            # Delete the secondary job
            secondary_job.destroy!
            merged_count += 1
          end

          @job.save!
        end

        render json: {
          success: true,
          message: "Successfully merged #{merged_count} job(s) into #{@job.title || "Job ##{@job.id}"}",
          primary_job: @job
        }
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue => e
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/jobs/:id/upload_plan_set
      # Upload a PDF plan set, split into individual pages named by PDF page labels
      def upload_plan_set
        unless params[:file].present?
          return render json: { success: false, error: "No file provided" }, status: :unprocessable_entity
        end

        service = PlanSetService.new(@job, params[:file])
        result = service.process!

        if result[:success]
          render json: {
            success: true,
            data: {
              all_plans: result[:all_plans],
              pages: result[:pages],
              total_pages: result[:total_pages]
            }
          }
        else
          render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/jobs/:id/plan_set
      # Get the list of plans in the 04 Plans folder
      def plan_set
        credential = OrganizationSharePointCredential.active_credential
        unless credential
          return render json: { success: false, error: "OneDrive not connected" }, status: :unprocessable_entity
        end

        client = MicrosoftGraphClient.new(credential)

        # Find the job folder
        job_folder = client.find_job_folder(@job)
        unless job_folder
          return render json: { success: true, data: { plans: [], folder_exists: false } }
        end

        # Find 04 Plans folder - list_folder_items returns { "value" => [...] } with string keys
        response = client.list_folder_items(job_folder["id"])
        items = response["value"] || []
        plans_folder = items.find { |item| item["name"] == "04 Plans" && item["folder"].present? }

        unless plans_folder
          return render json: { success: true, data: { plans: [], folder_exists: false } }
        end

        # List files in 04 Plans
        plan_response = client.list_folder_items(plans_folder["id"])
        plan_files = plan_response["value"] || []
        pdf_files = plan_files.select { |f| f["file"].present? && f["name"]&.end_with?(".pdf") }

        plans = pdf_files.map do |f|
          {
            id: f["id"],
            name: f["name"],
            web_url: f["webUrl"],
            size: f["size"],
            modified: f["lastModifiedDateTime"],
            is_all_plans: f["name"] == "All Plans.pdf"
          }
        end

        # Sort: All Plans first, then alphabetically
        plans.sort_by! { |p| [ p[:is_all_plans] ? 0 : 1, p[:name] ] }

        render json: {
          success: true,
          data: {
            plans: plans,
            folder_exists: true,
            folder_id: plans_folder["id"],
            folder_web_url: plans_folder["webUrl"]
          }
        }
      rescue => e
        Rails.logger.error("plan_set error: #{e.message}")
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/jobs/:id/rename_plans
      # Use AI to rename existing plans in 04 Plans folder
      def rename_plans
        result = PlanSetService.new(@job, nil).rename_existing_plans!

        if result[:success]
          render json: {
            success: true,
            data: {
              renamed: result[:renamed],
              skipped: result[:skipped],
              errors: result[:errors]
            }
          }
        else
          render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        end
      rescue => e
        Rails.logger.error("rename_plans error: #{e.message}")
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      private

      def set_job
        # Support lookup by ID or slug (title-based)
        id_or_slug = params[:id]

        if id_or_slug.to_s.match?(/\A\d+\z/)
          # Numeric ID - direct lookup
          @job = Job.find(id_or_slug)
        else
          # Slug - search by name (convert slug back to search term)
          # Remove the _God_Loves_You_ suffix if present
          slug = id_or_slug.to_s.gsub(/_God_Loves_You_$/i, "")
          search_term = slug.gsub("-", " ")
          @job = Job.where("LOWER(name) LIKE ?", "%#{search_term.downcase}%").first
          raise ActiveRecord::RecordNotFound, "Job not found with slug: #{id_or_slug}" unless @job
        end
      end

      def job_params
        params.require(:job).permit(
          :name,
          :title, # Keep for backward compatibility during transition
          :lot_number,
          :street_number,
          :street_name,
          :street_type,
          :suburb,
          :postcode,
          :state,
          :council,
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
          :job_stage_id,
          # Contract fields
          :plan_number,
          :contract_price,
          :deposit,
          :prime_cost,
          :provisional_sums,
          :contract_date,
          # Build schedule
          :build_period,
          :construction_days,
          :stage_slab,
          :stage_frame,
          :stage_enclosed,
          :stage_fixing,
          :stage_practical,
          :stage_weather,
          :weekend_work,
          # Contract terms (Items 13 & 14)
          :liquidated_damages,
          :certification_by_owner,
          # Item 12: Finance Approval
          :finance_approval_required,
          :finance_approval_date,
          # Item 15: Prime Cost/Provisional Sums details and Special Conditions
          :prime_cost_details,
          :provisional_sums_details,
          :has_special_conditions,
          :special_conditions,
          # Important dates
          :plan_date,
          :spec_date,
          :practical_completion_date,
          :warranty_end_date
        )
      end

      def serialize_activity(activity)
        {
          id: activity.id,
          activity_type: activity.activity_type,
          formatted_type: activity.formatted_activity_type,
          description: activity.description,
          occurred_at: activity.occurred_at.iso8601,
          time_ago: activity.time_ago,
          performed_by: activity.performed_by_name,
          user_id: activity.user_id,
          icon: activity.icon_name,
          icon_color: activity.icon_color,
          related_type: activity.related_type,
          related_id: activity.related_id,
          related_url: activity.related_url,
          metadata: activity.metadata
        }
      end

      # Serialize job for pipeline view (lightweight version)
      def pipeline_job_to_json(job)
        # Get primary client contact
        client_contact = job.job_contacts.find { |jc| jc.role == "client" }&.contact

        {
          id: job.id,
          title: job.title,
          location: job.location,
          contract_value: job.contract_value || 0,
          job_type: job.job_type&.name,
          job_status: job.job_status&.name,
          job_stage: job.job_stage&.name,
          job_stage_id: job.job_stage_id,
          client_name: client_contact&.display_name,
          client_email: client_contact&.email,
          client_company: client_contact&.company_name_or_trust,
          created_at: job.created_at,
          updated_at: job.updated_at
        }
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
