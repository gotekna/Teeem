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
        :follow, :unfollow, :followers, :add_follower, :remove_follower,
        :compare_to_template, :sync_from_template
      ]

      # GET /api/v1/sm_tasks (global - all tasks across jobs)
      # Performance: includes sm_task_attachments to avoid N+1 (200 queries → 1)
      def index
        @tasks = SmTask.ordered.includes(
          :job, :hold_reason, :purchase_order, :assigned_user, :supplier,
          :action_items,
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
        @tasks = @tasks.for_user_roles(current_user) if params[:mine] == "true"

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

      # GET /api/v1/jobs/:job_id/sm_tasks (nested under job)
      # SSoT: Use ?for=gantt to get filtered tasks with dependency rewiring
      # Performance: includes sm_task_attachments to avoid N+1
      # SSoT: sm_schedule_master needed for header_gantt lookup in GanttDataService
      def job_index
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
      def complete
        passed = params[:passed].nil? ? nil : ActiveModel::Type::Boolean.new.cast(params[:passed])

        service = SmTaskCompletionService.new(@task, user: current_user)
        result = service.complete(passed: passed)

        if result[:success]
          render json: {
            success: true,
            message: "Task completed",
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
      def upload_attachment
        unless params[:file].present?
          return render json: { success: false, error: "No file provided" }, status: :bad_request
        end

        file = params[:file]
        filename = file.original_filename
        content = file.read

        # Determine folder path - use job folder if task has job, otherwise general tasks folder
        if @task.job.present?
          folder_path = "TEEEM Jobs/#{@task.job.name}/Task Attachments"
        else
          folder_path = "TEEEM Tasks/Task #{@task.task_number}"
        end

        # Upload to SharePoint
        begin
          graph_client = MicrosoftAppGraphClient.for_org(current_user.organization)
          site_id = graph_client.default_site_id
          drive_id = graph_client.default_drive_id

          upload_result = graph_client.upload_file_content(
            site_id,
            drive_id,
            folder_path,
            filename,
            content
          )

          # Create a CorporateCompanyDocument record
          document = CorporateCompanyDocument.create!(
            file_name: filename,
            file_url: upload_result[:web_url],
            file_size: content.bytesize,
            mime_type: file.content_type,
            sharepoint_item_id: upload_result[:id],
            sharepoint_url: upload_result[:web_url],
            user: current_user,
            folder: "Task Attachments"
          )

          # Create the attachment link
          attachment = @task.sm_task_attachments.create!(
            attachable: document,
            attachment_type: "document",
            notes: params[:notes],
            added_by: current_user
          )

          render json: {
            success: true,
            attachment: attachment_to_json(attachment)
          }
        rescue => e
          Rails.logger.error "[SmTasksController#upload_attachment] Failed: #{e.message}"
          render json: { success: false, error: "Upload failed: #{e.message}" }, status: :unprocessable_entity
        end
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
      # Action Items Endpoints
      # ============================================

      # POST /api/v1/sm_tasks/:id/action_items
      def create_action_item
        @task = SmTask.find(params[:id])

        unless @task.manageable_by?(current_user)
          return render json: { success: false, error: "Not authorized" }, status: :forbidden
        end

        item = @task.action_items.create!(
          text: params[:text],
          position: params[:position] || @task.action_items.maximum(:position).to_i + 1
        )

        render json: {
          success: true,
          action_item: action_item_to_json(item)
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

      private

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

          # Arrays
          documentation_category_ids: [],
          linked_task_ids: [],
          # predecessor_ids is JSONB array of {id, type, lag} objects
          predecessor_ids: [:id, :type, :lag]
        )
      end

      def attachment_to_json(attachment)
        base = {
          id: attachment.id,
          attachment_type: attachment.attachment_type,
          notes: attachment.notes,
          added_by: attachment.added_by&.name,
          created_at: attachment.created_at
        }

        case attachment.attachable_type
        when "EmailWarehouse"
          email = attachment.attachable
          base.merge(
            email: {
              id: email.id,
              subject: email.subject,
              from_email: email.from_email,
              received_at: email.received_at,
              has_attachments: email.email_attachments.any?
            }
          )
        when "CorporateCompanyDocument"
          doc = attachment.attachable
          base.merge(
            document: {
              id: doc.id,
              file_name: doc.file_name,
              display_name: doc.display_name,
              document_type: doc.document_type,
              sharepoint_url: doc.sharepoint_url,
              created_at: doc.created_at
            }
          )
        else
          base
        end
      end

      def action_item_to_json(item)
        {
          id: item.id,
          text: item.text,
          checked: item.checked,
          position: item.position,
          checked_by_id: item.checked_by_id,
          checked_by_name: item.checked_by&.name,
          checked_at: item.checked_at
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
        json[:is_overdue] = task.status != "completed" && task.end_date.present? && task.end_date < Date.current
        json[:days_until_due] = task.end_date.present? ? (task.end_date - Date.current).to_i : nil
        # SSoT: Using jsonb-based methods (predecessor_ids column)
        json[:predecessor_count] = task.active_predecessor_dependencies.count
        json[:successor_count] = task.active_successor_dependencies.count

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
          # Computed
          started_at: task.started_at,
          completed_at: task.completed_at,
          created_at: task.created_at,
          updated_at: task.updated_at,
          # Required by date (independent of schedule)
          required_by: task.required_by,
          # Use .size instead of .count to use preloaded data (avoids N+1)
          attachments_count: task.sm_task_attachments.size,
          # Include full attachments for task detail view (uses preloaded association)
          attachments: task.sm_task_attachments.map { |a| attachment_to_json(a) },
          # Privacy
          is_private: task.is_private,
          created_by_id: task.created_by_id,
          # Action items (checkable checklist items)
          action_items: task.action_items.map { |item| action_item_to_json(item) }
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
        # Use GanttDataService for SSoT conversion of task_number -> row.id
        service = GanttDataService.new(tasks, filter_invisible: true)
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
