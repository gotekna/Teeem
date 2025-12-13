module Api
  module V1
    class ProjectTasksController < ApplicationController
      before_action :set_project
      before_action :set_task, only: [ :show, :update, :destroy, :auto_complete_subtasks ]

      # GET /api/v1/projects/:project_id/tasks
      def index
        tasks = @project.project_tasks
          .includes(:task_template, :purchase_order, :assigned_to, :predecessor_tasks, :successor_tasks)
          .order(:planned_start_date, :sequence_order)

        render json: {
          tasks: tasks.as_json(
            include: {
              purchase_order: {}
            },
            methods: [ :materials_status ]
          )
        }
      end

      # GET /api/v1/projects/:project_id/tasks/:id
      def show
        render json: {
          task: serialize_task(@task)
        }
      end

      # POST /api/v1/projects/:project_id/tasks
      def create
        @task = @project.project_tasks.build(task_params)

        if @task.save
          render json: {
            success: true,
            task: serialize_task(@task)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @task.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/projects/:project_id/tasks/:id
      # Phase 1: Simple inline editing - accepts any task field and updates it
      def update
        if @task.update(task_params)
          render json: {
            success: true,
            task: serialize_task(@task)
          }
        else
          render json: {
            success: false,
            errors: @task.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/projects/:project_id/tasks/:id
      def destroy
        @task.destroy
        render json: { success: true }, status: :ok
      end

      # POST /api/v1/projects/:project_id/tasks/:id/auto_complete_subtasks
      def auto_complete_subtasks
        user_name = @current_user&.name || "System"
        completed_count = @task.auto_complete_all_subtasks!(user_name)

        render json: {
          success: true,
          completed_count: completed_count,
          message: "Auto-completed #{completed_count} subtask(s)"
        }
      rescue StandardError => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      private

      def set_project
        @project = Project.find(params[:project_id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Project not found" }, status: :not_found
      end

      def set_task
        @task = @project.project_tasks.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Task not found" }, status: :not_found
      end

      def task_params
        params.require(:project_task).permit(
          :name,
          :task_type,
          :category,
          :status,
          :planned_start_date,
          :planned_end_date,
          :actual_start_date,
          :actual_end_date,
          :duration_days,
          :progress_percentage,
          :sequence_order,
          :assigned_to_id,
          :supplier_name,
          :purchase_order_id,
          :task_template_id,
          :is_milestone,
          :is_critical_path,
          :required_on_site_date,
          :notes,
          :completion_notes
        )
      end

      def serialize_task(task)
        {
          id: task.id,
          name: task.name,
          task_type: task.task_type,
          category: task.category,
          status: task.status,
          planned_start_date: task.planned_start_date,
          planned_end_date: task.planned_end_date,
          actual_start_date: task.actual_start_date,
          actual_end_date: task.actual_end_date,
          duration_days: task.duration_days,
          progress_percentage: task.progress_percentage,
          sequence_order: task.sequence_order,
          assigned_to_id: task.assigned_to_id,
          assigned_to: task.assigned_to&.name,
          supplier_name: task.supplier_name,
          is_milestone: task.is_milestone,
          is_critical_path: task.is_critical_path,
          required_on_site_date: task.required_on_site_date,
          notes: task.notes,
          completion_notes: task.completion_notes,
          materials_status: task.materials_status,
          purchase_order: task.purchase_order ? {
            id: task.purchase_order.id,
            number: task.purchase_order.purchase_order_number,
            total: task.purchase_order.total,
            required_on_site_date: task.purchase_order.required_on_site_date,
            expected_delivery_date: task.purchase_order.expected_delivery_date,
            status: task.purchase_order.status
          } : nil,
          predecessors: task.predecessor_tasks.pluck(:id),
          successors: task.successor_tasks.pluck(:id),
          created_at: task.created_at,
          updated_at: task.updated_at
        }
      end
    end
  end
end
