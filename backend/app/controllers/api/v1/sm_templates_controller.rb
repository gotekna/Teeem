# frozen_string_literal: true

module Api
  module V1
    class SmTemplatesController < ApplicationController
      before_action :set_template, only: [:show, :update, :destroy, :set_default]

      # GET /api/v1/sm_templates
      def index
        @templates = SmTemplate.active.ordered

        render json: {
          success: true,
          sm_templates: @templates.map { |t| template_json(t) }
        }
      end

      # GET /api/v1/sm_templates/:id
      def show
        render json: {
          success: true,
          sm_template: template_json(@template, include_rows: true)
        }
      end

      # POST /api/v1/sm_templates
      def create
        @template = SmTemplate.new(template_params)
        @template.created_by = current_user

        if @template.save
          render json: {
            success: true,
            sm_template: template_json(@template)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @template.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/sm_templates/:id
      def update
        @template.updated_by = current_user

        if @template.update(template_params)
          render json: {
            success: true,
            sm_template: template_json(@template)
          }
        else
          render json: {
            success: false,
            errors: @template.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_templates/:id
      def destroy
        # Soft delete by marking inactive
        @template.update!(is_active: false, updated_by: current_user)

        render json: { success: true, message: 'Template archived' }
      end

      # POST /api/v1/sm_templates/:id/set_default
      def set_default
        @template.update!(is_default: true)

        render json: {
          success: true,
          sm_template: template_json(@template)
        }
      end

      # GET /api/v1/sm_templates/default
      def default
        @template = SmTemplate.active.default_template.first

        if @template
          render json: {
            success: true,
            sm_template: template_json(@template, include_rows: true)
          }
        else
          render json: {
            success: false,
            error: 'No default template found'
          }, status: :not_found
        end
      end

      private

      def set_template
        @template = SmTemplate.find(params[:id])
      end

      def template_params
        params.require(:sm_template).permit(:name, :description, :is_default)
      end

      def template_json(template, include_rows: false)
        json = {
          id: template.id,
          name: template.name,
          description: template.description,
          is_default: template.is_default,
          is_active: template.is_active,
          row_count: template.row_count,
          created_by: template.created_by&.slice(:id, :first_name, :last_name),
          created_at: template.created_at,
          updated_at: template.updated_at
        }

        if include_rows
          json[:rows] = template.ordered_rows.map { |r| row_json(r) }
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
          start_day_offset: row.start_day_offset,
          predecessor_ids: row.predecessor_ids,
          predecessor_display: row.predecessor_display,
          trade: row.trade,
          stage: row.stage,
          assigned_role: row.assigned_role,
          supplier_id: row.supplier_id,
          supplier_name: row.supplier&.name,
          require_photo: row.require_photo,
          require_certificate: row.require_certificate,
          require_supervisor_check: row.require_supervisor_check,
          po_required: row.po_required,
          critical_po: row.critical_po,
          create_po_on_job_start: row.create_po_on_job_start,
          has_subtasks: row.has_subtasks,
          subtask_count: row.subtask_count,
          subtask_names: row.subtask_names,
          spawn_photo_task: row.spawn_photo_task,
          spawn_scan_task: row.spawn_scan_task,
          pass_fail_enabled: row.pass_fail_enabled,
          color: row.color,
          tags: row.tags,
          parent_row_id: row.parent_row_id,
          is_active: row.is_active
        }
      end
    end
  end
end
