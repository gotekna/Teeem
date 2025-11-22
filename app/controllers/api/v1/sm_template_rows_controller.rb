# frozen_string_literal: true

module Api
  module V1
    class SmTemplateRowsController < ApplicationController
      before_action :set_template
      before_action :set_row, only: [:show, :update, :destroy, :move]

      # GET /api/v1/sm_templates/:sm_template_id/rows
      def index
        @rows = @template.sm_template_rows.active.in_sequence

        render json: {
          success: true,
          rows: @rows.map { |r| row_json(r) }
        }
      end

      # GET /api/v1/sm_templates/:sm_template_id/rows/:id
      def show
        render json: {
          success: true,
          row: row_json(@row)
        }
      end

      # POST /api/v1/sm_templates/:sm_template_id/rows
      def create
        @row = @template.sm_template_rows.new(row_params)
        @row.created_by = current_user

        # Auto-set sequence order if not provided
        if @row.sequence_order.blank?
          max_order = @template.sm_template_rows.maximum(:sequence_order) || 0
          @row.sequence_order = max_order + 1
        end

        if @row.save
          render json: {
            success: true,
            row: row_json(@row)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @row.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/sm_templates/:sm_template_id/rows/:id
      def update
        @row.updated_by = current_user

        if @row.update(row_params)
          render json: {
            success: true,
            row: row_json(@row)
          }
        else
          render json: {
            success: false,
            errors: @row.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_templates/:sm_template_id/rows/:id
      def destroy
        # Soft delete
        @row.update!(is_active: false, updated_by: current_user)

        render json: { success: true, message: 'Row deleted' }
      end

      # POST /api/v1/sm_templates/:sm_template_id/rows/:id/move
      def move
        new_position = params[:position].to_f

        if new_position <= 0
          return render json: { success: false, error: 'Invalid position' }, status: :unprocessable_entity
        end

        @row.update!(sequence_order: new_position, updated_by: current_user)

        render json: {
          success: true,
          row: row_json(@row)
        }
      end

      # POST /api/v1/sm_templates/:sm_template_id/rows/bulk_create
      def bulk_create
        rows_data = params[:rows] || []
        created_rows = []
        errors = []

        ActiveRecord::Base.transaction do
          rows_data.each_with_index do |row_data, idx|
            row = @template.sm_template_rows.new(bulk_row_params(row_data))
            row.created_by = current_user

            if row.save
              created_rows << row
            else
              errors << { index: idx, errors: row.errors.full_messages }
            end
          end

          raise ActiveRecord::Rollback if errors.any?
        end

        if errors.any?
          render json: { success: false, errors: errors }, status: :unprocessable_entity
        else
          render json: {
            success: true,
            rows: created_rows.map { |r| row_json(r) },
            count: created_rows.length
          }, status: :created
        end
      end

      # POST /api/v1/sm_templates/:sm_template_id/rows/reorder
      def reorder
        positions = params[:positions] || [] # [{ id: 1, sequence_order: 1.0 }, ...]

        ActiveRecord::Base.transaction do
          positions.each do |pos|
            row = @template.sm_template_rows.find(pos[:id])
            row.update!(sequence_order: pos[:sequence_order])
          end
        end

        render json: {
          success: true,
          rows: @template.sm_template_rows.active.in_sequence.map { |r| row_json(r) }
        }
      end

      private

      def set_template
        @template = SmTemplate.find(params[:sm_template_id])
      end

      def set_row
        @row = @template.sm_template_rows.find(params[:id])
      end

      def row_params
        params.require(:row).permit(
          :name, :description, :task_number, :sequence_order,
          :duration_days, :start_day_offset,
          :trade, :stage, :assigned_role,
          :supplier_id, :checklist_id, :parent_row_id,
          :require_photo, :require_certificate, :require_supervisor_check,
          :po_required, :critical_po, :create_po_on_job_start,
          :cert_lag_days,
          :has_subtasks, :subtask_count,
          :spawn_photo_task, :spawn_scan_task, :pass_fail_enabled,
          :order_time_days, :call_time_days,
          :show_in_docs_tab, :color,
          predecessor_ids: [:id, :type, :lag],
          linked_task_ids: [],
          spawn_office_tasks: [],
          documentation_category_ids: [],
          subtask_names: [],
          price_book_item_ids: [],
          tags: []
        )
      end

      def bulk_row_params(data)
        data.permit(
          :name, :description, :task_number, :sequence_order,
          :duration_days, :start_day_offset,
          :trade, :stage, :assigned_role,
          :supplier_id, :parent_row_id,
          :require_photo, :require_certificate, :require_supervisor_check,
          :po_required, :critical_po,
          :has_subtasks, :subtask_count,
          :spawn_photo_task, :spawn_scan_task, :pass_fail_enabled,
          :color,
          predecessor_ids: [:id, :type, :lag],
          subtask_names: [],
          tags: []
        )
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
          predecessor_display_names: row.predecessor_display_names,
          trade: row.trade,
          stage: row.stage,
          assigned_role: row.assigned_role,
          supplier_id: row.supplier_id,
          supplier_name: row.supplier&.name,
          checklist_id: row.checklist_id,
          parent_row_id: row.parent_row_id,
          require_photo: row.require_photo,
          require_certificate: row.require_certificate,
          require_supervisor_check: row.require_supervisor_check,
          po_required: row.po_required,
          critical_po: row.critical_po,
          create_po_on_job_start: row.create_po_on_job_start,
          cert_lag_days: row.cert_lag_days,
          has_subtasks: row.has_subtasks,
          subtask_count: row.subtask_count,
          subtask_names: row.subtask_names,
          spawn_photo_task: row.spawn_photo_task,
          spawn_scan_task: row.spawn_scan_task,
          pass_fail_enabled: row.pass_fail_enabled,
          order_time_days: row.order_time_days,
          call_time_days: row.call_time_days,
          documentation_category_ids: row.documentation_category_ids,
          show_in_docs_tab: row.show_in_docs_tab,
          linked_task_ids: row.linked_task_ids,
          price_book_item_ids: row.price_book_item_ids,
          tags: row.tags,
          color: row.color,
          is_active: row.is_active,
          created_at: row.created_at,
          updated_at: row.updated_at
        }
      end
    end
  end
end
