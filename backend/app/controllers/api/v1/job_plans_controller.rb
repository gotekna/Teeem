module Api
  module V1
    class JobPlansController < ApplicationController
      before_action :set_job
      before_action :set_job_plan, only: [:show, :update, :destroy, :add_revision, :set_on_issue, :reprocess]

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
        old_plan_type_id = @job_plan.plan_type_id

        if @job_plan.update(job_plan_params)
          # Track correction if plan_type_id was changed by user
          track_plan_type_correction(old_plan_type_id) if plan_type_changed?(old_plan_type_id)

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
      # Uploads a multi-page PDF - processing is done in background to avoid timeout
      def upload_plan_set
        unless params[:file].present?
          return render json: { success: false, error: 'No file provided' }, status: :unprocessable_entity
        end

        # Ensure job has plan tabs
        ensure_job_has_plan_tabs

        # Upload to SharePoint as staging file (accessible from worker dyno)
        # This avoids Heroku's ephemeral filesystem issue where web/worker dynos can't share files
        uploaded_file = params[:file]
        credential = OrganizationSharePointCredential.active_credential
        unless credential
          return render json: { success: false, error: 'SharePoint not connected' }, status: :unprocessable_entity
        end

        client = MicrosoftGraphClient.new(credential)

        # Upload to a staging location in SharePoint
        job_folder = client.find_job_folder(@job)
        unless job_folder
          return render json: { success: false, error: 'Job folder not found in SharePoint' }, status: :unprocessable_entity
        end

        # Create staging filename with timestamp
        staging_filename = "_staging_#{Time.now.to_i}_#{uploaded_file.original_filename}"
        staging_result = client.upload_file_content(job_folder["id"], staging_filename, uploaded_file.read)
        uploaded_file.rewind

        staging_file_id = staging_result[:id]
        Rails.logger.info "[upload_plan_set] Staged file to SharePoint: #{staging_file_id}"

        # Get the first tab (or specified tab) for categorizing plans
        tab_id = params[:job_plan_tab_id] || @job.job_plan_tabs.root_tabs.ordered.first&.id

        # Queue background job for processing with SharePoint file ID
        PlanSetUploadJob.perform_later(
          @job.id,
          staging_file_id,
          uploaded_file.original_filename,
          tab_id
        )

        render json: {
          success: true,
          data: {
            message: "Plan set upload queued for processing",
            processing: true
          }
        }, status: :accepted

      rescue StandardError => e
        Rails.logger.error("upload_plan_set failed: #{e.class} - #{e.message}")
        Rails.logger.error(e.backtrace.first(10).join("\n"))
        render json: { success: false, error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/jobs/:job_id/job_plans/fix_categories
      # Reassign plans to correct tabs based on their plan types
      def fix_categories
        ensure_job_has_plan_tabs

        fixed_plans = []

        @job.job_plans.includes(:plan_type).find_each do |plan|
          next unless plan.plan_type.present?

          # Get the plan type's category IDs
          category_ids = plan.plan_type.plan_categories.pluck(:id)
          next if category_ids.empty?

          # Find matching tab
          tab = @job.job_plan_tabs.find_by(plan_category_id: category_ids)
          next unless tab

          # Only update if different
          if plan.job_plan_tab_id != tab.id
            plan.update!(job_plan_tab_id: tab.id)
            fixed_plans << plan.display_name
          end
        end

        render json: {
          success: true,
          data: {
            fixed_count: fixed_plans.length,
            plans_fixed: fixed_plans
          }
        }
      end

      # POST /api/v1/jobs/:job_id/job_plans/rerun_ai
      # Queue AI analysis for all plans that have files
      def rerun_ai
        queued_plans = []

        @job.job_plans.includes(:current_revision).find_each do |plan|
          next unless plan.current_revision&.sharepoint_file_id.present?

          # Queue AI analysis job
          PlanAiAnalysisJob.perform_later(plan.id)
          queued_plans << plan.display_name
        end

        render json: {
          success: true,
          data: {
            queued_count: queued_plans.length,
            plans_queued: queued_plans,
            message: "#{queued_plans.length} plans queued for AI analysis"
          }
        }
      end

      # POST /api/v1/jobs/:job_id/job_plans/:id/reprocess
      # Reprocess a single plan with the AI Processing Pipeline (OCR + AI)
      def reprocess
        unless @job_plan.current_revision&.sharepoint_file_id.present?
          return render json: {
            success: false,
            error: "Plan has no file attached to reprocess"
          }, status: :unprocessable_entity
        end

        # Queue AI analysis job for this specific plan
        PlanAiAnalysisJob.perform_later(@job_plan.id)

        render json: {
          success: true,
          data: {
            message: "Plan queued for AI reprocessing",
            plan_name: @job_plan.display_name
          }
        }
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
            category_name: plan.plan_type.plan_categories.first&.name
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

      # SSoT: Plan type matching is now in PlanIdentification::PatternMatchingLayer
      # Use PlanIdentification::PlanIdentificationService.identify_from_text(sheet_name, job)

      def plan_type_changed?(old_plan_type_id)
        params[:job_plan]&.key?(:plan_type_id) &&
          @job_plan.plan_type_id != old_plan_type_id
      end

      # Track user correction to AI identification for learning
      def track_plan_type_correction(old_plan_type_id)
        # Find the most recent AI processing log for this job plan
        log = AiProcessingLog.where(
          processable_type: "JobPlan",
          processable_id: @job_plan.id
        ).order(created_at: :desc).first

        return unless log

        # Get the new plan type name for recording
        new_plan_type = @job_plan.plan_type
        new_value = new_plan_type&.name || "none"

        # Record the correction
        log.record_correction!(new_value, user: current_user)

        Rails.logger.info(
          "[PlanTypeCorrection] User #{current_user.id} corrected JobPlan #{@job_plan.id}: " \
          "#{log.final_type || 'none'} → #{new_value}"
        )
      rescue StandardError => e
        # Don't fail the update if correction tracking fails
        Rails.logger.error("[PlanTypeCorrection] Failed to track correction: #{e.message}")
      end
    end
  end
end
