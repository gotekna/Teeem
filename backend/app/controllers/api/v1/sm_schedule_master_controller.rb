# frozen_string_literal: true

module Api
  module V1
    class SmScheduleMasterController < ApplicationController
      before_action :set_template
      before_action :set_row, only: [ :show, :update, :destroy, :move ]

      # GET /api/v1/sm_schedule_master_templates/:sm_schedule_master_template_id/rows
      def index
        # Sort by sequence_order - dependencies drive scheduling, calculated client-side
        @rows = @template.sm_schedule_master_rows.active
                         .order(Arel.sql("COALESCE(sequence_order, 0) ASC"))

        render json: {
          success: true,
          rows: @rows.map { |r| row_json(r) }
        }
      end

      # GET /api/v1/sm_schedule_master_templates/:sm_schedule_master_template_id/rows/:id
      def show
        render json: {
          success: true,
          row: row_json(@row)
        }
      end

      # POST /api/v1/sm_schedule_master_templates/:sm_schedule_master_template_id/rows
      def create
        @row = SmScheduleMaster.new(row_params)
        @row.sm_template_ids = [@template.id]  # Add to this template
        @row.created_by = current_user

        # Auto-set sequence order if not provided
        if @row.sequence_order.blank?
          max_order = @template.sm_schedule_master_rows.maximum(:sequence_order) || 0
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

      # PATCH /api/v1/sm_schedule_master_templates/:sm_schedule_master_template_id/rows/:id
      def update
        @row.updated_by = current_user

        # Auto-clear dependency_broken when predecessors are re-added
        clear_dependency_broken_if_needed

        if @row.update(row_params)
          # Reload to get fresh data after any updates
          @row.reload

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

      # DELETE /api/v1/sm_schedule_master_templates/:sm_schedule_master_template_id/rows/:id
      def destroy
        # Soft delete
        @row.update!(is_active: false, updated_by: current_user)

        render json: { success: true, message: "Row deleted" }
      end

      # POST /api/v1/sm_schedule_master_templates/:sm_schedule_master_template_id/rows/:id/move
      def move
        new_position = params[:position].to_f

        if new_position <= 0
          return render json: { success: false, error: "Invalid position" }, status: :unprocessable_entity
        end

        @row.update!(sequence_order: new_position, updated_by: current_user)

        render json: {
          success: true,
          row: row_json(@row)
        }
      end

      # POST /api/v1/sm_schedule_master_templates/:sm_schedule_master_template_id/rows/bulk_create
      def bulk_create
        rows_data = params[:rows] || []
        created_rows = []
        errors = []

        ActiveRecord::Base.transaction do
          rows_data.each_with_index do |row_data, idx|
            row = SmScheduleMaster.new(bulk_row_params(row_data))
            row.sm_template_ids = [@template.id]  # Add to this template
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

      # POST /api/v1/sm_schedule_master_templates/:sm_schedule_master_template_id/rows/reorder
      def reorder
        positions = params[:positions] || [] # [{ id: 1, sequence_order: 1.0 }, ...]

        ActiveRecord::Base.transaction do
          positions.each do |pos|
            row = @template.sm_schedule_master_rows.find(pos[:id])
            row.update!(sequence_order: pos[:sequence_order])
          end
        end

        render json: {
          success: true,
          rows: @template.sm_schedule_master_rows.active.in_sequence.map { |r| row_json(r) }
        }
      end

      private

      def set_template
        @template = SmScheduleMasterTemplate.find(params[:sm_schedule_master_template_id])
      end

      def set_row
        @row = @template.sm_schedule_master_rows.find(params[:id])
      end

      # Clear dependency_broken flag when predecessors are re-added
      def clear_dependency_broken_if_needed
        return unless params[:row]
        return unless @row.dependency_broken

        # If predecessor_ids are being set and there are actual predecessors
        new_preds = params[:row][:predecessor_ids]
        if new_preds.present? && new_preds.is_a?(Array) && new_preds.any?
          # Predecessors being added - clear the broken flag
          params[:row][:dependency_broken] = false
        end
      end

      def row_params
        params.require(:row).permit(
          :name, :description, :task_number, :sequence_order,
          :duration_days,
          :trade, :stage, :header, :assigned_role, :cost_centre,
          :checklist_id, :parent_row_id,
          :require_photo, :require_certificate, :confirm,
          :po_required, :critical_po, :create_po_on_job_start, :po_supplier_id,
          :cert_lag_days,
          :has_subtasks, :subtask_count,
          :spawn_photo_task, :spawn_scan_task, :spawn_order_task, :spawn_call_task, :pass_fail_enabled,
          :order_time_days, :call_time_days,
          :show_in_docs_tab, :color,
          # New Schedule Master fields
          :auto_include, :allow_duplicates, :ai_select,
          :photo_entity_tab_id, :linked_po_task_id,
          :supplier_confirm, :is_master,
          # Manual positioning
          :hold, :hold_date, :dependency_broken,
          predecessor_ids: [ :id, :type, :lag ],
          linked_task_ids: [],
          spawn_office_tasks: [],
          documentation_category_ids: [],
          subtask_names: [],
          tags: [],
          # New array fields
          plan_type_ids: [],
          start_entity_tab_ids: [],
          complete_entity_tab_ids: [],
          certificate_document_type_ids: [],
          # PO line items with quantities
          po_line_items: [ :pricebook_item_id, :qty ]
        )
      end

      def bulk_row_params(data)
        data.permit(
          :name, :description, :task_number, :sequence_order,
          :duration_days,
          :trade, :stage, :header, :assigned_role,
          :parent_row_id,
          :require_photo, :require_certificate, :confirm,
          :po_required, :critical_po,
          :has_subtasks, :subtask_count,
          :spawn_photo_task, :spawn_scan_task, :spawn_order_task, :spawn_call_task, :pass_fail_enabled,
          :order_time_days, :call_time_days,
          :color,
          predecessor_ids: [ :id, :type, :lag ],
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
          predecessor_ids: row.predecessor_ids,
          predecessor_display: row.predecessor_display,
          predecessor_display_names: row.predecessor_display_names,
          trade: row.trade,
          stage: row.stage,
          header: row.header,
          cost_centre: row.cost_centre,
          assigned_role: row.assigned_role,
          checklist_id: row.checklist_id,
          parent_row_id: row.parent_row_id,
          require_photo: row.require_photo,
          require_certificate: row.require_certificate,
          confirm: row.confirm,
          po_required: row.po_required,
          critical_po: row.critical_po,
          create_po_on_job_start: row.create_po_on_job_start,
          po_supplier_id: row.po_supplier_id,
          po_supplier_name: row.po_supplier&.name,
          po_line_items: row.po_line_items || [],
          cert_lag_days: row.cert_lag_days,
          certificate_document_type_ids: row.certificate_document_type_ids || [],
          has_subtasks: row.has_subtasks,
          subtask_count: row.subtask_count,
          subtask_names: row.subtask_names,
          spawn_photo_task: row.spawn_photo_task,
          spawn_scan_task: row.spawn_scan_task,
          spawn_order_task: row.spawn_order_task,
          spawn_call_task: row.spawn_call_task,
          pass_fail_enabled: row.pass_fail_enabled,
          order_time_days: row.order_time_days,
          call_time_days: row.call_time_days,
          documentation_category_ids: row.documentation_category_ids,
          show_in_docs_tab: row.show_in_docs_tab,
          linked_task_ids: row.linked_task_ids,
          tags: row.tags,
          color: row.color,
          is_active: row.is_active,
          # Multi-template support
          sm_template_ids: row.sm_template_ids || [],
          # New Schedule Master fields
          auto_include: row.auto_include,
          allow_duplicates: row.allow_duplicates,
          ai_select: row.ai_select,
          plan_type_ids: row.plan_type_ids || [],
          start_entity_tab_ids: row.start_entity_tab_ids || [],
          complete_entity_tab_ids: row.complete_entity_tab_ids || [],
          photo_entity_tab_id: row.photo_entity_tab_id,
          linked_po_task_id: row.linked_po_task_id,
          linked_po_task_name: row.linked_po_task&.name,
          supplier_confirm: row.supplier_confirm,
          is_master: row.is_master,
          # Manual positioning (for held/locked dates)
          hold: row.hold,
          hold_date: row.hold_date,
          previous_hold_date: row.previous_manual_start_date,
          # Broken dependency indicator (locked task detached from flow)
          dependency_broken: row.dependency_broken,
          created_at: row.created_at,
          updated_at: row.updated_at
        }
      end
    end
  end
end
