# DEPRECATED: Use SmTemplatesController instead
# This controller is being replaced as part of SSoT consolidation.
# Frontend has been updated to use /api/v1/sm_templates.
# This controller will be removed in a future release.
module Api
  module V1
    class ScheduleTemplatesController < ApplicationController
      before_action :authorize_request
      before_action :log_deprecation_warning
      before_action :set_schedule_template, only: [ :show, :update, :destroy, :duplicate, :set_as_default ]
      before_action :check_can_create_templates, only: [ :create, :duplicate ]
      before_action :check_can_edit_templates, only: [ :update, :destroy, :set_as_default ]

      # GET /api/v1/schedule_templates
      def index
        templates = ScheduleTemplate.includes(:created_by, :schedule_template_rows)
                                     .active
                                     .order(created_at: :desc)

        render json: templates.map { |t| template_json(t) }
      end

      # GET /api/v1/schedule_templates/:id
      def show
        response_json = template_json_with_rows(@schedule_template)

        # DEBUG: Log what we're returning for row 2
        row_2 = response_json[:rows].find { |r| r[:id] == 2 }
        if row_2
          Rails.logger.info "📊 GET TEMPLATE - Row 2: manually_positioned=#{row_2[:manually_positioned]}, supplier_confirm=#{row_2[:supplier_confirm]}"
        end

        render json: response_json
      end

      # POST /api/v1/schedule_templates
      def create
        template = ScheduleTemplate.new(template_params)
        template.created_by = @current_user

        if template.save
          render json: template_json_with_rows(template), status: :created
        else
          render json: { errors: template.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/schedule_templates/:id
      def update
        if @schedule_template.update(template_params)
          render json: template_json_with_rows(@schedule_template)
        else
          render json: { errors: @schedule_template.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/schedule_templates/:id
      def destroy
        # Don't allow deleting the default template
        if @schedule_template.is_default?
          return render json: { error: "Cannot delete the default template" }, status: :forbidden
        end

        @schedule_template.destroy
        head :no_content
      end

      # POST /api/v1/schedule_templates/:id/duplicate
      def duplicate
        new_name = params[:new_name] || "#{@schedule_template.name} (Copy)"

        begin
          new_template = @schedule_template.duplicate!(
            new_name: new_name,
            created_by: @current_user
          )

          render json: template_json_with_rows(new_template), status: :created
        rescue ActiveRecord::RecordInvalid => e
          render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/schedule_templates/:id/set_as_default
      def set_as_default
        # Unset current default
        ScheduleTemplate.where(is_default: true).update_all(is_default: false)

        # Set this one as default
        @schedule_template.update!(is_default: true)

        render json: template_json_with_rows(@schedule_template)
      end

      # GET /api/v1/schedule_templates/default
      def default
        template = ScheduleTemplate.default_template

        if template
          render json: template_json_with_rows(template)
        else
          render json: { error: "No default template found" }, status: :not_found
        end
      end

      private

      def log_deprecation_warning
        Rails.logger.warn "[DEPRECATED] ScheduleTemplatesController accessed. Use SmTemplatesController (/api/v1/sm_templates) instead. Action: #{action_name}"
      end

      def set_schedule_template
        @schedule_template = ScheduleTemplate.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Template not found" }, status: :not_found
      end

      def template_params
        params.require(:schedule_template).permit(:name, :description, :is_default)
      end

      def check_can_create_templates
        unless @current_user&.can_create_templates?
          render json: { error: "Unauthorized" }, status: :forbidden
        end
      end

      def check_can_edit_templates
        unless @current_user&.can_create_templates?
          render json: { error: "Unauthorized" }, status: :forbidden
        end
      end

      def template_json(template)
        {
          id: template.id,
          name: template.name,
          description: template.description,
          is_default: template.is_default,
          created_by: {
            id: template.created_by.id,
            name: template.created_by.name,
            email: template.created_by.email
          },
          row_count: template.schedule_template_rows.count,
          created_at: template.created_at,
          updated_at: template.updated_at
        }
      end

      def template_json_with_rows(template)
        template_json(template).merge(
          rows: template.schedule_template_rows.in_sequence.map { |row| row_json(row) }
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
          dependencies_broken: row.dependencies_broken
        }
      end
    end
  end
end
