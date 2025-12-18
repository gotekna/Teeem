module Api
  module V1
    class JobPlansController < ApplicationController
      before_action :set_job
      before_action :set_job_plan, only: [:show, :update, :destroy, :add_revision, :set_on_issue]

      # GET /api/v1/jobs/:job_id/job_plans
      def index
        @job_plans = @job.job_plans
                         .includes(:plan_type, :job_plan_tab, :current_revision, revisions: :issued_by)
                         .ordered

        render json: {
          success: true,
          data: @job_plans.map { |plan| serialize_plan(plan) }
        }
      end

      # GET /api/v1/jobs/:job_id/job_plans/on_issue
      def on_issue
        @job_plans = @job.job_plans
                         .joins(:current_revision)
                         .where(job_plan_revisions: { is_on_issue: true })
                         .includes(:plan_type, :job_plan_tab, :current_revision)
                         .ordered

        render json: {
          success: true,
          data: @job_plans.map { |plan| serialize_plan(plan) }
        }
      end

      # GET /api/v1/jobs/:job_id/job_plans/tabs
      def tabs
        # Ensure job has plan tabs (create if missing)
        ensure_job_has_plan_tabs

        @tabs = @job.job_plan_tabs
                    .includes(:plan_category, :children)
                    .root_tabs
                    .ordered

        render json: {
          success: true,
          data: @tabs.map { |tab| serialize_tab(tab) }
        }
      end

      # GET /api/v1/jobs/:job_id/job_plans/:id
      def show
        render json: {
          success: true,
          data: serialize_plan(@job_plan, include_revisions: true)
        }
      end

      # POST /api/v1/jobs/:job_id/job_plans
      def create
        @job_plan = @job.job_plans.build(job_plan_params)

        if @job_plan.save
          render json: {
            success: true,
            data: serialize_plan(@job_plan)
          }, status: :created
        else
          render json: {
            success: false,
            error: @job_plan.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/jobs/:job_id/job_plans/:id
      def update
        if @job_plan.update(job_plan_params)
          render json: {
            success: true,
            data: serialize_plan(@job_plan)
          }
        else
          render json: {
            success: false,
            error: @job_plan.errors.full_messages.join(', ')
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/jobs/:job_id/job_plans/:id
      def destroy
        @job_plan.destroy
        render json: { success: true }
      end

      # POST /api/v1/jobs/:job_id/job_plans/:id/add_revision
      def add_revision
        revision = @job_plan.add_revision!(revision_params)

        render json: {
          success: true,
          data: serialize_revision(revision)
        }, status: :created
      rescue => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # PUT /api/v1/jobs/:job_id/job_plans/:id/set_on_issue
      def set_on_issue
        revision = @job_plan.revisions.find(params[:revision_id])
        @job_plan.set_on_issue!(revision)

        render json: {
          success: true,
          data: serialize_plan(@job_plan.reload)
        }
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: 'Revision not found'
        }, status: :not_found
      end

      # GET /api/v1/jobs/:job_id/job_plans/suggested_recipients
      def suggested_recipients
        recipients = []

        # Add job client if has email
        if @job.client.present?
          client = @job.client
          if client.email.present?
            recipients << {
              id: client.id,
              name: client.name,
              email: client.email,
              role: 'Client',
              type: 'client'
            }
          end
        end

        # Add site supervisor if has email
        if @job.respond_to?(:site_supervisor) && @job.site_supervisor.present?
          supervisor = @job.site_supervisor
          if supervisor.respond_to?(:email) && supervisor.email.present?
            recipients << {
              id: supervisor.id,
              name: supervisor.respond_to?(:name) ? supervisor.name : supervisor.to_s,
              email: supervisor.email,
              role: 'Site Supervisor',
              type: 'supervisor'
            }
          end
        end

        # Add primary contact if different from client
        if @job.respond_to?(:primary_contact) && @job.primary_contact.present?
          contact = @job.primary_contact
          if contact.email.present? && contact.email != @job.client&.email
            recipients << {
              id: contact.id,
              name: contact.name,
              email: contact.email,
              role: 'Primary Contact',
              type: 'contact'
            }
          end
        end

        # Add contractors assigned to the job
        if @job.respond_to?(:contractors)
          @job.contractors.each do |contractor|
            if contractor.email.present?
              recipients << {
                id: contractor.id,
                name: contractor.name,
                email: contractor.email,
                role: 'Contractor',
                type: 'contractor'
              }
            end
          end
        end

        render json: {
          success: true,
          data: recipients.uniq { |r| r[:email] }
        }
      end

      # POST /api/v1/jobs/:job_id/job_plans/upload_plan_set
      # Uploads a multi-page PDF, splits into individual pages with AI detection
      def upload_plan_set
        unless params[:file].present?
          return render json: { success: false, error: 'No file provided' }, status: :unprocessable_entity
        end

        # Ensure job has plan tabs
        ensure_job_has_plan_tabs

        # Process with PlanSetService
        service = PlanSetService.new(@job, params[:file])
        result = service.process!

        unless result[:success]
          return render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        end

        # Get the first tab (or specified tab) for categorizing plans
        tab_id = params[:job_plan_tab_id] || @job.job_plan_tabs.root_tabs.ordered.first&.id

        created_plans = []

        # Create job plan for "All Plans"
        if result[:all_plans].present?
          all_plans_plan = @job.job_plans.create!(
            job_plan_tab_id: tab_id,
            plan_type_id: nil, # No specific type for All Plans
            display_name: "All Plans",
            sequence_order: 0
          )

          all_plans_plan.add_revision!(
            sharepoint_file_id: result[:all_plans][:file_id],
            sharepoint_web_url: result[:all_plans][:web_url],
            file_name: result[:all_plans][:name],
            file_size: result[:all_plans][:size],
            revision_date: Date.today
          )

          created_plans << serialize_plan(all_plans_plan)
        end

        # Create job plans for each individual page
        result[:pages].each do |page|
          # Try to match plan type by sheet name
          plan_type = find_plan_type_for_sheet(page[:sheet_name])

          plan = @job.job_plans.create!(
            job_plan_tab_id: tab_id,
            plan_type_id: plan_type&.id,
            display_name: page[:name].sub(/\.pdf$/i, ''),
            sequence_order: page[:page_number]
          )

          plan.add_revision!(
            sharepoint_file_id: page[:file_id],
            sharepoint_web_url: page[:web_url],
            file_name: page[:name],
            file_size: page[:size],
            revision_date: Date.today
          )

          created_plans << serialize_plan(plan).merge(
            detected_sheet_number: page[:sheet_number],
            detected_sheet_name: page[:sheet_name],
            detected_sheet_date: page[:sheet_date],
            detected_sheet_issue: page[:sheet_issue]
          )
        end

        render json: {
          success: true,
          data: {
            total_pages: result[:total_pages],
            plans: created_plans
          }
        }, status: :created

      rescue StandardError => e
        Rails.logger.error("upload_plan_set failed: #{e.class} - #{e.message}")
        Rails.logger.error(e.backtrace.first(10).join("\n"))
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/jobs/:job_id/job_plans/email
      def email
        plan_ids = params[:plan_ids] || []
        recipient_emails = params[:recipients] || []
        subject = params[:subject] || "Plans for #{@job.name}"
        body = params[:body] || ""

        if plan_ids.empty?
          return render json: {
            success: false,
            error: 'No plans selected'
          }, status: :unprocessable_entity
        end

        if recipient_emails.empty?
          return render json: {
            success: false,
            error: 'No recipients specified'
          }, status: :unprocessable_entity
        end

        # Get plans and their files
        plans = @job.job_plans.where(id: plan_ids).includes(:current_revision)

        # Use PlanEmailService to send
        result = PlanEmailService.new(
          plans: plans,
          recipients: recipient_emails,
          subject: subject,
          body: body,
          sender: current_user
        ).send!

        render json: {
          success: result[:success],
          message: result[:message],
          sent_to: result[:sent_to]
        }
      rescue => e
        render json: {
          success: false,
          error: e.message
        }, status: :internal_server_error
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_job_plan
        @job_plan = @job.job_plans.find(params[:id])
      end

      def job_plan_params
        params.require(:job_plan).permit(
          :job_plan_tab_id,
          :plan_type_id,
          :variant_suffix,
          :display_name
        )
      end

      def revision_params
        params.permit(
          :revision_date,
          :notes,
          :sharepoint_file_id,
          :sharepoint_web_url,
          :file_name,
          :file_size
        )
      end

      def ensure_job_has_plan_tabs
        return if @job.job_plan_tabs.exists?

        PlanCategory.create_tabs_for_job(@job)
      end

      def serialize_plan(plan, include_revisions: false)
        data = {
          id: plan.id,
          job_id: plan.job_id,
          job_plan_tab_id: plan.job_plan_tab_id,
          plan_type_id: plan.plan_type_id,
          variant_suffix: plan.variant_suffix,
          display_name: plan.computed_display_name,
          plan_type: plan.plan_type ? {
            id: plan.plan_type.id,
            code: plan.plan_type.code,
            name: plan.plan_type.name,
            category_name: plan.plan_type.plan_category&.name
          } : nil,
          current_revision: plan.current_revision ? serialize_revision(plan.current_revision) : nil,
          revision_count: plan.revisions.count,
          created_at: plan.created_at,
          updated_at: plan.updated_at
        }

        if include_revisions
          data[:revisions] = plan.revisions.ordered.map { |r| serialize_revision(r) }
        end

        data
      end

      def serialize_revision(revision)
        {
          id: revision.id,
          job_plan_id: revision.job_plan_id,
          revision: revision.revision,
          revision_label: revision.revision_label,
          revision_date: revision.revision_date,
          issued_date: revision.issued_date,
          is_on_issue: revision.is_on_issue,
          has_file: revision.has_file?,
          sharepoint_file_id: revision.sharepoint_file_id,
          sharepoint_web_url: revision.sharepoint_web_url,
          file_name: revision.file_name,
          file_size: revision.file_size,
          formatted_file_size: revision.formatted_file_size,
          notes: revision.notes,
          issued_by: revision.issued_by ? {
            id: revision.issued_by.id,
            name: revision.issued_by.name
          } : nil,
          created_at: revision.created_at
        }
      end

      def serialize_tab(tab)
        {
          id: tab.id,
          name: tab.name,
          code: tab.code,
          plan_category_id: tab.plan_category_id,
          sequence_order: tab.sequence_order,
          is_active: tab.is_active,
          plan_count: tab.all_plans.count,
          on_issue_count: tab.on_issue_count,
          children: tab.children.ordered.map { |child| serialize_tab(child) }
        }
      end

      # Try to match a sheet name to an existing plan type
      # Uses fuzzy matching on plan type names
      def find_plan_type_for_sheet(sheet_name)
        return nil if sheet_name.blank?

        normalized = sheet_name.to_s.downcase.strip

        # Try exact match first
        plan_type = PlanType.active.find_by("LOWER(name) = ?", normalized)
        return plan_type if plan_type

        # Try contains match (e.g., "Ground Floor Plan" matches "Floor Plan")
        plan_type = PlanType.active.find_by("LOWER(?) LIKE '%' || LOWER(name) || '%'", normalized)
        return plan_type if plan_type

        # Try partial match (plan type name contains sheet name)
        plan_type = PlanType.active.find_by("LOWER(name) LIKE ?", "%#{normalized}%")
        return plan_type if plan_type

        # Common mappings
        mappings = {
          'perspective' => 'PERSPECTIVE',
          'site' => 'SITE PLAN',
          'slab' => 'SLAB PLAN',
          'floor' => 'FLOOR PLAN',
          'elevation' => 'ELEVATION',
          'roof' => 'ROOF PLAN',
          'electrical' => 'ELECTRICAL',
          'plumbing' => 'PLUMBING',
          'cabinetry' => 'CABINETRY',
          'kitchen' => 'KIT CABINETRY',
          'section' => 'SECTION',
          'detail' => 'DETAILS'
        }

        mappings.each do |keyword, plan_type_name|
          if normalized.include?(keyword)
            plan_type = PlanType.active.find_by("LOWER(name) = ?", plan_type_name.downcase)
            return plan_type if plan_type
          end
        end

        nil
      end
    end
  end
end
