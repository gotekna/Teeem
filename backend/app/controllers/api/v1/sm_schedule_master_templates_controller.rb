# frozen_string_literal: true

module Api
  module V1
    class SmScheduleMasterTemplatesController < ApplicationController
      before_action :set_template, only: [ :show, :update, :destroy, :duplicate, :set_default, :copy_to_job, :reset_job_tasks, :sync_to_job, :compare_to_job, :analyze_matches, :apply_links, :delete_orphans, :copy, :import_rows, :gantt_data, :validate_dates ]

      # GET /api/v1/sm_schedule_master_templates
      # Params: include_inactive=true to include inactive templates
      def index
        @templates = if params[:include_inactive].present?
          SmScheduleMasterTemplate.ordered
        else
          SmScheduleMasterTemplate.active.ordered
        end

        render json: {
          success: true,
          sm_schedule_master_templates: @templates.map { |t| template_json(t) }
        }
      end

      # GET /api/v1/sm_schedule_master_templates/:id
      def show
        render json: {
          success: true,
          sm_schedule_master_template: template_json(@template, include_rows: true)
        }
      end

      # GET /api/v1/sm_schedule_master_templates/:id/gantt_data
      # SSoT: Returns Gantt-formatted data with dependencies converted to row.id format
      # This is THE SINGLE place that converts task_number references to row.id
      # Use ?show_all_po=true to show all PO required tasks (useful for template editing)
      def gantt_data
        all_records = @template.sm_schedule_master_rows.in_sequence.includes(:po_supplier).to_a
        puts "[gantt_data] Template: #{@template.name}, Total records: #{all_records.count}, show_all_po param: '#{params[:show_all_po]}'"

        # SSoT: Calculate dates from ALL records FIRST (before filtering)
        # This ensures the dependency chain is complete for accurate date calculations
        date_overrides = GanttDateCalculationService.new(all_records).calculate_date_map

        # SSoT: Pass ALL records to service, let service handle filtering
        # This ensures the lookup map is complete for dependency rewiring
        filter_po = params[:show_all_po] != "true"
        puts "[gantt_data] filter_po_tasks: #{filter_po}"

        service = GanttDataService.new(all_records, date_overrides: date_overrides, filter_po_tasks: filter_po)
        result = service.build_response

        render json: {
          success: true,
          gantt_data: {
            tasks: result[:tasks],
            dependencies: result[:dependencies]
          },
          meta: result[:meta].merge(
            template_id: @template.id,
            template_name: @template.name
          )
        }
      end

      # POST /api/v1/sm_schedule_master_templates
      def create
        @template = SmScheduleMasterTemplate.new(template_params)
        @template.created_by = current_user

        if @template.save
          render json: {
            success: true,
            sm_schedule_master_template: template_json(@template)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @template.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/sm_schedule_master_templates/:id
      def update
        @template.updated_by = current_user

        if @template.update(template_params)
          render json: {
            success: true,
            sm_schedule_master_template: template_json(@template)
          }
        else
          render json: {
            success: false,
            errors: @template.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_schedule_master_templates/:id
      def destroy
        # Soft delete by marking inactive
        @template.update!(is_active: false, updated_by: current_user)

        render json: { success: true, message: "Template archived" }
      end

      # POST /api/v1/sm_schedule_master_templates/:id/duplicate
      # Creates a copy of the template with all its rows
      def duplicate
        new_template = SmScheduleMasterTemplate.new(
          name: "#{@template.name} (Copy)",
          description: @template.description,
          is_default: false,
          is_active: true,
          created_by: current_user
        )

        if new_template.save
          # Copy all rows
          @template.sm_schedule_master_rows.in_sequence.each do |row|
            new_row = row.dup
            new_row.sm_template_ids = [new_template.id]
            new_row.save!
          end

          render json: {
            success: true,
            sm_schedule_master_template: template_json(new_template),
            message: "Template duplicated successfully"
          }, status: :created
        else
          render json: {
            success: false,
            errors: new_template.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/sm_schedule_master_templates/:id/set_default
      def set_default
        @template.update!(is_default: true)

        render json: {
          success: true,
          sm_schedule_master_template: template_json(@template)
        }
      end

      # POST /api/v1/sm_schedule_master_templates/:id/copy
      # Copy entire template to create a new independent template
      #
      # Params:
      #   name: Name for the new template (required)
      #   description: Description for the new template (optional)
      #
      def copy
        service = SmScheduleMasterCopyService.new(user: current_user)
        result = service.copy_template(
          @template,
          new_name: params[:name],
          description: params[:description]
        )

        if result[:success]
          render json: {
            success: true,
            template: template_json(result[:template]),
            rows_copied: result[:rows_copied],
            message: result[:message]
          }, status: :created
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/sm_schedule_master_templates/:id/import_rows
      # Import rows from another template into this template
      #
      # Params:
      #   source_template_id: ID of template to import from (required)
      #   row_ids: Array of row IDs to import (optional - imports all if not specified)
      #
      def import_rows
        source_template = SmScheduleMasterTemplate.find(params[:source_template_id])

        service = SmScheduleMasterCopyService.new(user: current_user)
        result = service.import_rows(
          source_template: source_template,
          target_template: @template,
          row_ids: params[:row_ids]
        )

        if result[:success]
          render json: {
            success: true,
            rows_imported: result[:rows_imported],
            skipped_rows: result[:skipped_rows],
            message: result[:message]
          }
        else
          render json: {
            success: false,
            error: result[:error]
          }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Source template not found"
        }, status: :not_found
      end

      # POST /api/v1/sm_schedule_master_templates/:id/copy_to_job
      # Copies the template to a job, creating SmTask records
      #
      # Params:
      #   job_id: ID of the job to copy to (required)
      #   start_date: Start date for the schedule (optional, defaults to today)
      #   clear_existing: Whether to clear existing tasks (optional, defaults to false)
      #
      def copy_to_job
        job = Job.find(params[:job_id])

        result = SmScheduleMasterTemplateCopyService.new(@template, job, {
          start_date: params[:start_date],
          user: current_user,
          clear_existing: params[:clear_existing] == true || params[:clear_existing] == "true"
        }).execute

        if result[:success]
          render json: {
            success: true,
            message: "Template copied successfully",
            summary: result[:summary],
            tasks_created: result[:tasks].count,
            dependencies_created: result[:dependencies].count,
            tasks_needing_pos: result[:tasks_needing_pos]
          }
        else
          render json: {
            success: false,
            errors: result[:errors]
          }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          errors: [ "Job not found" ]
        }, status: :not_found
      end

      # POST /api/v1/sm_schedule_master_templates/:id/reset_job_tasks
      # Nuclear reset: deletes ALL job tasks and re-syncs fresh from template
      # Preserves PO links by task_number - POs for removed task_numbers are unlinked
      #
      # Params:
      #   job_id: ID of the job to reset (required)
      #
      def reset_job_tasks
        job = Job.find(params[:job_id])

        service = SmTaskResetService.new(job, @template, user: current_user)

        # Optional: preview mode
        if params[:preview] == "true" || params[:preview] == true
          preview = service.preview
          return render json: {
            success: true,
            preview: true,
            current_task_count: preview[:current_task_count],
            template_task_count: preview[:template_task_count],
            po_links_to_preserve: preview[:po_links_to_preserve],
            po_links_to_orphan: preview[:po_links_to_orphan],
            orphaned_pos: preview[:orphaned_pos]
          }
        end

        result = service.reset!

        if result[:success]
          render json: {
            success: true,
            message: "Reset complete",
            tasks_deleted: result[:tasks_deleted],
            tasks_created: result[:tasks_created],
            po_links_preserved: result[:po_links_preserved],
            po_links_orphaned: result[:po_links_orphaned]
          }
        else
          render json: {
            success: false,
            errors: result[:errors]
          }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          errors: [ "Job not found" ]
        }, status: :not_found
      end

      # POST /api/v1/sm_schedule_master_templates/:id/sync_to_job
      # Syncs template changes to an existing job's tasks
      # - Skips tasks with "job reality" (started, completed, confirmed, etc.)
      # - Only updates safe fields (name, description, trade, etc.)
      # - Creates new tasks for template rows not yet in the job
      #
      # Params:
      #   job_id: ID of the job to sync to (required)
      #   force: Force update even protected tasks (optional, dangerous!)
      #
      def sync_to_job
        job = Job.find(params[:job_id])

        results = SmScheduleMasterSyncService.sync_all_for_job(job, @template, {
          user: current_user,
          force: params[:force] == true || params[:force] == "true"
        })

        render json: {
          success: true,
          message: "Template synced to job",
          summary: {
            created: results[:created],
            updated: results[:updated],
            skipped: results[:skipped],
            unchanged: results[:unchanged],
            errors: results[:errors].count
          },
          skipped_tasks: results[:skipped_tasks],
          errors: results[:errors]
        }
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          errors: [ "Job not found" ]
        }, status: :not_found
      end

      # GET /api/v1/sm_schedule_master_templates/:id/compare_to_job
      # Compares template rows with a job's tasks to show differences
      #
      # Params:
      #   job_id: ID of the job to compare with (required)
      #
      # Returns array of comparisons with status and differences
      #
      def compare_to_job
        job = Job.find(params[:job_id])

        comparisons = SmScheduleMasterSyncService.compare_for_job(job, @template)

        # Find unlinked tasks (orphans - tasks with no template link)
        unlinked_tasks = job.sm_tasks.where(sm_schedule_master_id: nil).map do |task|
          {
            task_id: task.id,
            task_number: task.task_number,
            name: task.name,
            status: task.status,
            started_at: task.started_at,
            completed_at: task.completed_at
          }
        end

        # Calculate summary counts
        summary = {
          will_create: comparisons.count { |c| c[:status] == "will_create" },
          will_update: comparisons.count { |c| c[:status] == "will_update" },
          will_skip: comparisons.count { |c| c[:status] == "will_skip" },
          unchanged: comparisons.count { |c| c[:status] == "unchanged" },
          unlinked: unlinked_tasks.count,
          total: comparisons.count
        }

        render json: {
          success: true,
          template_id: @template.id,
          template_name: @template.name,
          job_id: job.id,
          job_name: job.name,
          summary: summary,
          comparisons: comparisons,
          unlinked_tasks: unlinked_tasks
        }
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          errors: [ "Job not found" ]
        }, status: :not_found
      end

      # GET /api/v1/sm_schedule_master_templates/:id/analyze_matches
      # Analyze potential matches between template rows and unlinked job tasks
      # Uses intelligent fuzzy matching to suggest links
      #
      # Params:
      #   job_id: ID of the job to analyze (required)
      #
      # Returns:
      #   auto_link: Tasks that will be automatically linked (95%+ match)
      #   needs_confirmation: Tasks that need user confirmation (65-95% match)
      #   will_create: Template rows with no match (will create new tasks)
      #   already_linked: Count of already linked tasks
      #   unlinked_tasks: Job tasks with no match (orphans)
      #
      def analyze_matches
        job = Job.find(params[:job_id])

        analysis = SmScheduleMasterSyncService.analyze_matches_for_job(job, @template)

        render json: {
          success: true,
          template_id: @template.id,
          template_name: @template.name,
          job_id: job.id,
          job_name: job.name,
          analysis: analysis,
          summary: {
            auto_link_count: analysis[:auto_link].count,
            needs_confirmation_count: analysis[:needs_confirmation].count,
            will_create_count: analysis[:will_create].count,
            already_linked_count: analysis[:already_linked],
            orphan_count: analysis[:unlinked_tasks].count
          }
        }
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          errors: [ "Job not found" ]
        }, status: :not_found
      end

      # POST /api/v1/sm_schedule_master_templates/:id/apply_links
      # Apply confirmed links between template rows and job tasks
      # Call this before sync_to_job to link unlinked tasks first
      #
      # Params:
      #   job_id: ID of the job (required)
      #   links: Array of { template_row_id: X, task_id: Y } (required)
      #
      def apply_links
        job = Job.find(params[:job_id])
        links = params[:links] || []

        result = SmScheduleMasterSyncService.apply_links!(job, links, user: current_user)

        render json: {
          success: true,
          linked: result[:linked],
          errors: result[:errors],
          message: "Linked #{result[:linked]} tasks to template rows"
        }
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          errors: [ "Job not found" ]
        }, status: :not_found
      end

      # POST /api/v1/sm_schedule_master_templates/:id/delete_orphans
      # Delete orphan tasks (tasks in job with no matching template row)
      #
      # Params:
      #   job_id: ID of the job (required)
      #   task_ids: Array of task IDs to delete (required)
      #
      def delete_orphans
        job = Job.find(params[:job_id])
        task_ids = params[:task_ids] || []

        Rails.logger.info "[SmScheduleMasterTemplatesController] delete_orphans called for job #{job.id} with #{task_ids.count} task IDs: #{task_ids.inspect}"

        deleted = 0
        errors = []

        task_ids.each do |task_id|
          task = job.sm_tasks.find_by(id: task_id)
          if task.nil?
            errors << "Task #{task_id} not found"
            Rails.logger.warn "[SmScheduleMasterTemplatesController] Task #{task_id} not found in job #{job.id}"
            next
          end

          # Safety check: only delete unlinked tasks (orphans)
          if task.sm_schedule_master_id.present?
            errors << "Task #{task_id} (#{task.name}) is linked to template row #{task.sm_schedule_master_id} - skipped"
            Rails.logger.info "[SmScheduleMasterTemplatesController] Skipped task #{task_id} (#{task.name}) - linked to template row #{task.sm_schedule_master_id}"
            next
          end

          # Safety check: don't delete tasks with job reality (use SmTask.locked? + timestamps)
          # locked? checks: supplier_confirm, confirm, started, completed, hold
          if task.locked? || task.started_at.present? || task.completed_at.present?
            reason = []
            reason << "lock_type=#{task.lock_type}" if task.locked?
            reason << "started_at=#{task.started_at}" if task.started_at.present?
            reason << "completed_at=#{task.completed_at}" if task.completed_at.present?
            errors << "Task #{task_id} (#{task.name}) has job reality (#{reason.join(', ')}) - skipped"
            Rails.logger.info "[SmScheduleMasterTemplatesController] Skipped task #{task_id} (#{task.name}) due to job reality: #{reason.join(', ')}"
            next
          end

          begin
            task.destroy!
            deleted += 1
            Rails.logger.info "[SmScheduleMasterTemplatesController] Deleted orphan task #{task_id} (#{task.name}) from job #{job.id}"
          rescue StandardError => e
            Rails.logger.error "[SmScheduleMasterTemplatesController] Failed to delete task #{task_id}: #{e.class} - #{e.message}"
            errors << "Task #{task_id} (#{task.name}) failed to delete: #{e.message}"
          end
        end

        render json: {
          success: true,
          deleted: deleted,
          errors: errors,
          message: "Deleted #{deleted} orphan tasks"
        }
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          errors: [ "Job not found" ]
        }, status: :not_found
      rescue StandardError => e
        Rails.logger.error "[SmScheduleMasterTemplatesController] delete_orphans error: #{e.class} - #{e.message}"
        Rails.logger.error e.backtrace.first(10).join("\n")
        render json: {
          success: false,
          errors: [ "Server error: #{e.message}" ]
        }, status: :internal_server_error
      end

      # POST /api/v1/sm_schedule_master_templates/:id/validate_dates
      # Recalculates template row dates to ensure they fall on working days
      # SSoT: Uses WorkingDaysCalculator (same as SmRolloverJob)
      #
      # Params:
      #   start_date: Base start date for calculations (optional, defaults to today)
      # Single-pass algorithm using topological sort
      # Headers don't exist for scheduling - build schedule without headers, then add header spans
      def validate_dates
        start_date = params[:start_date].present? ? Date.parse(params[:start_date]) : Date.current
        calendar = WorkingDaysCalculator.new(CorporateCompanySetting.instance)

        # Ensure start_date is a working day
        start_date = calendar.next_working_day(start_date) unless calendar.working_day?(start_date)

        rows = @template.sm_schedule_master_rows.in_sequence
        rows_by_task = rows.index_by(&:task_number)

        # Build parent -> children map for header spans later
        all_children = {}
        rows.each do |row|
          parent_id = extract_header_parent(row.header_gantt)
          if parent_id
            all_children[parent_id] ||= []
            all_children[parent_id] << row
          end
        end

        # Determine header levels for bottom-up processing
        header_level = {}
        rows.select(&:allow_header).each do |header|
          children = all_children[header.task_number] || []
          has_header_child = children.any?(&:allow_header)
          header_level[header.task_number] = has_header_child ? 1 : 2
        end

        # Helper: Get all inherited predecessors by walking up the header chain
        get_inherited_predecessors = ->(row) {
          inherited = []
          current_parent_id = extract_header_parent(row.header_gantt)

          while current_parent_id
            parent = rows_by_task[current_parent_id]
            break unless parent

            if parent.predecessor_ids.present?
              inherited.concat(parent.predecessor_ids)
            end

            current_parent_id = extract_header_parent(parent.header_gantt)
          end

          inherited
        }

        # Get all non-header tasks
        tasks = rows.reject(&:allow_header)
        task_numbers = tasks.map(&:task_number).to_set
        header_numbers = rows.select(&:allow_header).map(&:task_number).to_set

        # Helper: Get all tasks under a header (recursively, including nested headers)
        get_tasks_under_header = ->(header_task_number) {
          result = []
          children = all_children[header_task_number] || []
          children.each do |child|
            if child.allow_header
              # Recurse into nested headers
              result.concat(get_tasks_under_header.call(child.task_number))
            else
              result << child.task_number
            end
          end
          result
        }

        # Build dependency graph (own + inherited predecessors)
        # If a predecessor is a header, expand to all tasks under that header
        all_deps = {}
        tasks.each do |row|
          deps = (row.predecessor_ids || []).map { |p| p.is_a?(Hash) ? (p['id'] || p[:id]) : p }
          inherited = get_inherited_predecessors.call(row).map { |p| p.is_a?(Hash) ? (p['id'] || p[:id]) : p }

          # Expand header predecessors to their child tasks
          expanded_deps = []
          (deps + inherited).map(&:to_i).uniq.each do |dep_id|
            if header_numbers.include?(dep_id)
              # Header predecessor: expand to all tasks under this header
              expanded_deps.concat(get_tasks_under_header.call(dep_id))
            elsif task_numbers.include?(dep_id)
              # Task predecessor: use directly
              expanded_deps << dep_id
            end
            # Ignore external predecessors (not in this template)
          end

          all_deps[row.task_number] = expanded_deps.uniq
        end

        # Topological sort using Kahn's algorithm
        # Count incoming edges for each task
        in_degree = {}
        tasks.each { |t| in_degree[t.task_number] = 0 }

        all_deps.each do |_task, deps|
          # We need to count how many tasks depend on each predecessor
        end

        # Build reverse dependency map: for each task, which tasks depend on it
        dependents = Hash.new { |h, k| h[k] = [] }
        all_deps.each do |task, deps|
          deps.each do |dep|
            dependents[dep] << task
          end
        end

        # Calculate in-degree (number of predecessors) for each task
        all_deps.each do |task, deps|
          in_degree[task] = deps.size
        end

        # Start with tasks that have no predecessors (in_degree = 0)
        queue = tasks.select { |t| in_degree[t.task_number] == 0 }
        sorted_tasks = []

        while queue.any?
          # Take task with lowest sequence number for deterministic ordering
          task = queue.min_by(&:sequence_order)
          queue.delete(task)
          sorted_tasks << task

          # For each task that depends on this one, decrement its in-degree
          dependents[task.task_number].each do |dependent_task_num|
            in_degree[dependent_task_num] -= 1
            if in_degree[dependent_task_num] == 0
              dependent_task = tasks.find { |t| t.task_number == dependent_task_num }
              queue << dependent_task if dependent_task
            end
          end
        end

        # If sorted_tasks doesn't include all tasks, there's a cycle - add remaining in sequence order
        if sorted_tasks.size < tasks.size
          remaining = tasks - sorted_tasks
          sorted_tasks.concat(remaining.sort_by(&:sequence_order))
        end

        # SINGLE PASS: Calculate dates in topological order
        date_map = {}

        sorted_tasks.each do |row|
          # Handle held tasks first
          if row.hold && row.hold_date.present?
            row_start = row.hold_date.to_date
            row_start = calendar.next_working_day(row_start) unless calendar.working_day?(row_start)
            duration = row.duration_days || 1
            row_end = calendar.add_working_days(row_start, duration - 1)
            date_map[row.task_number] = { start_date: row_start, end_date: row_end }
            next
          end

          # Get all predecessors for this task
          all_predecessors = all_deps[row.task_number] || []

          # Find latest predecessor end date
          latest_pred_end = nil
          all_predecessors.each do |pred_id|
            pred_dates = date_map[pred_id]
            next unless pred_dates
            pred_end = pred_dates[:end_date]
            latest_pred_end = pred_end if latest_pred_end.nil? || pred_end > latest_pred_end
          end

          row_start = latest_pred_end ? calendar.add_working_days(latest_pred_end, 1) : start_date
          row_start = calendar.next_working_day(row_start) unless calendar.working_day?(row_start)
          duration = row.duration_days || 1
          row_end = calendar.add_working_days(row_start, duration - 1)

          date_map[row.task_number] = { start_date: row_start, end_date: row_end }
        end

        # Calculate header spans (bottom-up: Level-2 first, then Level-1)
        rows.select { |r| r.allow_header && header_level[r.task_number] == 2 }.each do |header|
          children = all_children[header.task_number] || []
          if children.any?
            child_starts = children.map { |c| date_map[c.task_number]&.dig(:start_date) }.compact
            child_ends = children.map { |c| date_map[c.task_number]&.dig(:end_date) }.compact
            effective_start = child_starts.min || start_date
            effective_end = child_ends.max || effective_start
            date_map[header.task_number] = { start_date: effective_start, end_date: effective_end }
          else
            duration = header.duration_days || 1
            date_map[header.task_number] = { start_date: start_date, end_date: calendar.add_working_days(start_date, duration - 1) }
          end
        end

        rows.select { |r| r.allow_header && header_level[r.task_number] == 1 }.each do |header|
          children = all_children[header.task_number] || []
          if children.any?
            child_starts = children.map { |c| date_map[c.task_number]&.dig(:start_date) }.compact
            child_ends = children.map { |c| date_map[c.task_number]&.dig(:end_date) }.compact
            effective_start = child_starts.min || start_date
            effective_end = child_ends.max || effective_start
            date_map[header.task_number] = { start_date: effective_start, end_date: effective_end }
          else
            duration = header.duration_days || 1
            date_map[header.task_number] = { start_date: start_date, end_date: calendar.add_working_days(start_date, duration - 1) }
          end
        end

        render json: {
          success: true,
          message: "Validated #{date_map.size} rows (single pass)",
          updated: date_map.size,
          start_date: start_date,
          date_map: date_map.transform_values { |v| { start_date: v[:start_date].to_s, end_date: v[:end_date].to_s } }
        }
      rescue ArgumentError => e
        render json: { success: false, error: "Invalid date: #{e.message}" }, status: :unprocessable_entity
      rescue StandardError => e
        Rails.logger.error "[validate_dates] Error: #{e.class} - #{e.message}"
        Rails.logger.error e.backtrace.first(10).join("\n")
        render json: {
          success: false,
          error: "Date calculation failed: #{e.class} - #{e.message}",
          backtrace: Rails.env.development? ? e.backtrace.first(5) : nil
        }, status: :internal_server_error
      end

      # GET /api/v1/sm_schedule_master_templates/default
      def default
        @template = SmScheduleMasterTemplate.active.default_template.first

        if @template
          render json: {
            success: true,
            sm_schedule_master_template: template_json(@template, include_rows: true)
          }
        else
          render json: {
            success: false,
            error: "No default template found"
          }, status: :not_found
        end
      end

      private

      def set_template
        @template = SmScheduleMasterTemplate.find(params[:id])
      end

      # DEPRECATED: Use GanttDateCalculationService instead
      # This method is kept for reference but no longer called.
      # SSoT: GanttDateCalculationService is now the single source for date calculation
      def calculate_template_date_map_DEPRECATED(rows)
        start_date = Date.current
        calendar = WorkingDaysCalculator.new(CorporateCompanySetting.instance)
        start_date = calendar.next_working_day(start_date) unless calendar.working_day?(start_date)

        rows_by_task = rows.index_by(&:task_number)

        # Build parent -> children map
        all_children = {}
        rows.each do |row|
          parent_id = extract_header_parent(row.header_gantt)
          if parent_id
            all_children[parent_id] ||= []
            all_children[parent_id] << row
          end
        end

        # Determine header levels
        header_level = {}
        rows.select(&:allow_header).each do |header|
          children = all_children[header.task_number] || []
          has_header_child = children.any?(&:allow_header)
          header_level[header.task_number] = has_header_child ? 1 : 2
        end

        # Get inherited predecessors by walking up header chain
        get_inherited_predecessors = ->(row) {
          inherited = []
          current_parent_id = extract_header_parent(row.header_gantt)
          while current_parent_id
            parent = rows_by_task[current_parent_id]
            break unless parent
            inherited.concat(parent.predecessor_ids || [])
            current_parent_id = extract_header_parent(parent.header_gantt)
          end
          inherited
        }

        tasks = rows.reject(&:allow_header)
        task_numbers = tasks.map(&:task_number).to_set
        header_numbers = rows.select(&:allow_header).map(&:task_number).to_set

        # Get all tasks under a header recursively
        get_tasks_under_header = ->(header_task_number) {
          result = []
          children = all_children[header_task_number] || []
          children.each do |child|
            if child.allow_header
              result.concat(get_tasks_under_header.call(child.task_number))
            else
              result << child.task_number
            end
          end
          result
        }

        # Build dependency graph with header expansion
        all_deps = {}
        tasks.each do |row|
          deps = (row.predecessor_ids || []).map { |p| p.is_a?(Hash) ? (p['id'] || p[:id]) : p }
          inherited = get_inherited_predecessors.call(row).map { |p| p.is_a?(Hash) ? (p['id'] || p[:id]) : p }

          expanded_deps = []
          (deps + inherited).map(&:to_i).uniq.each do |dep_id|
            if header_numbers.include?(dep_id)
              expanded_deps.concat(get_tasks_under_header.call(dep_id))
            elsif task_numbers.include?(dep_id)
              expanded_deps << dep_id
            end
          end
          all_deps[row.task_number] = expanded_deps.uniq
        end

        # Topological sort - handles forward-referencing predecessors correctly
        in_degree = {}
        tasks.each { |t| in_degree[t.task_number] = 0 }
        dependents = Hash.new { |h, k| h[k] = [] }

        all_deps.each do |task, deps|
          in_degree[task] = deps.size
          deps.each { |dep| dependents[dep] << task }
        end

        queue = tasks.select { |t| in_degree[t.task_number] == 0 }
        sorted_tasks = []

        while queue.any?
          task = queue.min_by(&:sequence_order)
          queue.delete(task)
          sorted_tasks << task

          dependents[task.task_number].each do |dependent_task_num|
            in_degree[dependent_task_num] -= 1
            if in_degree[dependent_task_num] == 0
              dependent_task = tasks.find { |t| t.task_number == dependent_task_num }
              queue << dependent_task if dependent_task
            end
          end
        end

        # Handle cycles - add remaining tasks in sequence order
        if sorted_tasks.size < tasks.size
          remaining = tasks - sorted_tasks
          sorted_tasks.concat(remaining.sort_by(&:sequence_order))
        end

        # Calculate dates in topological order (ensures predecessors calculated first)
        date_map = {}

        sorted_tasks.each do |row|
          if row.hold && row.hold_date.present?
            row_start = row.hold_date.to_date
            row_start = calendar.next_working_day(row_start) unless calendar.working_day?(row_start)
          else
            all_predecessors = all_deps[row.task_number] || []
            latest_pred_end = nil
            all_predecessors.each do |pred_id|
              pred_dates = date_map[pred_id]
              next unless pred_dates
              pred_end = pred_dates[:end_date]
              latest_pred_end = pred_end if latest_pred_end.nil? || pred_end > latest_pred_end
            end
            row_start = latest_pred_end ? calendar.add_working_days(latest_pred_end, 1) : start_date
            row_start = calendar.next_working_day(row_start) unless calendar.working_day?(row_start)
          end

          duration = row.duration_days || 1
          row_end = calendar.add_working_days(row_start, duration - 1)
          date_map[row.task_number] = { start_date: row_start, end_date: row_end }
        end

        # Calculate header spans (bottom-up: Level-2 first, then Level-1)
        rows.select { |r| r.allow_header && header_level[r.task_number] == 2 }.each do |header|
          children = all_children[header.task_number] || []
          if children.any?
            child_starts = children.map { |c| date_map[c.task_number]&.dig(:start_date) }.compact
            child_ends = children.map { |c| date_map[c.task_number]&.dig(:end_date) }.compact
            effective_start = child_starts.min || start_date
            effective_end = child_ends.max || effective_start
            date_map[header.task_number] = { start_date: effective_start, end_date: effective_end }
          else
            duration = header.duration_days || 1
            date_map[header.task_number] = { start_date: start_date, end_date: calendar.add_working_days(start_date, duration - 1) }
          end
        end

        rows.select { |r| r.allow_header && header_level[r.task_number] == 1 }.each do |header|
          children = all_children[header.task_number] || []
          if children.any?
            child_starts = children.map { |c| date_map[c.task_number]&.dig(:start_date) }.compact
            child_ends = children.map { |c| date_map[c.task_number]&.dig(:end_date) }.compact
            effective_start = child_starts.min || start_date
            effective_end = child_ends.max || effective_start
            date_map[header.task_number] = { start_date: effective_start, end_date: effective_end }
          else
            duration = header.duration_days || 1
            date_map[header.task_number] = { start_date: start_date, end_date: calendar.add_working_days(start_date, duration - 1) }
          end
        end

        date_map
      end

      # Extract parent header task_number from header_gantt field
      # Returns nil if not a child of any header
      def extract_header_parent(header_gantt)
        return nil if header_gantt.blank? || header_gantt == 'Header'
        return header_gantt if header_gantt.is_a?(Integer)
        return header_gantt['id'] || header_gantt[:id] if header_gantt.is_a?(Hash)
        header_gantt.to_i if header_gantt.to_s.match?(/^\d+$/)
      end

      # Calculate start and end dates for a row based on hold_date or predecessors
      # SSoT: Uses WorkingDaysCalculator for working day logic
      def calculate_row_dates(row, date_map, default_start, calendar)
        row_start = default_start

        # SSoT: If task is held/locked with a hold_date, use that as the fixed start date
        # This respects manual positioning from "Start Task" feature
        if row.hold && row.hold_date.present?
          row_start = row.hold_date.to_date
          row_start = calendar.next_working_day(row_start) unless calendar.working_day?(row_start)
        elsif row.predecessor_ids.present?
          # Get the latest end date from all predecessors
          latest_pred_end = nil
          row.predecessor_ids.each do |pred|
            pred_id = pred.is_a?(Hash) ? (pred['id'] || pred[:id]) : pred
            pred_dates = date_map[pred_id.to_i]
            next unless pred_dates

            pred_end = pred_dates[:end_date]
            latest_pred_end = pred_end if latest_pred_end.nil? || pred_end > latest_pred_end
          end

          if latest_pred_end
            # Start day after predecessor ends (FS dependency)
            row_start = calendar.add_working_days(latest_pred_end, 1)
          end

          row_start = calendar.next_working_day(row_start) unless calendar.working_day?(row_start)
        else
          row_start = calendar.next_working_day(row_start) unless calendar.working_day?(row_start)
        end

        duration = row.duration_days || 1
        row_end = calendar.add_working_days(row_start, duration - 1)

        [ row_start, row_end ]
      end

      def template_params
        params.require(:sm_schedule_master_template).permit(:name, :description, :is_default)
      end

      def template_json(template, include_rows: false)
        json = {
          id: template.id,
          name: template.name,
          description: template.description,
          is_default: template.is_default,
          is_active: template.is_active,
          row_count: template.row_count,
          created_by: template.created_by&.as_json,
          created_at: template.created_at,
          updated_at: template.updated_at,
          copied_from_id: template.copied_from_id
        }

        if include_rows
          # Load all lookup maps to resolve IDs to names
          trades_map = load_trades_map
          stages_map = load_stages_map
          roles_map = load_roles_map
          cost_centres_map = load_cost_centres_map
          header_map = load_header_map
          json[:rows] = template.ordered_rows.map { |r| row_json(r, trades_map, stages_map, roles_map, cost_centres_map, header_map) }
        end

        json
      end

      def row_json(row, trades_map = {}, stages_map = {}, roles_map = {}, cost_centres_map = {}, header_map = {})
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
          trade: trade_value,
          stage: stage_value,
          trade_name: trades_map[row.trade.to_i] || row.trade,
          stage_name: stages_map[row.stage.to_i] || row.stage,
          assigned_role: role_value,
          cost_centre: cost_centre_value,
          header_gantt: header_value,
          allow_header: row.allow_header,
          require_photo: row.require_photo,
          confirm: row.confirm,
          po_required: row.po_required,
          critical_po: row.critical_po,
          create_po_on_job_start: row.create_po_on_job_start,
          has_subtasks: row.has_subtasks,
          subtask_count: row.subtask_count,
          subtask_names: row.subtask_names,
          pass_fail_enabled: row.pass_fail_enabled,
          color: row.color,
          tags: row.tags,
          is_active: row.is_active
        }
      end

      # Load trades lookup map (ID => name) using Foundation
      def load_trades_map
        foundation = Foundation.find_by(name: "SM Trades")
        return {} unless foundation

        ActiveRecord::Base.connection
          .execute("SELECT id, name FROM #{foundation.database_table_name}")
          .to_a
          .each_with_object({}) { |r, h| h[r["id"]] = r["name"] }
      end

      # Load stages lookup map (ID => name) using Foundation
      def load_stages_map
        foundation = Foundation.find_by(name: "SM Stages")
        return {} unless foundation

        ActiveRecord::Base.connection
          .execute("SELECT id, name FROM #{foundation.database_table_name}")
          .to_a
          .each_with_object({}) { |r, h| h[r["id"]] = r["name"] }
      end

      # Load roles lookup map (ID => display_name) using Role model
      def load_roles_map
        Role.all.each_with_object({}) { |r, h| h[r.id] = r.display_name || r.name }
      end

      # Load cost centres lookup map (ID => name) using Foundation
      def load_cost_centres_map
        foundation = Foundation.find_by(slug: "cost_centres") || Foundation.find_by(name: "Cost Centres")
        return {} unless foundation

        ActiveRecord::Base.connection
          .execute("SELECT id, name FROM #{foundation.database_table_name}")
          .to_a
          .each_with_object({}) { |r, h| h[r["id"]] = r["name"] }
      end

      # Load header lookup map (ID => name) - self-reference to sm_schedule_master
      # Headers are tasks that act as group parents for other tasks
      def load_header_map
        SmScheduleMaster.pluck(:id, :name).to_h
      end
    end
  end
end
