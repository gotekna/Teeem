# frozen_string_literal: true

module Api
  module V1
    class SmScheduleMasterTemplatesController < ApplicationController
      before_action :set_template, only: [ :show, :update, :destroy, :duplicate, :set_default, :copy_to_job, :sync_to_job, :compare_to_job, :analyze_matches, :apply_links, :delete_orphans, :copy, :import_rows, :health_check ]

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
