# frozen_string_literal: true

module Api
  module V1
    class SmTasksController < ApplicationController
      before_action :set_construction, only: [:index, :create, :gantt_data, :copy_from_template]
      before_action :set_sm_task, only: [
        :show, :update, :destroy, :start, :complete, :spawn_preview,
        :hold, :release_hold, :cascade_preview, :cascade_execute, :move,
        :working_drawings, :process_working_drawings, :override_page_category
      ]

      # GET /api/v1/constructions/:construction_id/sm_tasks
      def index
        @tasks = @construction.sm_tasks.ordered.includes(
          :hold_reason, :purchase_order, :assigned_user, :supplier,
          :predecessor_dependencies, :successor_dependencies
        )

        # Apply filters
        @tasks = @tasks.by_trade(params[:trade]) if params[:trade].present?
        @tasks = @tasks.active if params[:active_only] == 'true'
        @tasks = @tasks.hold_tasks if params[:hold_tasks_only] == 'true'

        render json: {
          success: true,
          sm_tasks: @tasks.map { |task| task_to_json(task) },
          meta: {
            total_count: @construction.sm_tasks.count,
            active_count: @construction.sm_tasks.active.count,
            hold_count: @construction.sm_tasks.hold_tasks.where(status: 'not_started').count,
            completed_count: @construction.sm_tasks.status_completed.count
          }
        }
      end

      # GET /api/v1/sm_tasks/:id
      def show
        render json: {
          success: true,
          sm_task: task_to_json(@task, include_dependencies: true)
        }
      end

      # POST /api/v1/constructions/:construction_id/sm_tasks
      def create
        @task = @construction.sm_tasks.new(sm_task_params)
        @task.created_by = current_user

        # Set sequence order to be last + 1
        max_sequence = @construction.sm_tasks.maximum(:sequence_order) || 0
        @task.sequence_order = max_sequence + 1

        if @task.save
          render json: {
            success: true,
            message: 'Task created successfully',
            sm_task: task_to_json(@task)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @task.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/constructions/:construction_id/sm_tasks/copy_from_template
      def copy_from_template
        unless params[:template_row_id].present?
          return render json: {
            success: false,
            error: 'Template row ID is required'
          }, status: :unprocessable_entity
        end

        template_row = ScheduleTemplateRow.find_by(id: params[:template_row_id])

        unless template_row
          return render json: {
            success: false,
            error: 'Template row not found'
          }, status: :not_found
        end

        # Get the next sequence order
        max_sequence = @construction.sm_tasks.maximum(:sequence_order) || 0

        # Create task from template row
        @task = @construction.sm_tasks.new(
          name: template_row.title,
          status: 'not_started',
          duration_days: template_row.duration,
          start_date: Date.current,
          template_row_id: template_row.id,
          sequence_order: max_sequence + 1,
          trade: template_row.category,
          created_by: current_user
        )

        if @task.save
          render json: {
            success: true,
            message: 'Task created from template successfully',
            sm_task: task_to_json(@task)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @task.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/constructions/:construction_id/sm_tasks/gantt_data
      def gantt_data
        tasks = @construction.sm_tasks.ordered.includes(
          :hold_reason, :predecessor_dependencies, :successor_dependencies
        )

        render json: {
          success: true,
          gantt_data: {
            tasks: tasks.map { |task| task_to_gantt_format(task) },
            dependencies: tasks.flat_map { |task| dependencies_to_gantt_format(task) }
          },
          meta: {
            construction_id: @construction.id,
            task_count: tasks.count,
            settings: SmSetting.instance.slice(:rollover_time, :rollover_timezone, :rollover_enabled)
          }
        }
      end

      # PATCH /api/v1/sm_tasks/:id
      def update
        @task.updated_by = current_user

        if @task.update(sm_task_params)
          render json: {
            success: true,
            sm_task: task_to_json(@task)
          }
        else
          render json: {
            success: false,
            errors: @task.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_tasks/:id
      def destroy
        @task.destroy

        render json: {
          success: true,
          message: 'Task deleted successfully'
        }
      end

      # POST /api/v1/sm_tasks/:id/start
      def start
        if @task.start!
          render json: {
            success: true,
            message: 'Task started',
            sm_task: task_to_json(@task)
          }
        else
          render json: {
            success: false,
            error: 'Task cannot be started'
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/sm_tasks/:id/complete
      def complete
        passed = params[:passed].nil? ? nil : ActiveModel::Type::Boolean.new.cast(params[:passed])

        service = SmTaskCompletionService.new(@task, user: current_user)
        result = service.complete(passed: passed)

        if result[:success]
          render json: {
            success: true,
            message: 'Task completed',
            sm_task: task_to_json(result[:task]),
            spawned_tasks: result[:spawned_tasks].map { |t| task_to_json(t) }
          }
        else
          render json: {
            success: false,
            errors: result[:errors]
          }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/sm_tasks/:id/spawn_preview
      def spawn_preview
        service = SmTaskCompletionService.new(@task)
        spawns = service.preview_spawns

        render json: {
          success: true,
          task_id: @task.id,
          spawns: spawns
        }
      end

      # POST /api/v1/sm_tasks/:id/hold
      def hold
        unless params[:hold_reason_id].present?
          return render json: {
            success: false,
            error: 'Hold reason is required'
          }, status: :unprocessable_entity
        end

        hold_reason = SmHoldReason.active.find_by(id: params[:hold_reason_id])
        unless hold_reason
          return render json: {
            success: false,
            error: 'Hold reason not found'
          }, status: :not_found
        end

        @task.update!(
          is_hold_task: true,
          hold_reason: hold_reason,
          hold_notes: params[:hold_notes],
          hold_started_at: Time.current,
          hold_started_by: current_user
        )

        # Create hold log
        SmHoldLog.create!(
          task: @task,
          action: 'hold',
          hold_reason: hold_reason,
          notes: params[:hold_notes],
          performed_by: current_user
        )

        render json: {
          success: true,
          message: 'Task placed on hold',
          sm_task: task_to_json(@task)
        }
      end

      # POST /api/v1/sm_tasks/:id/release_hold
      def release_hold
        unless @task.is_hold_task?
          return render json: {
            success: false,
            error: 'Task is not on hold'
          }, status: :unprocessable_entity
        end

        old_reason = @task.hold_reason

        @task.update!(
          is_hold_task: false,
          hold_reason: nil,
          hold_notes: nil,
          hold_released_at: Time.current,
          hold_released_by: current_user
        )

        # Create hold log
        SmHoldLog.create!(
          task: @task,
          action: 'release',
          hold_reason: old_reason,
          notes: params[:release_notes],
          performed_by: current_user
        )

        render json: {
          success: true,
          message: 'Hold released',
          sm_task: task_to_json(@task)
        }
      end

      # POST /api/v1/sm_tasks/:id/cascade_preview
      # Preview cascade effects before moving a task
      def cascade_preview
        unless params[:new_start_date].present?
          return render json: {
            success: false,
            error: 'new_start_date is required'
          }, status: :unprocessable_entity
        end

        cascade_service = SmCascadeService.new(@task)
        preview = cascade_service.preview(params[:new_start_date])

        render json: {
          success: true,
          preview: preview
        }
      end

      # POST /api/v1/sm_tasks/:id/cascade_execute
      # Execute cascade with user decisions
      def cascade_execute
        cascade_params = {
          new_start_date: params[:new_start_date],
          user_id: current_user&.id,
          tasks_to_cascade: params[:tasks_to_cascade] || [],
          tasks_to_break: params[:tasks_to_break] || [],
          tasks_to_unlock: params[:tasks_to_unlock] || []
        }

        cascade_service = SmCascadeService.new(@task)
        results = cascade_service.execute(cascade_params)

        if results[:errors].empty?
          render json: {
            success: true,
            message: "Cascade complete. Updated #{results[:updated_tasks].count} tasks.",
            results: {
              updated_count: results[:updated_tasks].count,
              broken_dependencies_count: results[:broken_dependencies].count,
              unlocked_count: results[:unlocked_tasks].count,
              updated_task_ids: results[:updated_tasks].map(&:id)
            }
          }
        else
          render json: {
            success: false,
            errors: results[:errors]
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/sm_tasks/:id/move
      # Simple move that auto-cascades unlocked successors
      def move
        unless params[:new_start_date].present?
          return render json: {
            success: false,
            error: 'new_start_date is required'
          }, status: :unprocessable_entity
        end

        cascade_service = SmCascadeService.new(@task)
        preview = cascade_service.preview(params[:new_start_date])

        # If there are blocked successors, return preview for modal
        if preview[:blocked_successors].any?
          render json: {
            success: false,
            needs_confirmation: true,
            preview: preview,
            message: 'Cascade blocked by locked tasks. Please resolve conflicts.'
          }, status: :conflict
          return
        end

        # No conflicts - execute automatically
        cascade_params = {
          new_start_date: params[:new_start_date],
          user_id: current_user&.id,
          tasks_to_cascade: preview[:unlocked_successors].map { |s| s[:id] }
        }

        results = cascade_service.execute(cascade_params)

        render json: {
          success: true,
          message: "Task moved. Cascaded #{results[:updated_tasks].count - 1} successor tasks.",
          sm_task: task_to_json(@task.reload),
          cascade_results: {
            updated_count: results[:updated_tasks].count,
            updated_task_ids: results[:updated_tasks].map(&:id)
          }
        }
      end

      # GET /api/v1/sm_tasks/:id/working_drawings
      # Get working drawings page categorization for a task
      def working_drawings
        summary = SmWorkingDrawingsService.summary_for_task(@task)

        render json: {
          success: true,
          task_id: @task.id,
          task_name: @task.name,
          **summary
        }
      end

      # POST /api/v1/sm_tasks/:id/working_drawings/process
      # Process a PDF and categorize pages using AI
      def process_working_drawings
        unless params[:file].present? || params[:url].present?
          return render json: {
            success: false,
            error: 'Either file or url parameter is required'
          }, status: :unprocessable_entity
        end

        service = SmWorkingDrawingsService.new(@task)

        result = if params[:file].present?
          service.process_pdf(
            params[:file].read,
            filename: params[:file].original_filename
          )
        else
          service.process_from_url(params[:url])
        end

        if result[:success]
          render json: result
        else
          render json: result, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/sm_tasks/:id/working_drawings/pages/:page_id/override
      # Override AI category for a page
      def override_page_category
        page = @task.working_drawing_pages.find_by(id: params[:page_id])

        unless page
          return render json: {
            success: false,
            error: 'Page not found'
          }, status: :not_found
        end

        unless params[:category].present?
          return render json: {
            success: false,
            error: 'category parameter is required'
          }, status: :unprocessable_entity
        end

        unless SmWorkingDrawingsService::CATEGORIES.include?(params[:category])
          return render json: {
            success: false,
            error: "Invalid category. Valid categories: #{SmWorkingDrawingsService::CATEGORIES.join(', ')}"
          }, status: :unprocessable_entity
        end

        page.override_category!(params[:category])

        render json: {
          success: true,
          message: 'Category overridden',
          page: {
            id: page.id,
            page_number: page.page_number,
            original_category: page.category,
            effective_category: page.effective_category,
            ai_confidence: page.ai_confidence,
            category_overridden: page.category_overridden?
          }
        }
      end

      private

      def set_construction
        @construction = Construction.find(params[:construction_id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: 'Construction job not found'
        }, status: :not_found
      end

      def set_sm_task
        @task = SmTask.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: 'Task not found'
        }, status: :not_found
      end

      def sm_task_params
        params.require(:sm_task).permit(
          :name,
          :status,
          :start_date,
          :end_date,
          :duration_days,
          :trade,
          :description,
          :notes,
          :color,
          :progress_percentage,
          :confirm,
          :supplier_confirm,
          :manually_positioned,
          :purchase_order_id,
          :assigned_user_id,
          :supplier_id,
          :parent_task_id,
          :sequence_order,
          documentation_category_ids: []
        )
      end

      def task_to_json(task, include_dependencies: false)
        json = {
          id: task.id,
          construction_id: task.construction_id,
          task_number: task.task_number,
          name: task.name,
          status: task.status,
          start_date: task.start_date,
          end_date: task.end_date,
          duration_days: task.duration_days,
          trade: task.trade,
          description: task.description,
          progress_percentage: task.progress_percentage,
          # Locks
          locked: task.locked?,
          lock_type: task.lock_type,
          confirm: task.confirm,
          supplier_confirm: task.supplier_confirm,
          manually_positioned: task.manually_positioned,
          # Hold
          is_hold_task: task.is_hold_task,
          hold_reason_id: task.hold_reason_id,
          hold_reason: task.hold_reason&.name,
          hold_notes: task.hold_notes,
          hold_started_at: task.hold_started_at,
          # Relations
          purchase_order_id: task.purchase_order_id,
          assigned_user_id: task.assigned_user_id,
          supplier_id: task.supplier_id,
          parent_task_id: task.parent_task_id,
          sequence_order: task.sequence_order,
          # Computed
          started_at: task.started_at,
          completed_at: task.completed_at,
          created_at: task.created_at,
          updated_at: task.updated_at
        }

        if include_dependencies
          json[:predecessor_dependencies] = task.active_predecessor_dependencies.map do |dep|
            {
              id: dep.id,
              predecessor_task_id: dep.predecessor_task_id,
              predecessor_task_number: dep.predecessor_task.task_number,
              predecessor_task_name: dep.predecessor_task.name,
              dependency_type: dep.dependency_type,
              lag_days: dep.lag_days
            }
          end

          json[:successor_dependencies] = task.active_successor_dependencies.map do |dep|
            {
              id: dep.id,
              successor_task_id: dep.successor_task_id,
              successor_task_number: dep.successor_task.task_number,
              successor_task_name: dep.successor_task.name,
              dependency_type: dep.dependency_type,
              lag_days: dep.lag_days
            }
          end
        end

        json
      end

      def task_to_gantt_format(task)
        {
          id: task.id,
          task_number: task.task_number,
          name: task.name,
          start_date: task.start_date,
          end_date: task.end_date,
          duration_days: task.duration_days,
          progress: task.progress_percentage || 0,
          status: task.status,
          locked: task.locked?,
          lock_type: task.lock_type,
          is_hold_task: task.is_hold_task,
          hold_reason: task.hold_reason&.name,
          color: task.color || task.hold_reason&.color,
          parent_id: task.parent_task_id
        }
      end

      def dependencies_to_gantt_format(task)
        task.active_predecessor_dependencies.map do |dep|
          {
            id: dep.id,
            source: dep.predecessor_task_id,
            target: dep.successor_task_id,
            type: dep.dependency_type,
            lag: dep.lag_days
          }
        end
      end
    end
  end
end
