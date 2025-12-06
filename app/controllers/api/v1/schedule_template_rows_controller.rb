module Api
  module V1
    class ScheduleTemplateRowsController < ApplicationController
      before_action :authorize_request
      before_action :set_template
      before_action :set_row, only: [ :update, :destroy, :audit_logs ]
      before_action :check_can_edit_templates, except: [ :audit_logs ]

      # POST /api/v1/schedule_templates/:template_id/rows
      def create
        row = @template.schedule_template_rows.build(row_params)

        # Auto-assign sequence order if not provided
        if row.sequence_order.nil?
          max_order = @template.schedule_template_rows.maximum(:sequence_order) || 0
          row.sequence_order = max_order + 1
        end

        if row.save
          render json: row_json(row), status: :created
        else
          render json: { errors: row.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/schedule_templates/:template_id/rows/:id
      def update
        # Set current user for audit logging
        Thread.current[:current_audit_user_id] = @current_user&.id

        # DEBUG: Log what we're receiving
        Rails.logger.info "🔵 UPDATE ROW #{@row.id} - Received params: #{row_params.inspect}"
        Rails.logger.info "🔵 BEFORE UPDATE - manually_positioned: #{@row.manually_positioned}, supplier_confirm: #{@row.supplier_confirm}"

        # VALIDATION: start_date is stored as "days from project start" (not a timestamp)
        # Valid range: 0 to 9999 days (0 = project start, ~27 years max)
        # Note: This is NOT a Unix timestamp - it's a relative day offset
        if row_params[:start_date].present?
          start_date_int = row_params[:start_date].to_i
          if start_date_int < 0 || start_date_int > 9999
            Rails.logger.error "❌ REJECTED INVALID start_date: #{row_params[:start_date]} for row #{@row.id} (must be 0-9999 days from project start)"
            render json: {
              error: "Invalid start_date: #{row_params[:start_date]} (must be between 0 and 9999 days from project start)",
              current_value: @row.start_date
            }, status: :unprocessable_entity
            return
          end
        end

        # Track which attributes are changing for cascade detection
        changed_attrs = []
        [ :start_date, :duration ].each do |attr|
          changed_attrs << attr if row_params.key?(attr) && row_params[attr] != @row.send(attr)
        end

        if @row.update(row_params)
          # Reload to get fresh data from database
          @row.reload
          Rails.logger.info "✅ AFTER UPDATE - manually_positioned: #{@row.manually_positioned}, supplier_confirm: #{@row.supplier_confirm}"

          # ANTI-LOOP FIX: Don't manually cascade here - the after_update callback handles it!
          # Get affected tasks from thread-local (set by cascade callback)
          affected_tasks = Thread.current[:cascade_affected_tasks] || [ @row ]
          Thread.current[:cascade_affected_tasks] = nil # Clear it

          # Return all affected tasks (original + cascaded)
          response_json = if affected_tasks.length > 1
            Rails.logger.info "🔄 CASCADE: Returning #{affected_tasks.length} affected tasks"
            {
              task: row_json(@row),
              cascaded_tasks: affected_tasks.reject { |t| t.id == @row.id }.map { |t| row_json(t) }
            }
          else
            row_json(@row)
          end

          Rails.logger.info "📤 SENDING RESPONSE - manually_positioned: #{response_json[:manually_positioned] rescue 'N/A'}, supplier_confirm: #{response_json[:supplier_confirm] rescue 'N/A'}"

          render json: response_json
        else
          Rails.logger.error "❌ UPDATE FAILED - Errors: #{@row.errors.full_messages}"
          render json: { errors: @row.errors.full_messages }, status: :unprocessable_entity
        end
      ensure
        Thread.current[:current_audit_user_id] = nil
      end

      # DELETE /api/v1/schedule_templates/:template_id/rows/:id
      def destroy
        @row.destroy
        head :no_content
      end

      # POST /api/v1/schedule_templates/:template_id/rows/bulk_delete
      def bulk_delete
        ids = params[:ids]
        return render json: { success: false, error: "No IDs provided" }, status: :bad_request if ids.blank?

        ids = ids.first(1000) if ids.is_a?(Array)
        deleted_count = @template.schedule_template_rows.where(id: ids).delete_all

        render json: {
          success: true,
          deleted_count: deleted_count,
          requested_count: ids.size
        }
      rescue => e
        Rails.logger.error "Error bulk deleting schedule template rows: #{e.class} - #{e.message}"
        render json: { error: e.message }, status: :internal_server_error
      end

      # POST /api/v1/schedule_templates/:template_id/rows/bulk_update
      def bulk_update
        updates = params[:updates] || []
        errors = []

        # Set current user for audit logging
        Thread.current[:current_audit_user_id] = @current_user&.id

        ActiveRecord::Base.transaction do
          updates.each do |update_data|
            row = @template.schedule_template_rows.find(update_data[:id])
            unless row.update(row_params_from_hash(update_data))
              errors << { id: row.id, errors: row.errors.full_messages }
            end
          end

          raise ActiveRecord::Rollback if errors.any?
        end

        if errors.empty?
          render json: { success: true }
        else
          render json: { errors: errors }, status: :unprocessable_entity
        end
      ensure
        Thread.current[:current_audit_user_id] = nil
      end

      # POST /api/v1/schedule_templates/:template_id/rows/reorder
      def reorder
        row_ids = params[:row_ids] || []

        ActiveRecord::Base.transaction do
          # Step 1: Get all rows and build old sequence mapping (id -> old_sequence)
          all_rows = @template.schedule_template_rows.order(:sequence_order)
          old_sequence_map = {}
          all_rows.each_with_index do |row, idx|
            old_sequence_map[row.id] = idx + 1  # 1-based sequence
          end

          # Step 2: Build new sequence mapping (id -> new_sequence)
          new_sequence_map = {}
          row_ids.each_with_index do |row_id, index|
            new_sequence_map[row_id] = index + 1  # 1-based sequence
          end

          # Step 3: Build reverse mapping (old_sequence -> new_sequence)
          sequence_changes = {}
          old_sequence_map.each do |row_id, old_seq|
            new_seq = new_sequence_map[row_id]
            sequence_changes[old_seq] = new_seq if old_seq != new_seq
          end

          Rails.logger.info "🔄 REORDER - Old to New mapping: #{sequence_changes.inspect}"

          # Step 4: Update sequence_order for all rows
          row_ids.each_with_index do |row_id, index|
            row = @template.schedule_template_rows.find(row_id)
            row.update_column(:sequence_order, index)
          end

          # Step 5: Update predecessor_ids for all rows that reference moved tasks
          if sequence_changes.any?
            all_rows.each do |row|
              next if row.predecessor_ids.blank?

              updated_predecessors = row.predecessor_ids.map do |pred|
                pred_id = pred["id"].to_i
                new_pred_id = sequence_changes[pred_id] || pred_id

                if new_pred_id != pred_id
                  Rails.logger.info "  📝 Row #{row.id}: Updating predecessor #{pred_id} -> #{new_pred_id}"
                end

                { "id" => new_pred_id, "type" => pred["type"], "lag" => pred["lag"] }
              end

              if updated_predecessors != row.predecessor_ids
                row.update_column(:predecessor_ids, updated_predecessors)
              end
            end
          end
        end

        render json: { success: true }
      rescue StandardError => e
        Rails.logger.error "❌ REORDER FAILED: #{e.message}"
        Rails.logger.error e.backtrace.join("\n")
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/schedule_templates/:template_id/rows/:id/audit_logs
      def audit_logs
        audits = @row.audits
                     .includes(:user)
                     .recent
                     .limit(100)

        render json: audits.map { |audit| audit_json(audit) }
      end

      private

      def set_template
        @template = ScheduleTemplate.find(params[:schedule_template_id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Template not found" }, status: :not_found
      end

      def set_row
        @row = @template.schedule_template_rows.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Row not found" }, status: :not_found
      end

      def check_can_edit_templates
        unless @current_user&.can_create_templates?
          render json: { error: "Unauthorized" }, status: :forbidden
        end
      end

      def row_params
        params.require(:schedule_template_row).permit(
          :name,
          :supplier_id,
          :assigned_user_id,
          :po_required,
          :create_po_on_job_start,
          :critical_po,
          :require_photo,
          :require_certificate,
          :cert_lag_days,
          :require_supervisor_check,
          :auto_complete_predecessors,
          :has_subtasks,
          :subtask_count,
          :sequence_order,
          :linked_template_id,
          :manual_task,
          :allow_multiple_instances,
          :order_required,
          :call_up_required,
          :plan_required,
          :duration,
          :start_date,
          :manually_positioned,
          :confirm,
          :supplier_confirm,
          :start,
          :complete,
          :dependencies_broken,
          predecessor_ids: [ :id, :type, :lag ],
          broken_predecessor_ids: [ :id, :type, :lag ],
          price_book_item_ids: [],
          documentation_category_ids: [],
          supervisor_checklist_template_ids: [],
          tags: [],
          subtask_names: [],
          linked_task_ids: [],
          auto_complete_task_ids: [],
          subtask_template_ids: []
        )
      end

      def row_params_from_hash(hash)
        ActionController::Parameters.new(hash).permit(
          :name,
          :supplier_id,
          :assigned_user_id,
          :po_required,
          :create_po_on_job_start,
          :critical_po,
          :require_photo,
          :require_certificate,
          :cert_lag_days,
          :require_supervisor_check,
          :auto_complete_predecessors,
          :has_subtasks,
          :subtask_count,
          :sequence_order,
          :linked_template_id,
          :manual_task,
          :allow_multiple_instances,
          :order_required,
          :call_up_required,
          :plan_required,
          :duration,
          :start_date,
          :manually_positioned,
          :confirm,
          :supplier_confirm,
          :start,
          :complete,
          :dependencies_broken,
          predecessor_ids: [ :id, :type, :lag ],
          broken_predecessor_ids: [ :id, :type, :lag ],
          price_book_item_ids: [],
          documentation_category_ids: [],
          supervisor_checklist_template_ids: [],
          tags: [],
          subtask_names: [],
          linked_task_ids: [],
          auto_complete_task_ids: [],
          subtask_template_ids: []
        )
      end

      def row_json(row)
        {
          id: row.id,
          name: row.name,
          supplier_id: row.supplier_id,
          supplier_name: row.supplier&.name,
          assigned_user_id: row.assigned_user_id,
          predecessor_ids: row.predecessor_ids,
          predecessor_display: row.predecessor_display,
          predecessor_display_names: row.predecessor_display_names,
          po_required: row.po_required,
          create_po_on_job_start: row.create_po_on_job_start,
          price_book_item_ids: row.price_book_item_ids,
          documentation_category_ids: row.documentation_category_ids,
          supervisor_checklist_template_ids: row.supervisor_checklist_template_ids,
          critical_po: row.critical_po,
          tags: row.tags,
          require_photo: row.require_photo,
          require_certificate: row.require_certificate,
          cert_lag_days: row.cert_lag_days,
          require_supervisor_check: row.require_supervisor_check,
          auto_complete_predecessors: row.auto_complete_predecessors,
          auto_complete_task_ids: row.auto_complete_task_ids,
          has_subtasks: row.has_subtasks,
          subtask_count: row.subtask_count,
          subtask_names: row.subtask_names,
          subtask_template_ids: row.subtask_template_ids,
          sequence_order: row.sequence_order,
          linked_task_ids: row.linked_task_ids,
          linked_tasks_display: row.linked_tasks_display,
          linked_template_id: row.linked_template_id,
          linked_template_name: row.linked_template_name,
          manual_task: row.manual_task,
          allow_multiple_instances: row.allow_multiple_instances,
          order_required: row.order_required,
          call_up_required: row.call_up_required,
          plan_required: row.plan_required,
          duration: row.duration,
          start_date: row.start_date,
          manually_positioned: row.manually_positioned,
          confirm: row.confirm,
          supplier_confirm: row.supplier_confirm,
          start: row.start,
          complete: row.complete,
          dependencies_broken: row.dependencies_broken,
          broken_predecessor_ids: row.broken_predecessor_ids
        }
      end

      def audit_json(audit)
        {
          id: audit.id,
          field_name: audit.field_name,
          old_value: audit.old_value,
          new_value: audit.new_value,
          changed_at: audit.changed_at,
          user: {
            id: audit.user.id,
            name: audit.user.name,
            email: audit.user.email
          }
        }
      end
    end
  end
end
