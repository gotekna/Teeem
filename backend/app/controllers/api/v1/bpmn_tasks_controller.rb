module Api
  module V1
    class BpmnTasksController < ApplicationController
      before_action :set_task, only: [ :show, :complete, :claim, :unclaim, :skip ]

      # List all actionable tasks for current user
      def index
        @tasks = BpmnTaskInstance
          .actionable
          .user_tasks
          .includes(:bpmn_node, bpmn_token: { bpmn_process_instance: :bpmn_process })
          .order(created_at: :asc)

        # Filter to tasks the user can action
        @tasks = @tasks.select { |task| task.can_action?(current_user) }

        render json: {
          success: true,
          tasks: @tasks.map { |t| serialize_task(t) },
          total: @tasks.size
        }
      end

      # List all tasks (admin view)
      def all
        @tasks = BpmnTaskInstance
          .includes(:bpmn_node, :assigned_to, bpmn_token: { bpmn_process_instance: :bpmn_process })
          .order(created_at: :desc)

        # Filtering
        @tasks = @tasks.where(status: params[:status]) if params[:status].present?
        @tasks = @tasks.where(task_type: params[:task_type]) if params[:task_type].present?

        # Pagination
        @tasks = @tasks.limit(params[:limit] || 100)
        @tasks = @tasks.offset(params[:offset]) if params[:offset].present?

        render json: {
          success: true,
          tasks: @tasks.map { |t| serialize_task(t) }
        }
      end

      def show
        render json: {
          success: true,
          task: serialize_task_full(@task)
        }
      end

      def complete
        unless @task.can_action?(current_user)
          return render json: { success: false, error: "You cannot complete this task" }, status: :forbidden
        end

        @task.update!(form_data: params[:form_data].to_unsafe_h) if params[:form_data].present?
        @task.complete!(params[:result]&.to_unsafe_h || {})

        render json: { success: true, task: serialize_task(@task) }
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, errors: e.record.errors.full_messages }, status: :unprocessable_entity
      end

      def claim
        unless @task.claim!(current_user)
          return render json: { success: false, error: "Cannot claim this task" }, status: :unprocessable_entity
        end

        render json: { success: true, task: serialize_task(@task) }
      end

      def unclaim
        unless @task.assigned_to == current_user
          return render json: { success: false, error: "You can only unclaim tasks assigned to you" }, status: :forbidden
        end

        unless @task.unclaim!
          return render json: { success: false, error: "Cannot unclaim this task" }, status: :unprocessable_entity
        end

        render json: { success: true, task: serialize_task(@task) }
      end

      def skip
        # SSoT: admin? now checks user_roles join table
        unless current_user&.admin?
          return render json: { success: false, error: "Only admins can skip tasks" }, status: :forbidden
        end

        @task.skip!
        render json: { success: true, task: serialize_task(@task) }
      end

      private

      def set_task
        @task = BpmnTaskInstance.find(params[:id])
      end

      def serialize_task(task)
        instance = task.bpmn_process_instance
        {
          id: task.id,
          node_name: task.display_name,
          task_type: task.task_type,
          status: task.status,
          process_id: instance.bpmn_process_id,
          process_name: instance.bpmn_process.name,
          instance_id: instance.id,
          subject_type: instance.subject_type,
          subject_id: instance.subject_id,
          subject_name: instance.subject_display_name,
          assigned_to_type: task.assigned_to_type,
          assigned_to_id: task.assigned_to_id,
          assigned_to_name: task.assignee_name,
          due_date: task.due_date,
          is_overdue: task.overdue?,
          created_at: task.created_at,
          started_at: task.started_at
        }
      end

      def serialize_task_full(task)
        instance = task.bpmn_process_instance

        serialize_task(task).merge(
          node_config: task.bpmn_node.config,
          form_schema: task.bpmn_node.form_schema,
          form_data: task.form_data,
          execution_result: task.execution_result,
          error_message: task.error_message,
          retry_count: task.retry_count,
          process_variables: instance.variables,
          subject: serialize_subject(instance.subject),
          completed_at: task.completed_at
        )
      end

      def serialize_subject(subject)
        {
          id: subject.id,
          type: subject.class.name,
          name: subject.try(:display_name) || subject.try(:name) || subject.try(:title) || "#{subject.class.name} ##{subject.id}",
          # Include common fields if available
          status: subject.try(:status),
          created_at: subject.try(:created_at)
        }
      end
    end
  end
end
