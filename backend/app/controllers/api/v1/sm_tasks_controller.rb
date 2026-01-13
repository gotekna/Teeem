# frozen_string_literal: true

module Api
  module V1
    class SmTasksController < ApplicationController
      before_action :set_job, only: [ :job_index, :gantt_data, :copy_from_template, :import, :upgrade_preview, :upgrade, :validate_dates ]
      before_action :set_job_optional, only: [ :create ]
      before_action :set_sm_task, only: [
        :show, :update, :destroy, :start, :complete, :spawn_preview,
        :hold, :release_hold, :cascade_preview, :cascade_execute, :move,
        :working_drawings, :process_working_drawings, :override_page_category,
        :attachments, :add_attachment, :remove_attachment, :upload_attachment,
        :download_attachment_for_email, :create_attachment_share_link,
        :follow, :unfollow, :followers, :add_follower, :remove_follower,
        :history,
        :compare_to_template, :sync_from_template
      ]

      # GET /api/v1/sm_tasks (global - all tasks across jobs)
      # Performance: includes all associations to avoid N+1
      # WARNING: Do not use linked_purchase_order - it bypasses eager loading (see model alias issue)
      def index
        @tasks = SmTask.ordered.includes(
          :job, :hold_reason, :purchase_order, :assigned_user, :supplier,
          :action_items, :start_workflow, :complete_workflow, :completion_document_type,
          sm_task_attachments: :attachable
        )

        # Privacy filter - only show tasks visible to current user
        @tasks = @tasks.visible_to(current_user)

        # Apply filters
        @tasks = @tasks.where(construction_id: params[:job_id]) if params[:job_id].present?
        @tasks = @tasks.where(construction_id: params[:job_ids]) if params[:job_ids].present?
        @tasks = @tasks.where(assigned_user_id: params[:assigned_user_id]) if params[:assigned_user_id].present?
        @tasks = @tasks.where(status: params[:statuses]) if params[:statuses].present?
        @tasks = @tasks.by_trade(params[:trade]) if params[:trade].present?
        @tasks = @tasks.active if params[:active_only] == "true"
        @tasks = @tasks.hold_tasks if params[:hold_tasks_only] == "true"
        # Mine filter: tasks assigned to user OR (optionally) tasks user is following
        if params[:mine] == "true"
          if params[:include_following] == "true"
            # Get tasks user is assigned to OR tasks they're following
            assigned_task_ids = SmTask.for_user_roles(current_user).pluck(:id)
            following_task_ids = TaskFollower.where(user_id: current_user.id).pluck(:sm_task_id)
            all_task_ids = (assigned_task_ids + following_task_ids).uniq
            @tasks = @tasks.where(id: all_task_ids)
          else
            @tasks = @tasks.for_user_roles(current_user)
          end
        end
        @tasks = @tasks.where(assigned_user_id: nil, assigned_role: nil) if params[:unassigned] == "true"
        # Filter by specific user - shows all tasks they can work on (direct + role-based)
        if params[:for_user_id].present?
          user = User.find_by(id: params[:for_user_id])
          @tasks = @tasks.for_user_roles(user) if user
        end

        render json: {
          success: true,
          tasks: @tasks.limit(500).map { |task| task_to_json_with_job(task) },
          meta: {
            total_count: @tasks.count,
            active_count: SmTask.active.count,
            hold_count: SmTask.hold_tasks.where(status: "not_started").count,
            completed_count: SmTask.status_completed.count
          }
        }
      end

      # GET /api/v1/sm_tasks/user_counts
      # Returns task counts per user using for_user_roles scope
      # Each user's count = tasks they can work on (direct + job role + dept role + fallback)
      def user_counts
        # SSoT: Get users who have roles via user_roles join table (not assigned_roles column)
        users_with_roles = User.joins(:user_roles).distinct

        # Count tasks for each user using for_user_roles scope
        user_counts = users_with_roles.map do |user|
          count = SmTask.active.for_user_roles(user).count
          { id: user.id, name: user.name, count: count } if count > 0
        end.compact.sort_by { |u| -u[:count] }

        # Unassigned = no user AND no role
        # Note: assigned_role is an integer column, so just check for NULL
        unassigned_count = SmTask.active
                                 .where(assigned_user_id: nil, assigned_role: nil)
                                 .count

        # Total active tasks
        total_count = SmTask.active.count

        render json: {
          success: true,
          users: user_counts,
          unassigned: unassigned_count,
          total: total_count
        }
      end

      # GET /api/v1/jobs/:job_id/sm_tasks (nested under job)
      # SSoT: Use ?for=gantt to get filtered tasks with dependency rewiring
      # Performance: includes sm_task_attachments to avoid N+1
      # SSoT: sm_schedule_master needed for header_gantt lookup in GanttDataService
      def job_index
        # Lightweight mode for dropdowns/selects - minimal data for fast loading
        # Used by: PO detail page task dropdown
        # Handle early to avoid heavy includes/ordered scope
        if params[:for] == "select"
          tasks_data = @job.sm_tasks
            .order(:sequence_order, :id)
            .pluck(:id, :name, :task_number, :start_date, :po_required)
            .map { |id, name, task_number, start_date, po_required| { id: id, name: name, task_number: task_number, start_date: start_date, po_required: po_required } }
          return render json: { success: true, sm_tasks: tasks_data }
        end

        @tasks = @job.sm_tasks.ordered.includes(
          :hold_reason, :purchase_order, :assigned_user, :supplier, :sm_schedule_master,
          sm_task_attachments: :attachable
        )

        # Apply filters
        @tasks = @tasks.by_trade(params[:trade]) if params[:trade].present?
        @tasks = @tasks.active if params[:active_only] == "true"
        @tasks = @tasks.hold_tasks if params[:hold_tasks_only] == "true"

        # SSoT: Gantt mode - apply po_required filtering + dependency rewiring
        # This consolidates the old /gantt_data endpoint into one SSoT endpoint
        if params[:for] == "gantt"
          return render_gantt_data(@tasks)
        end

        render json: {
          success: true,
          sm_tasks: @tasks.map { |task| task_to_json(task) },
          meta: {
            total_count: @job.sm_tasks.count,
            active_count: @job.sm_tasks.active.count,
            hold_count: @job.sm_tasks.hold_tasks.where(status: "not_started").count,
            completed_count: @job.sm_tasks.status_completed.count
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

      # POST /api/v1/constructions/:job_id/sm_tasks (nested)
      # POST /api/v1/sm_tasks (standalone - no job required)
      def create
        if @job
          @task = @job.sm_tasks.new(sm_task_params)
          # Generate unique name for duplicates (e.g., "Req Bath 1", "Req Bath 2")
          @task.name = generate_unique_task_name(@job, @task.name)
          # Set sequence order to be last + 1
          max_sequence = @job.sm_tasks.maximum(:sequence_order) || 0
          @task.sequence_order = max_sequence + 1
        else
          @task = SmTask.new(sm_task_params)
          # Default sequence order for standalone tasks
          @task.sequence_order ||= 1
        end

        @task.created_by = current_user

        if @task.save
          # Recalculate dates if task was created with dependencies
          # SSoT: Uses same logic as update (recalculate_task_dates_from_predecessors)
          # Fix: Dependencies should determine start_date, not user input
          if @task.predecessor_ids.present? && !@task.locked?
            recalculate_task_dates_from_predecessors(@task)
          end

          # Add followers if provided
          if params[:follower_ids].present?
            Array(params[:follower_ids]).each do |user_id|
              @task.task_followers.find_or_create_by(user_id: user_id) do |tf|
                tf.followed_at = Time.current
              end
            end
          end

          # Add viewers if provided (for private task access)
          if params[:viewer_ids].present?
            Array(params[:viewer_ids]).each do |user_id|
              @task.task_viewers.find_or_create_by(user_id: user_id)
            end
          end

          # Create notification if task was created with an assignee
          notify_new_task_assignment(@task)

          render json: {
            success: true,
            message: "Task created successfully",
            sm_task: task_to_json(@task)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @task.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/constructions/:job_id/sm_tasks/copy_from_template
      def copy_from_template
        unless params[:template_row_id].present?
          return render json: {
            success: false,
            error: "Template row ID is required"
          }, status: :unprocessable_entity
        end

        # Use SmScheduleMaster (THE ONE template system - SSoT)
        template_row = SmScheduleMaster.find_by(id: params[:template_row_id])

        unless template_row
          return render json: {
            success: false,
            error: "Template row not found"
          }, status: :not_found
        end

        # Get the next sequence order
        max_sequence = @job.sm_tasks.maximum(:sequence_order) || 0

        # Generate unique name for duplicates (e.g., "Req Bath 1", "Req Bath 2")
        task_name = generate_unique_task_name(@job, template_row.name)

        # Create task from template row
        @task = @job.sm_tasks.new(
          name: task_name,
          status: "not_started",
          duration_days: template_row.duration_days || 1,
          start_date: Date.current,
          sm_schedule_master_id: template_row.id,
          sequence_order: max_sequence + 1,
          trade: template_row.trade,
          created_by: current_user
        )

        if @task.save
          render json: {
            success: true,
            message: "Task created from template successfully",
            sm_task: task_to_json(@task)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @task.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/constructions/:job_id/sm_tasks/import
      # Import tasks from Excel/CSV file
      #
      # Params:
      #   file: The uploaded file (required)
      #   clear_existing: Whether to clear existing tasks first (optional, defaults to false)
      #
      def import
        unless params[:file].present?
          return render json: {
            success: false,
            error: "No file provided"
          }, status: :unprocessable_entity
        end

        file = params[:file]
        temp_file = save_temp_file(file)

        begin
          result = SmTaskImportService.new(@job, temp_file.path, {
            user: current_user,
            clear_existing: params[:clear_existing] == true || params[:clear_existing] == "true"
          }).execute

          if result[:success]
            render json: {
              success: true,
              message: "Successfully imported #{result[:imported_count]} tasks",
              imported_count: result[:imported_count],
              dependencies_count: result[:dependencies_count],
              summary: result[:summary],
              warnings: result[:errors].any? ? result[:errors] : nil
            }
          else
            render json: {
              success: false,
              errors: result[:errors]
            }, status: :unprocessable_entity
          end
        rescue StandardError => e
          Rails.logger.error("SmTask import error: #{e.message}")
          Rails.logger.error(e.backtrace.join("\n"))

          render json: {
            success: false,
            error: "Import failed: #{e.message}"
          }, status: :unprocessable_entity
        ensure
          temp_file.close
          temp_file.unlink
        end
      end

      # GET /api/v1/jobs/:job_id/sm_tasks/upgrade_preview
      # Versioning has been removed - templates are now applied directly
      def upgrade_preview
        render json: {
          success: false,
          error: "Template versioning has been removed. Templates are now applied directly."
        }, status: :gone
      end

      # POST /api/v1/jobs/:job_id/sm_tasks/upgrade
      # Versioning has been removed - templates are now applied directly
      def upgrade
        render json: {
          success: false,
          error: "Template versioning has been removed. Templates are now applied directly."
        }, status: :gone
      end

      # GET /api/v1/constructions/:job_id/sm_tasks/gantt_data
      # DEPRECATED: Use GET /api/v1/jobs/:job_id/sm_tasks?for=gantt instead (SSoT)
      def gantt_data
        tasks = @job.sm_tasks.ordered.includes(
          :hold_reason, :supplier, :sm_schedule_master, purchase_order: :supplier
        )

        # SSoT: Use shared render_gantt_data helper
        render_gantt_data(tasks)
      end

      # POST /api/v1/jobs/:job_id/sm_tasks/validate_dates
      # Safety net: Runs rollover logic for this specific job on page load
      # SSoT: Reuses SmRolloverJob logic (THE ONE rollover implementation)
      def validate_dates
        # SSoT: Use SmRolloverJob for this specific job
        result = SmRolloverJob.perform_now(job_id: @job.id)

        render json: {
          success: true,
          rolled_over: result[:rolled_over] || 0,
          extended: result[:extended] || 0,
          cascaded: result[:cascaded] || 0
        }
      end

      # PATCH /api/v1/sm_tasks/:id
      def update
        @task.updated_by = current_user

        # Track if predecessor_ids is changing (for date recalculation)
        predecessor_ids_changing = params[:sm_task]&.key?(:predecessor_ids)

        if @task.update(sm_task_params)
          # Create notification if task was assigned to a new user
          notify_task_assignment(@task)

          # Recalculate dates if dependencies changed and task is not locked
          if predecessor_ids_changing && !@task.locked?
            recalculate_task_dates_from_predecessors(@task)
          end

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
          message: "Task deleted successfully"
        }
      end

      # POST /api/v1/sm_tasks/:id/recalculate_dates
      # Force recalculation of task dates from dependencies
      # Useful for fixing tasks where dependency dates weren't applied correctly
      def recalculate_dates
        if @task.locked?
          return render json: {
            success: false,
            error: "Cannot recalculate dates for locked task"
          }, status: :unprocessable_entity
        end

        if @task.predecessor_ids.empty?
          return render json: {
            success: false,
            error: "Task has no dependencies to calculate from"
          }, status: :unprocessable_entity
        end

        old_start = @task.start_date
        old_end = @task.end_date

        recalculate_task_dates_from_predecessors(@task)
        @task.reload

        render json: {
          success: true,
          message: "Dates recalculated from dependencies",
          old_dates: { start_date: old_start, end_date: old_end },
          new_dates: { start_date: @task.start_date, end_date: @task.end_date },
          sm_task: task_to_json(@task)
        }
      end

      # POST /api/v1/sm_tasks/bulk_update
      def bulk_update
        raw_task_ids = params[:task_ids]
        updates = params[:updates]&.permit(:status, :assigned_user_id, :trade, :stage)

        unless raw_task_ids.present? && updates.present?
          return render json: {
            success: false,
            error: "task_ids and updates are required"
          }, status: :unprocessable_entity
        end

        # Sanitize task_ids to prevent SQL injection - convert all to integers
        # This eliminates any possibility of SQL injection as only integers are used
        safe_task_ids = Array(raw_task_ids).map { |id| Integer(id) rescue nil }.compact.uniq

        if safe_task_ids.empty?
          return render json: {
            success: false,
            error: "No valid task IDs provided"
          }, status: :unprocessable_entity
        end

        # Safe to use in query - only contains validated integers
        # Brakeman warning can be ignored: task_ids sanitized with Integer() above
        updated_count = SmTask.where(id: safe_task_ids).update_all(updates.to_h.merge(updated_at: Time.current))

        render json: {
          success: true,
          updated_count: updated_count
        }
      end

      # POST /api/v1/sm_tasks/:id/start
      def start
        if @task.start!
          # Fire start workflow if configured
          SmTaskStartService.new(@task, user: current_user).start!

          render json: {
            success: true,
            message: "Task started",
            sm_task: task_to_json(@task)
          }
        else
          render json: {
            success: false,
            error: "Task cannot be started"
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/sm_tasks/:id/complete
      # Params:
      #   passed: boolean - for pass/fail tasks
      #   also_complete_task_ids: array of task IDs to cascade complete with this task
      #   delegation_response: string - response text for delegated questions/actions
      def complete
        passed = params[:passed].nil? ? nil : ActiveModel::Type::Boolean.new.cast(params[:passed])
        also_complete_task_ids = Array(params[:also_complete_task_ids]).map(&:to_i).compact

        # Set delegation_response on the task if provided (for delegated questions/actions)
        # This will be used by the handle_delegation_completion callback
        if params[:delegation_response].present? && @task.is_delegated_question?
          @task.delegation_response = params[:delegation_response]
        end

        service = SmTaskCompletionService.new(@task, user: current_user)
        result = service.complete(passed: passed, also_complete_task_ids: also_complete_task_ids)

        if result[:success]
          render json: {
            success: true,
            message: "Task completed",
            sm_task: task_to_json(result[:task]),
            spawned_tasks: result[:spawned_tasks].map { |t| task_to_json(t) },
            cascade_completed_tasks: (result[:cascade_completed_tasks] || []).map { |t| task_to_json(t) }
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
            error: "Hold reason is required"
          }, status: :unprocessable_entity
        end

        hold_reason = SmHoldReason.active.find_by(id: params[:hold_reason_id])
        unless hold_reason
          return render json: {
            success: false,
            error: "Hold reason not found"
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
          action: "hold",
          hold_reason: hold_reason,
          notes: params[:hold_notes],
          performed_by: current_user
        )

        render json: {
          success: true,
          message: "Task placed on hold",
          sm_task: task_to_json(@task)
        }
      end

      # POST /api/v1/sm_tasks/:id/release_hold
      def release_hold
        unless @task.is_hold_task?
          return render json: {
            success: false,
            error: "Task is not on hold"
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
          action: "release",
          hold_reason: old_reason,
          notes: params[:release_notes],
          performed_by: current_user
        )

        render json: {
          success: true,
          message: "Hold released",
          sm_task: task_to_json(@task)
        }
      end

      # POST /api/v1/sm_tasks/:id/cascade_preview
      # Preview cascade effects before moving a task
      def cascade_preview
        unless params[:new_start_date].present?
          return render json: {
            success: false,
            error: "new_start_date is required"
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
            error: "new_start_date is required"
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
            message: "Cascade blocked by locked tasks. Please resolve conflicts."
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
            error: "Either file or url parameter is required"
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
            error: "Page not found"
          }, status: :not_found
        end

        unless params[:category].present?
          return render json: {
            success: false,
            error: "category parameter is required"
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
          message: "Category overridden",
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

      # ===== Task Attachments =====

      # GET /api/v1/sm_tasks/:id/attachments
      def attachments
        attachments = @task.sm_task_attachments.includes(:attachable, :added_by).recent

        render json: {
          success: true,
          attachments: attachments.map { |a| attachment_to_json(a) }
        }
      end

      # POST /api/v1/sm_tasks/:id/attachments
      def add_attachment
        attachment_type = params[:attachment_type]
        attachable_id = params[:attachable_id]

        attachable = case attachment_type
        when "email"
          EmailWarehouse.find(attachable_id)
        when "document"
          CorporateCompanyDocument.find(attachable_id)
        else
          return render json: { success: false, error: "Invalid attachment type" }, status: :unprocessable_entity
        end

        attachment = @task.sm_task_attachments.create!(
          attachable: attachable,
          attachment_type: attachment_type,
          notes: params[:notes],
          added_by: current_user
        )

        render json: {
          success: true,
          attachment: attachment_to_json(attachment)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Attachable not found" }, status: :not_found
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # DELETE /api/v1/sm_tasks/:id/attachments/:attachment_id
      def remove_attachment
        attachment = @task.sm_task_attachments.find(params[:attachment_id])
        attachment.destroy

        render json: { success: true, message: "Attachment removed" }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Attachment not found" }, status: :not_found
      end

      # POST /api/v1/sm_tasks/:id/attachments/upload
      # Upload a file and attach it to the task
      # Params:
      #   - file: The file to upload (required)
      #   - category: "info" or "response" (default: "info")
      #   - notes: Optional notes
      # ALL files upload to SharePoint (enables sharing links for email):
      #   - Tasks with job → /Jobs/{code}/{category}/{filename}
      #   - Standalone tasks → /Tasks/Task-{id}/{category}/{filename}
      # Falls back to ActiveStorage only if SharePoint is not configured.
      def upload_attachment
        unless params[:file].present?
          return render json: { success: false, error: "No file provided" }, status: :bad_request
        end

        file = params[:file]
        category = params[:category] || "info"

        begin
          # Always upload to SharePoint (enables sharing links for email)
          # Falls back to ActiveStorage only if SharePoint isn't configured
          if StorageConfiguration.instance&.connected?
            upload_to_sharepoint(file, category)
          else
            upload_standard_file(file, category)
          end
        rescue TaskResponseUploader::UploadError => e
          Rails.logger.error "[SmTasksController#upload_attachment] Response upload failed: #{e.message}"
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        rescue => e
          Rails.logger.error "[SmTasksController#upload_attachment] Failed: #{e.message}"
          render json: { success: false, error: "Upload failed: #{e.message}" }, status: :unprocessable_entity
        end
      end

      # Upload file to SharePoint and create SmTaskAttachment
      # Uses TaskResponseUploader which handles folder paths:
      #   - Tasks with job → /Jobs/{code}/{category}/{filename}
      #   - Standalone tasks → /Tasks/Task-{id}/{category}/{filename}
      # Category determines subfolder: "response" → Responses, other → Task Attachments
      def upload_to_sharepoint(file, category)
        uploader = TaskResponseUploader.new(job: @task.job, task: @task, category: category)
        result = uploader.upload(file)
        doc = uploader.create_document_record(result, file)

        attachment = @task.sm_task_attachments.create!(
          attachable: doc,
          attachment_type: "document",
          category: category,
          notes: params[:notes],
          added_by: current_user,
          action_item_id: params[:action_item_id]
        )

        render json: {
          success: true,
          attachment: attachment_to_json(attachment).merge(
            sharepoint_url: result[:sharepoint_url],
            action_item_id: attachment.action_item_id
          )
        }
      end

      # Standard file upload using ActiveStorage
      # Creates a CorporateCompanyDocument record to track the file
      def upload_standard_file(file, category)
        # Create a document record for the uploaded file
        # Document ownership: job_id OR contact_id (for personal tasks)
        doc_attrs = {
          file_name: file.original_filename,
          display_name: file.original_filename,
          document_type: "other",
          filed_by: current_user&.name,
          uploaded_at: Time.current
        }

        # SSoT: Task is the primary owner for task attachments
        doc_attrs[:sm_task_id] = @task.id

        # Also set secondary owner if available (for cross-referencing)
        if @task.job_id.present?
          doc_attrs[:job_id] = @task.job_id
        elsif @task.supplier_id.present?
          doc_attrs[:contact_id] = @task.supplier_id
        elsif current_user&.contact_id.present?
          doc_attrs[:contact_id] = current_user.contact_id
        end

        doc = CorporateCompanyDocument.create!(doc_attrs)

        # Attach the file to the document
        doc.file.attach(file)

        # Create the task attachment linking to the document
        attachment = @task.sm_task_attachments.create!(
          attachable: doc,
          attachment_type: "document",
          category: category,
          notes: params[:notes],
          added_by: current_user,
          action_item_id: params[:action_item_id]
        )

        render json: {
          success: true,
          attachment: attachment_to_json(attachment).merge(
            action_item_id: attachment.action_item_id
          )
        }
      end

      # GET /api/v1/sm_tasks/:id/attachments/:attachment_id/download
      # Download file content for email attachment (returns base64)
      def download_attachment_for_email
        attachment = @task.sm_task_attachments.find(params[:attachment_id])
        document = attachment.attachable

        unless document.is_a?(CorporateCompanyDocument)
          return render json: { success: false, error: "Attachment is not a document" }, status: :unprocessable_entity
        end

        # Get file content from ActiveStorage or SharePoint
        content = if document.file.attached?
          document.file.download
        elsif document.file_url.present?
          begin
            response = HTTParty.get(document.file_url, timeout: 30)
            response.success? ? response.body : nil
          rescue => e
            Rails.logger.warn "[SmTasksController#download_attachment] Download failed: #{e.message}"
            nil
          end
        end

        unless content
          return render json: { success: false, error: "Could not download file content" }, status: :unprocessable_entity
        end

        render json: {
          success: true,
          filename: document.file_name || document.display_name || "attachment",
          content: Base64.strict_encode64(content),
          content_type: document.mime_type || "application/octet-stream"
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Attachment not found" }, status: :not_found
      end

      # POST /api/v1/sm_tasks/:id/attachments/:attachment_id/share_link
      # Create anonymous SharePoint sharing link ("Anyone with the link")
      def create_attachment_share_link
        attachment = @task.sm_task_attachments.find(params[:attachment_id])
        document = attachment.attachable

        unless document.is_a?(CorporateCompanyDocument) && document.sharepoint_file_id.present?
          return render json: { success: false, error: "File not on SharePoint" }, status: :unprocessable_entity
        end

        # Get SharePoint client
        credential = MicrosoftCredential.active_for_org(current_organization)
        unless credential
          return render json: { success: false, error: "SharePoint not configured" }, status: :unprocessable_entity
        end

        # Create anonymous sharing link using public method
        client = MicrosoftAppGraphClient.new(credential)
        result = client.create_share_link(
          drive_id: credential.drive_id,
          item_id: document.sharepoint_file_id,
          type: "view",
          scope: "anonymous"  # "Anyone with the link" - no login required
        )

        share_url = result[:url]

        if share_url.present?
          render json: { success: true, share_url: share_url }
        else
          render json: { success: false, error: "Failed to create sharing link" }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Attachment not found" }, status: :not_found
      rescue MicrosoftAppGraphClient::NotConnectedError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      rescue => e
        Rails.logger.error "[SmTasksController#create_attachment_share_link] Error: #{e.message}"
        render json: { success: false, error: "Failed to create sharing link" }, status: :internal_server_error
      end

      # ===== Task Followers =====

      # POST /api/v1/sm_tasks/:id/follow
      def follow
        follower = @task.follow_by(current_user)

        render json: {
          success: true,
          following: true,
          follower: {
            id: follower.id,
            user_id: current_user.id,
            followed_at: follower.followed_at
          }
        }
      end

      # DELETE /api/v1/sm_tasks/:id/unfollow
      def unfollow
        @task.unfollow_by(current_user)

        render json: {
          success: true,
          following: false
        }
      end

      # GET /api/v1/sm_tasks/:id/followers
      def followers
        followers = @task.task_followers.includes(:user).recent

        render json: {
          success: true,
          followers: followers.map { |f|
            {
              id: f.id,
              user_id: f.user_id,
              user_name: f.user.name,
              followed_at: f.followed_at
            }
          },
          following: @task.followed_by?(current_user)
        }
      end

      # POST /api/v1/sm_tasks/:id/followers
      # Add a specific user as a follower (for sharing private tasks)
      def add_follower
        unless @task.manageable_by?(current_user)
          return render json: { success: false, error: "Not authorized to share this task" }, status: :forbidden
        end

        user = User.find(params[:user_id])
        follower = @task.follow_by(user)

        render json: {
          success: true,
          follower: {
            id: follower.id,
            user_id: user.id,
            user_name: user.name,
            followed_at: follower.followed_at
          }
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "User not found" }, status: :not_found
      end

      # DELETE /api/v1/sm_tasks/:id/followers/:user_id
      # Remove a follower from the task
      def remove_follower
        unless @task.manageable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        follower = @task.task_followers.find_by(user_id: params[:user_id])
        if follower
          follower.destroy
          render json: { success: true }
        else
          render json: { success: false, error: "Follower not found" }, status: :not_found
        end
      end

      # ============================================
      # Task Contacts (email participants, assigned contacts/users)
      # ============================================

      # GET /api/v1/sm_tasks/:id/contacts
      def contacts
        task_contacts = @task.task_contacts.includes(:contact, :user, :added_by)

        render json: {
          success: true,
          contacts: task_contacts.map { |tc| task_contact_to_json(tc) }
        }
      end

      # POST /api/v1/sm_tasks/:id/contacts
      # Add a contact or user to the task
      def add_contact
        contact_type = params[:contact_type]  # 'user' or 'contact'
        role = params[:role] || "participant"

        tc = if contact_type == "user"
          user = User.find(params[:user_id])
          @task.add_contact(user, role: role, added_by: current_user)
        else
          contact = Contact.find(params[:contact_id])
          @task.add_contact(contact, role: role, added_by: current_user)
        end

        render json: {
          success: true,
          contact: task_contact_to_json(tc)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "User or contact not found" }, status: :not_found
      rescue ArgumentError => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # DELETE /api/v1/sm_tasks/:id/contacts/:contact_id
      def remove_contact
        tc = @task.task_contacts.find(params[:contact_id])
        tc.destroy

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Task contact not found" }, status: :not_found
      end

      # ============================================
      # Task History/Activity Log
      # ============================================

      # GET /api/v1/sm_tasks/:id/history
      def history
        logs = @task.activity_logs.recent.includes(:user).limit(50)

        render json: {
          success: true,
          history: logs.map { |log|
            {
              id: log.id,
              activity_type: log.activity_type,
              field_name: log.field_name,
              old_value: log.old_value,
              new_value: log.new_value,
              description: log.description,
              user_id: log.user_id,
              user_name: log.user&.name,
              created_at: log.created_at
            }
          }
        }
      end

      # ============================================
      # Action Items Endpoints
      # ============================================

      # POST /api/v1/sm_tasks/:id/action_items
      def create_action_item
        @task = SmTask.find(params[:id])

        unless @task.manageable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        item_type = params[:item_type] || 'action'
        item = @task.action_items.create!(
          text: params[:text],
          item_type: item_type,
          parent_item_id: params[:parent_item_id],
          position: params[:position] || @task.action_items.maximum(:position).to_i + 1,
          include_in_response: item_type == 'question'  # Questions default to included
        )

        render json: {
          success: true,
          action_item: action_item_to_json(item)
        }
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/sm_tasks/:id/action_items/bulk
      # Create multiple action items at once (e.g., from pasted questions)
      def bulk_create_action_items
        @task = SmTask.find(params[:id])

        unless @task.manageable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        items_data = params[:items] || []
        created_items = []
        max_position = @task.action_items.maximum(:position).to_i

        items_data.each_with_index do |item_data, index|
          item_type = item_data[:item_type] || 'action'
          item = @task.action_items.create!(
            text: item_data[:text],
            item_type: item_type,
            parent_item_id: item_data[:parent_item_id],
            position: max_position + index + 1,
            include_in_response: item_type == 'question'  # Questions default to included
          )
          created_items << action_item_to_json(item)
        end

        render json: {
          success: true,
          action_items: created_items
        }
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/sm_tasks/:id/action_items/:item_id/toggle
      def toggle_action_item
        @task = SmTask.find(params[:id])
        item = @task.action_items.find(params[:item_id])

        item.toggle!(current_user)

        render json: {
          success: true,
          action_item: action_item_to_json(item)
        }
      end

      # DELETE /api/v1/sm_tasks/:id/action_items/:item_id
      def destroy_action_item
        @task = SmTask.find(params[:id])

        unless @task.manageable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        item = @task.action_items.find(params[:item_id])
        item.destroy

        render json: { success: true }
      end

      # PATCH /api/v1/sm_tasks/:id/action_items/:item_id
      def update_action_item
        @task = SmTask.find(params[:id])

        unless @task.manageable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        item = @task.action_items.find(params[:item_id])

        # Build update attributes
        update_attrs = {}
        update_attrs[:text] = params[:text] if params.key?(:text)
        update_attrs[:item_type] = params[:item_type] if params.key?(:item_type)
        update_attrs[:include_in_response] = params[:include_in_response] if params.key?(:include_in_response)
        update_attrs[:parent_item_id] = params[:parent_item_id] if params.key?(:parent_item_id)
        update_attrs[:position] = params[:position] if params.key?(:position)

        item.update!(update_attrs)

        render json: {
          success: true,
          action_item: action_item_to_json(item)
        }
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/sm_tasks/:id/action_items/:item_id/answer
      # Answer a question-type action item
      def answer_action_item
        @task = SmTask.find(params[:id])
        item = @task.action_items.find(params[:item_id])

        unless item.question?
          return render json: { success: false, error: "Can only answer question items" }, status: :unprocessable_entity
        end

        item.answer!(params[:response], current_user)

        render json: {
          success: true,
          action_item: action_item_to_json(item)
        }
      end

      # POST /api/v1/sm_tasks/:id/action_items/:item_id/delegate
      # Delegate a question to another user by creating a sub-task
      def delegate_action_item
        @task = SmTask.find(params[:id])
        item = @task.action_items.find(params[:item_id])

        user = User.find(params[:user_id])

        result = item.delegate_to!(user, created_by: current_user)

        if result[:success]
          render json: {
            success: true,
            action_item: action_item_to_json(item.reload),
            delegated_task: task_to_json(result[:task])
          }
        else
          render json: { success: false, error: result[:error] }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/sm_tasks/:id/action_items/reorder
      # Reorder action items and update their parent relationships
      def reorder_action_items
        @task = SmTask.find(params[:id])

        unless @task.manageable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        items_data = params[:items] || []
        items_data.each do |item_data|
          item = @task.action_items.find(item_data[:id])
          item.update!(
            position: item_data[:position],
            parent_item_id: item_data[:parent_item_id]
          )
        end

        render json: { success: true }
      rescue ActiveRecord::RecordNotFound => e
        render json: { success: false, error: "Item not found" }, status: :not_found
      rescue ActiveRecord::RecordInvalid => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # PATCH /api/v1/sm_tasks/:id/privacy
      def update_privacy
        @task = SmTask.find(params[:id])

        unless @task.manageable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        @task.update!(is_private: params[:is_private])

        render json: {
          success: true,
          is_private: @task.is_private
        }
      end

      # GET /api/v1/sm_tasks/:id/compare_to_template
      # Compare a task to its linked template row
      def compare_to_template
        template_row = @task.sm_schedule_master

        unless template_row
          render json: {
            success: true,
            comparison: {
              task: task_comparison_json(@task),
              template_row: nil,
              differences: {},
              can_sync: false,
              skip_reason: "Not linked to template"
            }
          }
          return
        end

        # Calculate differences using sync service logic
        differences = calculate_row_differences(@task, template_row)

        # Check if task can be synced
        can_sync = !task_has_job_reality?(@task)
        skip_reason = can_sync ? nil : build_skip_reason(@task)

        render json: {
          success: true,
          comparison: {
            task: task_comparison_json(@task),
            template_row: template_row_comparison_json(template_row),
            differences: differences,
            can_sync: can_sync,
            skip_reason: skip_reason
          }
        }
      end

      # POST /api/v1/sm_tasks/:id/sync_from_template
      # Sync a single task from its linked template row
      def sync_from_template
        template_row = @task.sm_schedule_master

        unless template_row
          render json: {
            success: false,
            error: "Task is not linked to a template row"
          }, status: :unprocessable_entity
          return
        end

        # Check if task can be synced
        if task_has_job_reality?(@task)
          render json: {
            success: false,
            error: "Task has job-level changes (#{build_skip_reason(@task)}) and cannot be synced"
          }, status: :unprocessable_entity
          return
        end

        # Use the sync service to sync this single row
        job = @task.job
        result = SmScheduleMasterSyncService.new(job, template_row, user: current_user).sync!

        if result[:success]
          render json: {
            success: true,
            message: result[:message] || "Task synced from template",
            action: result[:action],
            changes: result[:changes] || {}
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/sm_tasks/from_email/:email_id
      # Creates a standalone task from an email (same as forwarding to newtask@tekna.com.au)
      # Uses EmailToTaskService for consistent behavior
      def create_from_email
        email = EmailWarehouse.find_by(id: params[:email_id])

        unless email
          return render json: {
            success: false,
            error: "Email not found"
          }, status: :not_found
        end

        service = EmailToTaskService.new(email, user: current_user)
        task = service.create_task

        render json: {
          success: true,
          message: "Task created from email",
          sm_task: task_to_json(task)
        }, status: :created
      rescue EmailToTaskService::TaskCreationError => e
        render json: {
          success: false,
          error: "Failed to create task: #{e.message}"
        }, status: :unprocessable_entity
      end

      private

      # Parse user counts from SQL result, ensuring valid integer IDs
      # Handles edge cases where raw SQL might return unexpected values
      def parse_user_counts(result)
        result.to_a.each_with_object({}) do |row, hash|
          raw_id = row["assigned_user_id"]
          # Skip nil, empty strings, or non-numeric values
          next if raw_id.nil? || raw_id.to_s.strip.empty?

          begin
            user_id = Integer(raw_id)
            next if user_id <= 0
            hash[user_id] = row["count"].to_i
          rescue ArgumentError, TypeError
            # Log unexpected value types for debugging
            Rails.logger.warn "[user_counts] Skipped invalid user_id: #{raw_id.inspect} (#{raw_id.class})"
          end
        end
      end

      def parse_role_counts(result)
        result.to_a.each_with_object({}) do |row, hash|
          raw_id = row["assigned_role"]
          next if raw_id.nil? || raw_id.to_s.strip.empty?

          begin
            role_id = Integer(raw_id)
            next if role_id <= 0
            hash[role_id] = { name: row["role_name"], count: row["count"].to_i }
          rescue ArgumentError, TypeError
            Rails.logger.warn "[user_counts] Skipped invalid role_id: #{raw_id.inspect} (#{raw_id.class})"
          end
        end
      end

      # Helper to serialize TaskContact for API response
      def task_contact_to_json(tc)
        {
          id: tc.id,
          role: tc.role,
          is_sender: tc.is_sender,
          notes: tc.notes,
          created_at: tc.created_at,
          added_by: tc.added_by&.name,
          person_name: tc.person_name,
          person_email: tc.person_email,
          type: tc.user_id.present? ? "user" : "contact",
          user_id: tc.user_id,
          contact_id: tc.contact_id,
          user: tc.user ? { id: tc.user.id, name: tc.user.name, email: tc.user.email } : nil,
          contact: tc.contact ? { id: tc.contact.id, name: tc.contact.display_name, email: tc.contact.email } : nil
        }
      end

      # Helper methods for compare_to_template
      def task_comparison_json(task)
        {
          id: task.id,
          task_number: task.task_number,
          name: task.name,
          description: task.description,
          duration_days: task.duration_days,
          trade: task.trade,
          stage: task.stage,
          status: task.status,
          require_photo: task.require_photo,
          po_required: task.po_required,
          critical_po: task.critical_po,
          order_time_days: task.order_time_days,
          call_time_days: task.call_time_days,
          checklist_id: task.checklist_id,
          sm_schedule_master_id: task.sm_schedule_master_id
        }
      end

      def template_row_comparison_json(row)
        {
          id: row.id,
          task_number: row.task_number,
          name: row.name,
          description: row.description,
          duration_days: row.duration_days,
          trade: row.trade,
          stage: row.stage,
          require_photo: row.require_photo,
          po_required: row.po_required,
          critical_po: row.critical_po,
          order_time_days: row.order_time_days,
          call_time_days: row.call_time_days,
          checklist_id: row.checklist_id
        }
      end

      def calculate_row_differences(task, template_row)
        differences = {}
        syncable_fields = SmScheduleMasterSyncService.syncable_fields

        syncable_fields.each do |field|
          next unless template_row.respond_to?(field) && task.respond_to?(field)

          template_value = template_row.send(field)
          task_value = task.send(field)

          # Only show difference if template has a value and it differs
          if template_value.present? && template_value != task_value
            differences[field.to_s] = {
              template: template_value,
              task: task_value
            }
          end
        end

        differences
      end

      def task_has_job_reality?(task)
        task.status.in?(%w[started completed]) ||
          task.started_at.present? ||
          task.completed_at.present? ||
          task.supplier_confirm == true ||
          task.confirm == true ||
          task.hold == true
      end

      def build_skip_reason(task)
        reasons = []
        reasons << "completed" if task.status == "completed" || task.completed_at.present?
        reasons << "started" if task.status == "started" || task.started_at.present?
        reasons << "supplier confirmed" if task.supplier_confirm == true
        reasons << "confirmation locked" if task.confirm == true
        reasons << "on hold" if task.hold == true
        reasons.join(", ")
      end

      def set_job
        @job = Job.find(params[:job_id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Construction job not found"
        }, status: :not_found
      end

      # Optional job lookup - allows creating tasks without a job
      def set_job_optional
        @job = Job.find_by(id: params[:job_id]) if params[:job_id].present?
      end

      def set_sm_task
        @task = SmTask.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Task not found"
        }, status: :not_found
      end

      def sm_task_params
        params.require(:sm_task).permit(
          # Core fields
          :name,
          :task_number,
          :status,
          :description,
          :notes,
          :color,
          :stage,
          :trade,

          # Schedule
          :start_date,
          :end_date,
          :duration_days,
          :required_by,
          :sequence_order,

          # Progress
          :progress_percentage,
          :started_at,
          :completed_at,

          # Assignments
          :assigned_user_id,
          :assigned_role,
          :supplier_id,
          :parent_task_id,
          :job_id,

          # Confirmation
          :confirm,
          :confirm_requested_at,
          :confirm_status,
          :require_confirm,
          :supplier_confirm,
          :supplier_confirmed_at,
          :supplier_confirmed_by_id,

          # Hold
          :hold,
          :hold_date,
          :hold_at,
          :hold_reason_id,
          :hold_release_reason,
          :hold_released_at,
          :hold_released_by_id,
          :hold_started_at,
          :hold_started_by_id,
          :is_hold_task,

          # Requirements (from template but overridable)
          :require_photo,
          :po_required,
          :critical_po,
          :checklist_id,
          :pass_fail_enabled,
          :passed,

          # Timing
          :order_time_days,
          :call_time_days,
          :order_reminder_sent,
          :call_reminder_sent,

          # Automation
          :spawn_call_task,
          :spawn_order_task,
          :spawn_scan_lag_days,
          :spawn_scan_task_id,

          # Task types
          :is_photo_task,
          :is_ticket,
          :ticket_category,
          :ticket_priority,
          :source_type,

          # Portal
          :customer_visible,
          :submitted_via_portal,

          # Recurring
          :recurring_sequence,
          :recurring_task_definition_id,

          # SLA
          :sla_first_response_at,
          :sla_resolution_due_at,
          :sla_response_due_at,

          # Template link
          :sm_schedule_master_id,

          # Other
          :searchable,
          :is_private,
          :email_keywords,

          # Workflow triggers
          :start_workflow_enabled, :start_workflow_id,
          :complete_workflow_enabled, :complete_workflow_id,

          # Completion document requirement
          :requires_document_to_complete, :completion_document_type_id,

          # Arrays
          linked_task_ids: [],
          # predecessor_ids is JSONB array of {id, type, lag} objects
          predecessor_ids: [:id, :type, :lag]
        )
      end

      def attachment_to_json(attachment)
        base = {
          id: attachment.id,
          attachment_type: attachment.attachment_type,
          category: attachment.category || "info",
          notes: attachment.notes,
          added_by: attachment.added_by&.name,
          created_at: attachment.created_at
        }

        case attachment.attachable_type
        when "EmailWarehouse"
          email = attachment.attachable
          # Defensive: attachable may be nil if email was deleted
          return base unless email
          base.merge(
            email: {
              id: email.id,
              subject: email.subject,
              from_email: email.from_email,
              from_name: email.from_name,
              to_emails: email.to_emails,
              received_at: email.received_at,
              has_attachments: email.document_attachments_count > 0,
              document_attachments_count: email.document_attachments_count,
              conversation_id: email.conversation_id,
              thread_count: email.thread_count,
              body_preview: email.body_preview || email.body_text&.truncate(200),
              attachment_content_hashes: email.email_attachments.pluck(:content_hash).compact
            }
          )
        when "CorporateCompanyDocument"
          doc = attachment.attachable
          # Defensive: attachable may be nil if document was deleted
          return base unless doc
          base.merge(
            document: {
              id: doc.id,
              file_name: doc.file_name,
              display_name: doc.display_name,
              document_type: doc.document_type,
              sharepoint_file_id: doc.sharepoint_file_id,
              sharepoint_download_url: doc.sharepoint_download_url,
              file_url: doc.file.attached? ? Rails.application.routes.url_helpers.rails_blob_url(doc.file, only_path: true) : nil,
              created_at: doc.created_at,
              content_hash: doc.content_hash
            }
          )
        else
          base
        end
      end

      def action_item_to_json(item)
        result = {
          id: item.id,
          text: item.text,
          item_type: item.item_type,
          checked: item.checked,
          position: item.position,
          checked_by_id: item.checked_by_id,
          checked_by_name: item.checked_by&.name,
          checked_at: item.checked_at,
          response: item.response,
          responded_by_id: item.responded_by_id,
          responded_by_name: item.responded_by&.name,
          responded_at: item.responded_at,
          include_in_response: item.include_in_response,
          # Header/sub-question hierarchy
          parent_item_id: item.parent_item_id,
          child_count: item.child_items.count,
          # Delegation info
          delegated: item.delegated?,
          delegated_task_id: item.delegated_task_id,
          # Response attachments for this question
          attachments: item.attachments.map { |att| attachment_to_json(att) }
        }

        # Include delegated task details if present
        # Defensive: use local var to avoid race condition between .present? and access
        if (delegated = item.delegated_task)
          result[:delegated_task] = {
            id: delegated.id,
            name: delegated.name,
            status: delegated.status,
            assigned_user_id: delegated.assigned_user_id,
            assigned_user_name: delegated.assigned_user&.name
          }
        end

        result
      end

      # Convert ActiveStorage file to attachment JSON format
      def file_attachment_to_json(file)
        {
          id: "file_#{file.id}",
          attachment_type: "upload",
          notes: nil,
          added_by: nil,
          created_at: file.created_at,
          document: {
            id: file.id,
            file_name: file.filename.to_s,
            display_name: file.filename.to_s,
            file_size: file.byte_size,
            content_type: file.content_type,
            document_type: "Upload",
            created_at: file.created_at,
            url: Rails.application.routes.url_helpers.rails_blob_path(file, only_path: true)
          }
        }
      end

      def save_temp_file(uploaded_file)
        temp_file = Tempfile.new([ "sm_task_import", File.extname(uploaded_file.original_filename) ])
        temp_file.binmode
        temp_file.write(uploaded_file.read)
        temp_file.rewind
        temp_file
      end

      # Generate unique task name for duplicates
      # If task "Req Bath" already exists:
      #   - Rename existing to "Req Bath 1"
      #   - Return "Req Bath 2" for new task
      def generate_unique_task_name(job, base_name)
        return base_name if base_name.blank?

        # Find all tasks with exact name or numbered variants
        existing_tasks = job.sm_tasks.where(
          "name = :exact OR name ~ :pattern",
          exact: base_name,
          pattern: "^#{Regexp.escape(base_name)} \\d+$"
        )

        return base_name if existing_tasks.empty?

        # Check if there's an unnumbered task that needs renaming
        unnumbered_task = existing_tasks.find_by(name: base_name)
        if unnumbered_task
          unnumbered_task.update_column(:name, "#{base_name} 1")
          Rails.logger.info "[SmTasksController] Renamed task #{unnumbered_task.id} to '#{base_name} 1' for duplicate numbering"
        end

        # Find the highest number used
        max_number = existing_tasks.pluck(:name).map do |name|
          if name == base_name
            1
          elsif name =~ /^#{Regexp.escape(base_name)} (\d+)$/
            $1.to_i
          else
            0
          end
        end.max || 0

        "#{base_name} #{max_number + 1}"
      end

      # Notify when an existing task's assignee changes (on update)
      def notify_task_assignment(task)
        # Only notify if assigned_user_id changed and there's a new assignee
        return unless task.saved_change_to_assigned_user_id?
        return if task.assigned_user_id.blank?

        # Don't notify if the user assigned it to themselves
        return if task.assigned_user_id == current_user&.id

        job_name = task.job&.name || "Unknown Job"

        Notification.create!(
          user_id: task.assigned_user_id,
          notification_type: "task_assigned",
          notifiable: task,
          title: "New task assigned: #{task.name}",
          message: "You've been assigned the task \"#{task.name}\" on job \"#{job_name}\"#{current_user ? " by #{current_user.name}" : ''}."
        )
      rescue StandardError => e
        Rails.logger.error("Failed to create task assignment notification: #{e.message}")
        # Don't fail the update if notification fails
      end

      # Notify when a new task is created with an assignee
      def notify_new_task_assignment(task)
        return if task.assigned_user_id.blank?

        # Don't notify if the user assigned it to themselves
        return if task.assigned_user_id == current_user&.id

        job_name = task.job&.name || "Unknown Job"

        Notification.create!(
          user_id: task.assigned_user_id,
          notification_type: "task_assigned",
          notifiable: task,
          title: "New task assigned: #{task.name}",
          message: "You've been assigned the task \"#{task.name}\" on job \"#{job_name}\"#{current_user ? " by #{current_user.name}" : ''}."
        )
      rescue StandardError => e
        Rails.logger.error("Failed to create task assignment notification: #{e.message}")
        # Don't fail the create if notification fails
      end

      # Recalculate task dates based on predecessor dependencies
      # SSoT: Uses same logic as SmCascadeService#calculate_successor_dates
      def recalculate_task_dates_from_predecessors(task)
        deps = task.active_predecessor_dependencies
        return if deps.empty?

        calendar = WorkingDaysCalculator.new(CorporateCompanySetting.instance)

        # Calculate the earliest valid start based on all predecessors
        earliest_start = deps.map do |dep|
          predecessor = dep.predecessor_task
          next nil unless predecessor

          case dep.dependency_type
          when "FS" # Finish-to-Start: successor starts after predecessor ends
            calendar.add_working_days(predecessor.end_date, dep.lag_days + 1)
          when "SS" # Start-to-Start: successor starts with/after predecessor starts
            calendar.add_working_days(predecessor.start_date, dep.lag_days)
          when "FF" # Finish-to-Finish: successor ends with/after predecessor ends
            target_end = calendar.add_working_days(predecessor.end_date, dep.lag_days)
            calendar.subtract_working_days(target_end, task.duration_days - 1)
          when "SF" # Start-to-Finish: successor ends with/after predecessor starts
            target_end = calendar.add_working_days(predecessor.start_date, dep.lag_days)
            calendar.subtract_working_days(target_end, task.duration_days - 1)
          else
            predecessor.end_date + 1.day
          end
        end.compact.max

        return unless earliest_start

        new_end = calendar.add_working_days(earliest_start, task.duration_days - 1)

        # Update task dates
        task.update!(
          start_date: earliest_start,
          end_date: new_end
        )

        Rails.logger.info "[SmTasksController] Recalculated dates for task #{task.id}: #{earliest_start} - #{new_end}"

        # Cascade to unlocked successors
        cascade_unlocked_successors(task, calendar)
      end

      # Recursively cascade date changes to unlocked successor tasks
      def cascade_unlocked_successors(task, calendar)
        task.active_successor_dependencies.each do |dep|
          successor = dep.successor_task
          next unless successor
          next if successor.locked?

          # Recalculate successor's dates
          recalculate_task_dates_from_predecessors(successor)
        end
      end

      def task_to_json_with_job(task)
        json = task_to_json(task)
        json[:job_id] = task.construction_id
        json[:job_name] = task.job&.name || "Unknown Job"
        json[:is_critical_path] = false # Placeholder - would need critical path calculation
        json[:blockers] = task.is_hold_task ? [ task.hold_notes ].compact : []

        # Additional fields for Task Hub
        json[:assigned_user_name] = task.assigned_user&.name
        json[:supplier_name] = task.supplier&.name
        json[:stage] = task.stage
        json[:assigned_role] = task.assigned_role
        # Required by date - use this for overdue calculation, fallback to end_date
        json[:required_by] = task.required_by
        due_date = task.required_by || task.end_date
        json[:is_overdue] = task.status != "completed" && due_date.present? && due_date < Date.current
        json[:days_until_due] = due_date.present? ? (due_date - Date.current).to_i : nil
        # Days overdue (positive number when overdue, nil otherwise)
        json[:days_overdue] = (task.status != "completed" && due_date.present? && due_date < Date.current) ? (Date.current - due_date).to_i : nil
        # Performance: Count from jsonb array directly (O(1), no queries)
        # Previously called active_predecessor/successor_dependencies.count which did N+1 queries
        json[:predecessor_count] = task.predecessor_ids.size
        # Successor count requires querying other tasks - skip for list view (not displayed in TaskHub)
        # Only calculate when needed (e.g., in show action with include_dependencies: true)
        json[:successor_count] = 0

        # Include predecessor_ids for Gantt dependency rendering
        json[:predecessor_ids] = task.predecessor_ids || []

        json
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
          hold: task.hold,
          # Hold
          is_hold_task: task.is_hold_task,
          hold_reason_id: task.hold_reason_id,
          hold_reason: task.hold_reason&.name,
          hold_notes: task.hold_notes,
          hold_started_at: task.hold_started_at,
          # Relations (SSoT: PO link via PurchaseOrder.sm_task_id)
          purchase_order_id: task.linked_purchase_order&.id,
          purchase_order_number: task.linked_purchase_order&.po_number,
          po_required: task.po_required,
          assigned_user_id: task.assigned_user_id,
          supplier_id: task.supplier_id,
          parent_task_id: task.parent_task_id,
          sequence_order: task.sequence_order,
          sm_schedule_master_id: task.sm_schedule_master_id,
          # Workflow triggers
          start_workflow_enabled: task.start_workflow_enabled,
          start_workflow_id: task.start_workflow_id,
          start_workflow_name: task.start_workflow&.name,
          start_workflow_fired: task.start_workflow_fired,
          complete_workflow_enabled: task.complete_workflow_enabled,
          complete_workflow_id: task.complete_workflow_id,
          complete_workflow_name: task.complete_workflow&.name,
          # Completion document requirement
          requires_document_to_complete: task.requires_document_to_complete,
          completion_document_type_id: task.completion_document_type_id,
          completion_document_type_name: task.completion_document_type&.display_name || task.completion_document_type&.name,
          # Computed
          started_at: task.started_at,
          completed_at: task.completed_at,
          created_at: task.created_at,
          updated_at: task.updated_at,
          # Required by date (independent of schedule)
          required_by: task.required_by,
          # Use .size instead of .count to use preloaded data (avoids N+1)
          attachments_count: task.sm_task_attachments.size + (task.files.attached? ? task.files.size : 0),
          # Include full attachments for task detail view (uses preloaded association)
          # Combines SmTaskAttachment records AND ActiveStorage files
          attachments: task.sm_task_attachments.map { |a| attachment_to_json(a) } +
            (task.files.attached? ? task.files.map { |f| file_attachment_to_json(f) } : []),
          # Privacy
          is_private: task.is_private,
          created_by_id: task.created_by_id,
          created_by_name: task.created_by&.name,
          # Last assigner (who assigned this task to current assignee)
          last_assigner_id: task.last_assigner&.id,
          last_assigner_name: task.last_assigner&.name,
          # Following status (for current user) - defensive nil check
          is_following: current_user ? task.followed_by?(current_user) : false,
          # Action items (checkable checklist items)
          action_items: task.action_items.map { |item| action_item_to_json(item) },
          # Email keywords for auto-matching
          email_keywords: task.email_keywords,
          # Delegation fields
          is_delegated_question: task.is_delegated_question,
          source_action_item_id: task.source_action_item&.id,
          parent_task_name: task.parent_task&.name
        }

        if include_dependencies
          json[:predecessor_dependencies] = task.active_predecessor_dependencies.filter_map do |dep|
            # Defensive: skip if predecessor_task is nil (deleted task)
            next unless dep.predecessor_task
            {
              id: dep.id,
              predecessor_task_id: dep.predecessor_task_id,
              predecessor_task_number: dep.predecessor_task.task_number,
              predecessor_task_name: dep.predecessor_task.name,
              dependency_type: dep.dependency_type,
              lag_days: dep.lag_days
            }
          end

          json[:successor_dependencies] = task.active_successor_dependencies.filter_map do |dep|
            # Defensive: skip if successor_task is nil (deleted task)
            next unless dep.successor_task
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
        # po_required visibility: task is visible if po_required=false OR has a PO linked
        # SSoT: Check PO link via has_linked_po? (PurchaseOrder.sm_task_id)
        po_required = task.po_required || false
        has_po = task.has_linked_po?
        is_visible = !po_required || has_po

        json = {
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
          color: task.hold_reason&.color,
          parent_id: task.parent_task_id,
          # PO-Task One Entity integration (SSoT: PurchaseOrder.sm_task_id)
          purchase_order_id: task.linked_purchase_order&.id,
          supplier_id: task.supplier_id,
          supplier_name: task.supplier&.name,
          # po_required visibility - invisible tasks are skipped in dependencies
          po_required: po_required,
          is_visible: is_visible,
          # SSoT: Include predecessor_ids for frontend dependency display
          predecessor_ids: task.predecessor_ids || []
        }

        # Include PO details when linked (One Entity concept)
        # SSoT: Uses linked_purchase_order (aliased as purchase_order for compatibility)
        po = task.linked_purchase_order
        if po.present?
          json[:purchase_order] = {
            id: po.id,
            po_number: po.purchase_order_number,
            status: po.status,
            total: po.total,
            supplier_name: po.supplier&.name,
            required_date: po.required_date
          }
        end

        json
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

      # Rewire dependencies to skip invisible tasks (po_required without PO)
      # If A → B → C and B is invisible, create A → C with combined lag
      # Uses BFS to find the visible predecessors/successors through invisible chains
      def rewire_dependencies_around_invisible(tasks, invisible_task_ids, task_by_id)
        return tasks.flat_map { |t| dependencies_to_gantt_format(t) } if invisible_task_ids.empty?

        # Build adjacency maps
        # predecessor_map: task_id -> [{ predecessor_id, type, lag }]
        # successor_map: task_id -> [{ successor_id, type, lag }]
        predecessor_map = Hash.new { |h, k| h[k] = [] }
        successor_map = Hash.new { |h, k| h[k] = [] }

        tasks.each do |task|
          task.active_predecessor_dependencies.each do |dep|
            predecessor_map[task.id] << {
              id: dep.predecessor_task_id,
              type: dep.dependency_type,
              lag: dep.lag_days || 0
            }
            successor_map[dep.predecessor_task_id] << {
              id: task.id,
              type: dep.dependency_type,
              lag: dep.lag_days || 0
            }
          end
        end

        # For each visible task, trace back through invisible predecessors to find visible ones
        rewired = []
        seen_pairs = Set.new

        tasks.each do |task|
          next if invisible_task_ids.include?(task.id)

          # BFS to find all visible predecessors (skipping invisible ones)
          visible_predecessors = find_visible_predecessors(
            task.id, predecessor_map, invisible_task_ids
          )

          visible_predecessors.each do |pred_info|
            pair_key = "#{pred_info[:id]}-#{task.id}"
            next if seen_pairs.include?(pair_key)
            seen_pairs.add(pair_key)

            rewired << {
              id: "rewired-#{pair_key}",
              source: pred_info[:id],
              target: task.id,
              type: pred_info[:type],
              lag: pred_info[:lag]
            }
          end
        end

        rewired
      end

      # BFS to find visible predecessors through invisible chains
      # Accumulates lag through the chain
      def find_visible_predecessors(task_id, predecessor_map, invisible_task_ids)
        result = []
        queue = predecessor_map[task_id].map { |p| p.dup }

        while queue.any?
          current = queue.shift
          pred_id = current[:id]

          if invisible_task_ids.include?(pred_id)
            # This predecessor is invisible - trace through to its predecessors
            predecessor_map[pred_id].each do |grandpred|
              # Accumulate lag and inherit dependency type from the first link
              queue << {
                id: grandpred[:id],
                type: current[:type], # Keep original dependency type
                lag: current[:lag] + grandpred[:lag]
              }
            end
          else
            # This predecessor is visible - add to results
            result << current
          end
        end

        result
      end

      # SSoT: Render gantt data with po_required filtering + dependency rewiring
      # Used by job_index?for=gantt and gantt_data endpoints
      # Uses GanttDataService for unified format (all dependencies use row.id, not task_number)
      def render_gantt_data(tasks)
        # SSoT: Calculate dates from dependencies (same service as templates)
        # Locked tasks keep stored dates, unlocked tasks recalculate from dependencies
        date_overrides = GanttDateCalculationService.new(tasks).calculate_date_map

        # Use GanttDataService for SSoT conversion of task_number -> row.id
        service = GanttDataService.new(tasks, filter_invisible: true, date_overrides: date_overrides)
        result = service.build_response

        render json: {
          success: true,
          gantt_data: {
            tasks: result[:tasks],
            dependencies: result[:dependencies]
          },
          meta: result[:meta].merge(
            construction_id: @job.id,
            settings: SmSetting.instance.slice(:rollover_time, :rollover_timezone, :rollover_enabled)
          )
        }
      end
    end
  end
end
