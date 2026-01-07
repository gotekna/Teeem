# frozen_string_literal: true

module Api
  module V1
    class SmScheduleMasterController < ApplicationController
      before_action :set_template
      before_action :set_row, only: [ :show, :update, :destroy, :move ]

      # GET /api/v1/sm_schedule_master_templates/:sm_schedule_master_template_id/rows
      # SSoT: Use ?for=gantt to filter invisible tasks (po_required without supplier)
      # Performance: includes po_supplier, spawn_scan_task, linked_po_task to avoid N+1
      def index
        # Sort by sequence_order - dependencies drive scheduling, calculated client-side
        @rows = @template.sm_schedule_master_rows.active
                         .includes(:po_supplier, :spawn_scan_task, :linked_po_task)
                         .order(Arel.sql("COALESCE(sequence_order, 0) ASC"))

        # Gantt mode: Filter out PO-required tasks without a supplier configured
        # This ensures incomplete PO tasks don't clutter the Gantt view
        # Use ?show_all_po=true to show all PO required tasks (useful for template editing)
        if params[:for] == "gantt" && params[:show_all_po] != "true"
          @rows = @rows.reject { |r| r.po_required && r.po_supplier_id.blank? }
        end

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
        Rails.logger.info "[SmScheduleMaster#update] Row ID: #{@row.id}, raw params: #{params.inspect}"
        Rails.logger.info "[SmScheduleMaster#update] row_params: #{row_params.inspect}"
        Rails.logger.info "[SmScheduleMaster#update] Before update - duration_days: #{@row.duration_days}"

        @row.updated_by = current_user

        # Auto-clear dependency_broken when predecessors are re-added
        clear_dependency_broken_if_needed

        result = @row.update(row_params)
        Rails.logger.info "[SmScheduleMaster#update] After update - duration_days: #{@row.duration_days}, update result: #{result}"

        if result
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
          rows: @template.sm_schedule_master_rows.active.includes(:po_supplier, :spawn_scan_task, :linked_po_task).in_sequence.map { |r| row_json(r) }
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
          :trade, :stage, :header_gantt, :assigned_role, :cost_centre,
          :checklist_id,
          :require_photo, :confirm,
          :po_required, :critical_po, :create_po_on_job_start, :po_supplier_id,
          :has_subtasks, :subtask_count,
          :spawn_scan_task_id, :spawn_scan_lag_days,
          :spawn_order_task, :spawn_call_task, :pass_fail_enabled,
          :order_time_days, :call_time_days,
          :color,
          # Workflow triggers
          :start_workflow_enabled, :start_workflow_id,
          :complete_workflow_enabled, :complete_workflow_id,
          # New Schedule Master fields
          :linked_po_task_id,
          :supplier_confirm,
          # Manual positioning and task status
          :hold, :hold_date, :dependency_broken, :started,
          # Header and active status
          :allow_header, :is_active,
          predecessor_ids: [ :id, :type, :lag ],
          linked_task_ids: [],
          subtask_names: [],
          tags: [],
          # PO line items with quantities
          po_line_items: [ :pricebook_item_id, :qty ],
          # Document types for GET task spawning
          sm_schedule_master_document_types_attributes: [ :id, :document_type_id, :lag_days, :assigned_role, :_destroy ]
        )
      end

      def bulk_row_params(data)
        data.permit(
          :name, :description, :task_number, :sequence_order,
          :duration_days,
          :trade, :stage, :header_gantt, :assigned_role,
          :require_photo, :confirm,
          :po_required, :critical_po,
          :has_subtasks, :subtask_count,
          :spawn_scan_task_id, :spawn_scan_lag_days,
          :spawn_order_task, :spawn_call_task, :pass_fail_enabled,
          :order_time_days, :call_time_days,
          :color,
          predecessor_ids: [ :id, :type, :lag ],
          subtask_names: [],
          tags: []
        )
      end

      def row_json(row)
        # Return lookup columns as { id: X, display: "Name" } format for TeeemTableView
        trade_value = row.trade.present? ? { id: row.trade.to_i, display: trades_map[row.trade.to_i] || row.trade } : nil
        stage_value = row.stage.present? ? { id: row.stage.to_i, display: stages_map[row.stage.to_i] || row.stage } : nil
        role_value = row.assigned_role.present? ? { id: row.assigned_role.to_i, display: roles_map[row.assigned_role.to_i] || row.assigned_role } : nil
        cost_centre_value = row.cost_centre.present? ? { id: row.cost_centre.to_i, display: cost_centres_map[row.cost_centre.to_i] || row.cost_centre } : nil
        # Header Gantt has dual meaning: "Header" string = this row IS a header, numeric ID = parent reference
        # Keep "Header" as string for backward compatibility with GanttCanvasView
        header_value = if row.header_gantt == "Header"
          "Header"  # This row IS a header - keep as string
        elsif row.header_gantt.present?
          { id: row.header_gantt.to_i, display: header_map[row.header_gantt.to_i] || row.header_gantt }  # Parent lookup
        end

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
          trade: trade_value,
          stage: stage_value,
          trade_name: trades_map[row.trade.to_i] || row.trade,
          stage_name: stages_map[row.stage.to_i] || row.stage,
          header_gantt: header_value,
          allow_header: row.allow_header,  # SSoT: Needed for Gantt V2 header bar rendering
          cost_centre: cost_centre_value,
          assigned_role: role_value,
          checklist_id: row.checklist_id,
          require_photo: row.require_photo,
          confirm: row.confirm,
          po_required: row.po_required,
          critical_po: row.critical_po,
          create_po_on_job_start: row.create_po_on_job_start,
          po_supplier_id: row.po_supplier_id,
          po_supplier_name: row.po_supplier&.name,
          po_line_items: row.po_line_items || [],
          has_subtasks: row.has_subtasks,
          subtask_count: row.subtask_count,
          subtask_names: row.subtask_names,
          spawn_scan_task_id: row.spawn_scan_task_id,
          spawn_scan_lag_days: row.spawn_scan_lag_days,
          spawn_scan_task_name: row.spawn_scan_task&.name,
          spawn_order_task: row.spawn_order_task,
          spawn_call_task: row.spawn_call_task,
          pass_fail_enabled: row.pass_fail_enabled,
          order_time_days: row.order_time_days,
          call_time_days: row.call_time_days,
          linked_task_ids: row.linked_task_ids,
          # Workflow triggers
          start_workflow_enabled: row.start_workflow_enabled,
          start_workflow_id: row.start_workflow_id,
          start_workflow_name: row.start_workflow&.name,
          complete_workflow_enabled: row.complete_workflow_enabled,
          complete_workflow_id: row.complete_workflow_id,
          complete_workflow_name: row.complete_workflow&.name,
          # Document types for GET task spawning
          document_types: row.sm_schedule_master_document_types.includes(:document_type).map { |dt|
            {
              id: dt.id,
              document_type_id: dt.document_type_id,
              document_type_name: dt.document_type&.display_name || dt.document_type&.name,
              lag_days: dt.lag_days,
              assigned_role: dt.assigned_role
            }
          },
          tags: row.tags,
          color: row.color,
          is_active: row.is_active,
          # Multi-template support
          sm_template_ids: row.sm_template_ids || [],
          # New Schedule Master fields
          linked_po_task_id: row.linked_po_task_id,
          linked_po_task_name: row.linked_po_task&.name,
          supplier_confirm: row.supplier_confirm,
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

      # SSoT: Load trades lookup map (ID => name) from Foundation SM Trades
      # Memoized per request to avoid N+1 queries
      def trades_map
        @trades_map ||= begin
          foundation = Foundation.find_by(name: "SM Trades")
          return {} unless foundation

          ActiveRecord::Base.connection
            .execute("SELECT id, name FROM #{foundation.database_table_name}")
            .to_a
            .each_with_object({}) { |r, h| h[r["id"]] = r["name"] }
        end
      end

      # SSoT: Load stages lookup map (ID => name) from Foundation SM Stages
      # Memoized per request to avoid N+1 queries
      def stages_map
        @stages_map ||= begin
          foundation = Foundation.find_by(name: "SM Stages")
          return {} unless foundation

          ActiveRecord::Base.connection
            .execute("SELECT id, name FROM #{foundation.database_table_name}")
            .to_a
            .each_with_object({}) { |r, h| h[r["id"]] = r["name"] }
        end
      end

      # SSoT: Load roles lookup map (ID => display_name) from Role model
      # Memoized per request to avoid N+1 queries
      def roles_map
        @roles_map ||= Role.all.each_with_object({}) { |r, h| h[r.id] = r.display_name || r.name }
      end

      # SSoT: Load cost centres lookup map (ID => name) from Foundation
      # Memoized per request to avoid N+1 queries
      def cost_centres_map
        @cost_centres_map ||= begin
          foundation = Foundation.find_by(slug: "cost_centres") || Foundation.find_by(name: "Cost Centres")
          return {} unless foundation

          ActiveRecord::Base.connection
            .execute("SELECT id, name FROM #{foundation.database_table_name}")
            .to_a
            .each_with_object({}) { |r, h| h[r["id"]] = r["name"] }
        end
      end

      # SSoT: Load header lookup map (ID => name) - self-reference to sm_schedule_master
      # Headers are tasks that act as group parents for other tasks
      # Memoized per request to avoid N+1 queries
      def header_map
        @header_map ||= SmScheduleMaster.pluck(:id, :name).to_h
      end
    end
  end
end
