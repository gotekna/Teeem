module Api
  module V1
    class ProjectsController < ApplicationController
      before_action :set_project, only: [ :show, :update, :destroy, :gantt ]

      # GET /api/v1/projects
      def index
        @projects = Project.includes(:project_manager, :construction).all.order(created_at: :desc)

        render json: {
          projects: @projects.as_json(
            include: {
              project_manager: {},
              construction: {}
            },
            methods: [ :total_tasks, :completed_tasks ]
          )
        }
      end

      # GET /api/v1/projects/:id
      def show
        render json: {
          project: @project.as_json(
            include: {
              project_manager: {},
              construction: {}
            },
            methods: [ :total_tasks, :completed_tasks, :progress_percentage ]
          )
        }
      end

      # GET /api/v1/projects/:id/gantt
      # Returns Gantt chart data for a project (SSoT: uses SmTask via job)
      def gantt
        tasks = @project.job.sm_tasks
          .includes(:purchase_order, :assigned_user, :supplier, :predecessor_tasks, :successor_tasks)
          .order(:start_date, :sequence_order)

        gantt_data = {
          project: {
            id: @project.id,
            name: @project.name,
            start_date: @project.start_date,
            end_date: @project.planned_end_date,
            status: @project.status
          },
          tasks: tasks.map do |task|
            {
              id: task.id,
              name: task.name,
              task_type: task.trade,
              category: task.stage,
              status: task.status,
              progress: task.progress_percentage,
              start_date: task.start_date,
              end_date: task.end_date,
              actual_start: task.actual_start_date,
              actual_end: task.actual_end_date,
              duration: task.duration_days,
              sequence_order: task.sequence_order,
              is_milestone: task.is_milestone,
              is_critical_path: task.is_critical_path,
              assigned_to: task.assigned_user&.name,
              supplier: task.supplier&.company_name,
              purchase_order: task.purchase_order ? {
                id: task.purchase_order.id,
                number: task.purchase_order.purchase_order_number,
                total: task.purchase_order.total
              } : nil,
              predecessors: task.predecessor_tasks.pluck(:id),
              successors: task.successor_tasks.pluck(:id)
            }
          end,
          dependencies: @project.job.sm_dependencies.map do |dep|
            {
              id: dep.id,
              source: dep.predecessor_id,
              target: dep.successor_id,
              type: dep.dependency_type,
              lag: dep.lag_days
            }
          end
        }

        render json: gantt_data
      end

      # POST /api/v1/projects
      def create
        @project = Project.new(project_params)

        if @project.save
          render json: { project: @project }, status: :created
        else
          render json: { errors: @project.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/projects/:id
      def update
        if @project.update(project_params)
          render json: { project: @project }
        else
          render json: { errors: @project.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/projects/:id
      def destroy
        @project.destroy
        head :no_content
      end

      private

      def set_project
        @project = Project.includes(:construction, :project_manager).find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { error: "Project not found" }, status: :not_found
      end

      def project_params
        params.require(:project).permit(
          :name,
          :project_code,
          :description,
          :start_date,
          :planned_end_date,
          :actual_end_date,
          :status,
          :client_name,
          :site_address,
          :project_manager_id,
          :job_id
        )
      end
    end
  end
end
