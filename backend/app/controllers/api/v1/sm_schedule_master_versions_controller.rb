# frozen_string_literal: true

module Api
  module V1
    # SmScheduleMasterVersionsController - Manage template versions
    #
    # Handles the version lifecycle:
    # - Create drafts (copy from published)
    # - Edit draft rows
    # - Publish drafts
    # - Discard drafts
    # - View version history
    # - Compare versions
    #
    class SmScheduleMasterVersionsController < ApplicationController
      before_action :set_template
      before_action :set_version, only: [ :show, :update, :destroy, :publish ]

      # GET /api/v1/sm_schedule_master_templates/:template_id/versions
      # List all versions for a template
      def index
        versions = @template.sm_schedule_master_versions.by_version.includes(:published_by)

        render json: {
          success: true,
          template_id: @template.id,
          template_name: @template.name,
          versions: versions.map { |v| version_json(v) }
        }
      end

      # GET /api/v1/sm_schedule_master_templates/:template_id/versions/:id
      # Get version details including rows
      def show
        render json: {
          success: true,
          version: version_json(@version, include_rows: true)
        }
      end

      # POST /api/v1/sm_schedule_master_templates/:template_id/versions
      # Create a new draft version (copies rows from published version)
      def create
        service = SmScheduleMasterVersionService.new(@template, user: current_user)
        result = service.create_draft

        if result[:success]
          render json: {
            success: true,
            version: version_json(result[:version]),
            message: result[:message],
            rows_copied: result[:rows_copied]
          }, status: :created
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/sm_schedule_master_templates/:template_id/versions/:id
      # Update draft version metadata (not rows - use rows controller for that)
      def update
        return render_not_draft unless @version.draft?

        if @version.update(version_params)
          render json: {
            success: true,
            version: version_json(@version)
          }
        else
          render json: {
            success: false,
            errors: @version.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_schedule_master_templates/:template_id/versions/:id
      # Discard a draft version
      def destroy
        service = SmScheduleMasterVersionService.new(@template, user: current_user)
        result = service.discard_draft

        if result[:success]
          render json: {
            success: true,
            message: result[:message],
            rows_deleted: result[:rows_deleted]
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/sm_schedule_master_templates/:template_id/versions/:id/publish
      # Publish the draft version
      def publish
        return render_not_draft unless @version.draft?

        service = SmScheduleMasterVersionService.new(@template, user: current_user)
        result = service.publish_draft(change_summary: params[:change_summary])

        if result[:success]
          render json: {
            success: true,
            version: version_json(result[:version]),
            message: result[:message]
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/sm_schedule_master_templates/:template_id/versions/compare
      # Compare two versions
      def compare
        version_a = @template.sm_schedule_master_versions.find(params[:version_a_id])
        version_b = @template.sm_schedule_master_versions.find(params[:version_b_id])

        service = SmScheduleMasterVersionService.new(@template, user: current_user)
        result = service.compare_versions(version_a, version_b)

        render json: {
          success: true,
          comparison: result
        }
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Version not found"
        }, status: :not_found
      end

      # GET /api/v1/sm_schedule_master_templates/:template_id/versions/history
      # Get formatted version history
      def history
        service = SmScheduleMasterVersionService.new(@template, user: current_user)
        history = service.version_history

        render json: {
          success: true,
          template_id: @template.id,
          template_name: @template.name,
          history: history
        }
      end

      private

      def set_template
        @template = SmScheduleMasterTemplate.find(params[:sm_schedule_master_template_id] || params[:template_id])
      end

      def set_version
        @version = @template.sm_schedule_master_versions.find(params[:id])
      end

      def version_params
        params.permit(:change_summary)
      end

      def render_not_draft
        render json: {
          success: false,
          error: "Only draft versions can be modified"
        }, status: :unprocessable_entity
      end

      def version_json(version, include_rows: false)
        json = {
          id: version.id,
          version_number: version.version_number,
          status: version.status,
          published_at: version.published_at,
          published_by: version.published_by&.name,
          published_by_id: version.published_by_id,
          change_summary: version.change_summary,
          row_count: version.row_count,
          jobs_using: version.jobs.count,
          created_at: version.created_at,
          updated_at: version.updated_at
        }

        if include_rows
          json[:rows] = version.sm_schedule_master_rows.in_sequence.map { |r| row_json(r) }
        end

        json
      end

      def row_json(row)
        {
          id: row.id,
          task_number: row.task_number,
          name: row.name,
          description: row.description,
          sequence_order: row.sequence_order,
          duration_days: row.duration_days,
          predecessor_ids: row.predecessor_ids,
          trade: row.trade,
          stage: row.stage,
          assigned_role: row.assigned_role,
          require_photo: row.require_photo,
          po_required: row.po_required,
          critical_po: row.critical_po,
          is_active: row.is_active
        }
      end
    end
  end
end
