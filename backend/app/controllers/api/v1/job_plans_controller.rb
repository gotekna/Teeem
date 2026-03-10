module Api
  module V1
    class JobPlansController < ApplicationController

      before_action :set_job
      before_action :set_job_plan, only: [:show, :update, :destroy, :add_revision, :set_on_issue]

      # GET /api/v1/jobs/:job_id/job_plans
      def index
        per_page = [[params[:per_page]&.to_i || 50, 1].max, 200].min
        cursor = params[:cursor]&.to_i
        tab_id = params[:tab_id]

        @job_plans = @job.job_plans
                         .includes(:job_plan_tab, current_revision: :issued_by)
                         .ordered

        @job_plans = @job_plans.where(job_plan_tab_id: tab_id) if tab_id.present?

        total_count = cursor.blank? ? @job_plans.count : nil

        @job_plans = @job_plans.where('job_plans.id > ?', cursor) if cursor.present?
        @job_plans = @job_plans.reorder(:id).limit(per_page + 1)

        plans = @job_plans.to_a
        has_more = plans.length > per_page
        plans = plans.first(per_page) if has_more

        render json: {
          success: true,
          data: plans.map { |plan| serialize_plan_minimal(plan) },
          pagination: {
            has_more: has_more,
            next_cursor: plans.last&.id,
            total_count: total_count,
            per_page: per_page
          }
        }
      end

      # GET /api/v1/jobs/:job_id/job_plans/on_issue
      def on_issue
        @job_plans = @job.job_plans
                         .joins(:current_revision)
                         .where(job_plan_revisions: { is_on_issue: true })
                         .includes(:job_plan_tab, :current_revision)
                         .ordered

        render json: {
          success: true,
          data: @job_plans.map { |plan| serialize_plan(plan) }
        }
      end

      # GET /api/v1/jobs/:job_id/job_plans/tabs
      def tabs
        @tabs = @job.job_plan_tabs
                    .includes(:children)
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
          render_validation_errors(@job_plan)
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
          render_validation_errors(@job_plan)
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

        if revision.storage_reference.present?
          GeneratePlanThumbnailJob.perform_later(revision.id)
        end

        render json: {
          success: true,
          data: serialize_revision(revision)
        }, status: :created
      rescue => e
        render_error(e.message, status: :unprocessable_entity)
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
        render_error('Revision not found', status: :not_found)
      end

      # GET /api/v1/jobs/:job_id/job_plans/suggested_recipients
      def suggested_recipients
        recipients = []

        @job.job_contacts.includes(:contact).each do |job_contact|
          contact = job_contact.contact
          next unless contact&.email.present?

          role_display = case job_contact.role&.downcase
                         when 'client' then 'Client'
                         when 'site_supervisor', 'supervisor' then 'Site Supervisor'
                         when 'architect' then 'Architect'
                         when 'builder' then 'Builder'
                         when 'engineer' then 'Engineer'
                         when 'certifier' then 'Certifier'
                         else job_contact.role&.titleize || 'Contact'
                         end

          type = case job_contact.role&.downcase
                 when 'client' then 'client'
                 when 'site_supervisor', 'supervisor' then 'supervisor'
                 when 'contractor', 'builder' then 'contractor'
                 else 'contact'
                 end

          recipients << {
            id: contact.id,
            name: contact.name,
            email: contact.email,
            role: role_display,
            type: type
          }
        end

        render json: {
          success: true,
          data: recipients.uniq { |r| r[:email] }
        }
      end

      # POST /api/v1/jobs/:job_id/job_plans/upload_plan_set
      # SSoT: Blob-only staging (Mar 2026)
      def upload_plan_set
        unless params[:file].present?
          return render_error('No file provided', status: :unprocessable_entity)
        end

        uploaded_file = params[:file]

        staging_filename = "_staging_#{Time.current.to_i}_#{uploaded_file.original_filename}"
        file_content = uploaded_file.read
        staging_blob = StorageBlob.find_or_create_for_content!(
          file_content,
          filename: staging_filename,
          content_type: uploaded_file.content_type || "application/pdf"
        )

        tab_id = params[:job_plan_tab_id] || @job.job_plan_tabs.root_tabs.ordered.first&.id

        render json: {
          success: true,
          data: {
            message: "Plan set upload staged",
            staging_blob_id: staging_blob.id,
            tab_id: tab_id
          }
        }, status: :accepted

      rescue StandardError => e
        Rails.logger.error("upload_plan_set failed: #{e.class} - #{e.message}")
        render_error(e.message, status: :internal_server_error)
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
          :variant_suffix,
          :display_name
        )
      end

      def revision_params
        params.permit(
          :revision_date,
          :notes,
          :storage_file_id,
          :storage_web_url,
          :file_name,
          :file_size
        )
      end

      def serialize_plan_minimal(plan)
        {
          id: plan.id,
          job_id: plan.job_id,
          job_plan_tab_id: plan.job_plan_tab_id,
          variant_suffix: plan.variant_suffix,
          display_name: plan.computed_display_name,
          is_combined_pdf: plan.is_combined_pdf,
          current_revision: plan.current_revision ? serialize_revision_minimal(plan.current_revision) : nil,
          revision_count: plan.revisions_count,
          created_at: plan.created_at,
          updated_at: plan.updated_at
        }
      end

      def serialize_revision_minimal(revision)
        {
          id: revision.id,
          revision: revision.revision,
          revision_label: revision.revision_label,
          is_on_issue: revision.is_on_issue,
          has_file: revision.has_file?,
          storage_file_id: revision.storage_reference,
          storage_reference: revision.storage_reference,
          notes: revision.notes,
          micro_thumbnail_base64: revision.micro_thumbnail_base64,
          thumbnail_file_id: revision.thumbnail_file_id
        }
      end

      def serialize_plan(plan, include_revisions: false)
        data = {
          id: plan.id,
          job_id: plan.job_id,
          job_plan_tab_id: plan.job_plan_tab_id,
          variant_suffix: plan.variant_suffix,
          display_name: plan.computed_display_name,
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
          storage_file_id: revision.storage_reference,
          storage_reference: revision.storage_reference,
          storage_web_url: revision.storage_web_url,
          file_name: revision.file_name,
          file_size: revision.file_size,
          formatted_file_size: revision.formatted_file_size,
          notes: revision.notes,
          issued_by: revision.issued_by ? {
            id: revision.issued_by.id,
            name: revision.issued_by.name
          } : nil,
          thumbnail_url: revision.thumbnail_url,
          thumbnail_file_id: revision.thumbnail_file_id,
          micro_thumbnail_base64: revision.micro_thumbnail_base64,
          created_at: revision.created_at
        }
      end

      def serialize_tab(tab)
        {
          id: tab.id,
          name: tab.name,
          code: tab.code,
          sequence_order: tab.sequence_order,
          is_active: tab.is_active,
          plan_count: tab.total_plans_count,
          on_issue_count: tab.total_on_issue_count,
          children: tab.children.ordered.map { |child| serialize_tab(child) }
        }
      end
    end
  end
end
