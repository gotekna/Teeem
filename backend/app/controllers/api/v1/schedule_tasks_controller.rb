# DEPRECATED: Use SmTasksController instead
# This controller is being replaced as part of SSoT consolidation.
# The SmTask system provides full SM Gantt functionality.
# This controller will be removed in a future release.
module Api
  module V1
    class ScheduleTasksController < ApplicationController
      before_action :log_deprecation_warning
      before_action :set_job, only: [ :index, :import, :gantt_data, :create, :copy_from_template ]
      before_action :set_schedule_task, only: [ :show, :update, :destroy, :match_po, :unmatch_po ]

      # GET /api/v1/constructions/:job_id/schedule_tasks
      # Returns all schedule tasks for a construction job
      def index
        @schedule_tasks = @job.schedule_tasks.by_sequence

        render json: {
          success: true,
          schedule_tasks: @schedule_tasks.map { |task| task_to_json(task) },
          matched_count: @job.schedule_tasks.matched.count,
          unmatched_count: @job.schedule_tasks.unmatched.count,
          total_count: @job.schedule_tasks.count
        }
      end

      # GET /api/v1/schedule_tasks/:id
      def show
        render json: {
          success: true,
          schedule_task: task_to_json(@schedule_task)
        }
      end

      # POST /api/v1/constructions/:job_id/schedule_tasks
      # Create a single schedule task manually
      def create
        @schedule_task = @job.schedule_tasks.new(schedule_task_params)

        # Set sequence order to be last + 1
        max_sequence = @job.schedule_tasks.maximum(:sequence_order) || 0
        @schedule_task.sequence_order = max_sequence + 1

        if @schedule_task.save
          render json: {
            success: true,
            message: "Schedule task created successfully",
            schedule_task: task_to_json(@schedule_task)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @schedule_task.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/constructions/:job_id/schedule_tasks/copy_from_template
      # Copy a task template to create a new schedule task
      def copy_from_template
        unless params[:template_id].present?
          return render json: {
            success: false,
            error: "Template ID is required"
          }, status: :unprocessable_entity
        end

        template = TaskTemplate.find_by(id: params[:template_id])

        unless template
          return render json: {
            success: false,
            error: "Template not found"
          }, status: :not_found
        end

        # Get the next sequence order
        max_sequence = @job.schedule_tasks.maximum(:sequence_order) || 0

        # Create schedule task from template
        @schedule_task = @job.schedule_tasks.new(
          title: template.name,
          status: "Not Started",
          duration: "#{template.default_duration_days}d",
          supplier_category: template.category,
          sequence_order: max_sequence + 1
        )

        if @schedule_task.save
          render json: {
            success: true,
            message: "Task created from template successfully",
            schedule_task: task_to_json(@schedule_task)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @schedule_task.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/constructions/:job_id/schedule_tasks/import
      # Import schedule tasks from Excel file
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
          parser = SpreadsheetParser.new(temp_file.path)
          parse_result = parser.parse

          unless parse_result[:success]
            return render json: {
              success: false,
              error: parse_result[:errors].join(", ")
            }, status: :unprocessable_entity
          end

          # Import the schedule tasks
          imported_count = import_schedule_tasks(parser.all_rows)

          render json: {
            success: true,
            message: "Successfully imported #{imported_count} schedule tasks",
            imported_count: imported_count,
            total_rows: parse_result[:total_rows]
          }
        rescue => e
          Rails.logger.error("Schedule import error: #{e.message}")
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

      # GET /api/v1/constructions/:job_id/schedule_tasks/gantt_data
      # Returns only matched tasks formatted for Gantt chart
      def gantt_data
        matched_tasks = @job.schedule_tasks.for_gantt

        render json: {
          success: true,
          gantt_tasks: matched_tasks.map { |task| task.to_gantt_format },
          count: matched_tasks.count
        }
      end

      # PATCH /api/v1/schedule_tasks/:id/match_po
      # Match a schedule task to a purchase order
      def match_po
        unless params[:purchase_order_id].present?
          return render json: {
            success: false,
            error: "Purchase order ID is required"
          }, status: :unprocessable_entity
        end

        purchase_order = PurchaseOrder.find_by(id: params[:purchase_order_id])

        unless purchase_order
          return render json: {
            success: false,
            error: "Purchase order not found"
          }, status: :not_found
        end

        # Verify the PO belongs to the same construction
        unless purchase_order.construction_id == @schedule_task.construction_id
          return render json: {
            success: false,
            error: "Purchase order does not belong to this job"
          }, status: :unprocessable_entity
        end

        @schedule_task.match_to_purchase_order!(purchase_order)

        render json: {
          success: true,
          message: "Successfully matched to purchase order",
          schedule_task: task_to_json(@schedule_task)
        }
      end

      # DELETE /api/v1/schedule_tasks/:id/unmatch_po
      # Remove purchase order match from schedule task
      def unmatch_po
        @schedule_task.unmatch_from_purchase_order!

        render json: {
          success: true,
          message: "Successfully unmatched from purchase order",
          schedule_task: task_to_json(@schedule_task)
        }
      end

      # PATCH /api/v1/schedule_tasks/:id
      def update
        if @schedule_task.update(schedule_task_params)
          render json: {
            success: true,
            schedule_task: task_to_json(@schedule_task)
          }
        else
          render json: {
            success: false,
            error: @schedule_task.errors.full_messages.join(", ")
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/schedule_tasks/:id
      def destroy
        @schedule_task.destroy

        render json: {
          success: true,
          message: "Schedule task deleted successfully"
        }
      end

      private

      def log_deprecation_warning
        Rails.logger.warn "[DEPRECATED] ScheduleTasksController accessed. Use SmTasksController (/api/v1/sm_tasks) instead. Action: #{action_name}"
      end

      def set_job
        @job = Job.find(params[:job_id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Construction job not found"
        }, status: :not_found
      end

      def set_schedule_task
        @schedule_task = ScheduleTask.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Schedule task not found"
        }, status: :not_found
      end

      def schedule_task_params
        params.require(:schedule_task).permit(
          :title,
          :status,
          :start_date,
          :complete_date,
          :duration,
          :supplier_category,
          :supplier_name,
          :paid_internal,
          :approx_date,
          :confirm,
          :supplier_confirm,
          :task_started,
          :completed,
          :attachments,
          :purchase_order_id,
          predecessors: []
        )
      end

      def save_temp_file(uploaded_file)
        temp_file = Tempfile.new([ "schedule_import", File.extname(uploaded_file.original_filename) ])
        temp_file.binmode
        temp_file.write(uploaded_file.read)
        temp_file.rewind
        temp_file
      end

      def import_schedule_tasks(rows)
        imported_count = 0

        rows.each_with_index do |row, index|
          # Skip rows without a title
          next unless row["title"].present? || row["Title"].present?

          task_attributes = parse_schedule_row(row, index)
          @job.schedule_tasks.create!(task_attributes)
          imported_count += 1
        rescue => e
          Rails.logger.error("Failed to import row #{index + 1}: #{e.message}")
          # Continue with next row
        end

        imported_count
      end

      def parse_schedule_row(row, index)
        # Handle case-insensitive column names
        title = row["title"] || row["Title"]
        status = row["Status"] || row["status"] || "Not Started"
        start_date = parse_date(row["Start"] || row["start"])
        complete_date = parse_date(row["Complete"] || row["complete"])
        duration = row["duration"] || row["Duration"]
        supplier_category = row["supplier_category"] || row["Supplier Category"]
        supplier = row["Supplier"] || row["supplier"]

        # Parse boolean and date fields
        paid_internal = parse_boolean(row["Paid Internal"] || row["paid_internal"])
        approx_date = parse_date(row["Approx Date"] || row["approx_date"])
        confirm = parse_boolean(row["confirm"] || row["Confirm"])
        supplier_confirm = parse_boolean(row["supplier_confirm"] || row["Supplier Confirm"])
        task_started = parse_date(row["Task Started"] || row["task_started"])
        completed = parse_date(row["Completed"] || row["completed"])

        # Parse predecessors (comma-separated list of task numbers)
        predecessors = parse_predecessors(row["Predecessors"] || row["predecessors"])

        attachments = row["Attachments"] || row["attachments"]

        {
          title: title,
          status: status,
          start_date: start_date,
          complete_date: complete_date,
          duration: duration,
          supplier_category: supplier_category,
          supplier_name: supplier,
          paid_internal: paid_internal,
          approx_date: approx_date,
          confirm: confirm,
          supplier_confirm: supplier_confirm,
          task_started: task_started,
          completed: completed,
          predecessors: predecessors,
          attachments: attachments,
          sequence_order: index + 1
        }
      end

      def parse_date(value)
        return nil if value.blank?

        if value.is_a?(Date) || value.is_a?(DateTime) || value.is_a?(Time)
          value
        elsif value.is_a?(String)
          begin
            DateTime.parse(value)
          rescue
            nil
          end
        else
          nil
        end
      end

      def parse_boolean(value)
        return false if value.blank?

        if value.is_a?(TrueClass) || value.is_a?(FalseClass)
          value
        elsif value.is_a?(String)
          [ "yes", "true", "1", "y" ].include?(value.downcase.strip)
        else
          !!value
        end
      end

      def parse_predecessors(value)
        return [] if value.blank?

        # If already an array, return it
        return value if value.is_a?(Array)

        # Convert to string and parse
        value_str = value.to_s.strip
        return [] if value_str.empty?

        predecessors = []

        # Split by comma first to handle multiple dependencies
        parts = value_str.split(",").map(&:strip)

        parts.each do |part|
          # Handle '&' separated dependencies (e.g., "0 & 0+7d")
          if part.include?("&")
            part.split("&").map(&:strip).each do |subpart|
              predecessors << parse_single_predecessor(subpart)
            end
          # Handle '/' separated dependencies (e.g., "93/55 +1d")
          elsif part.include?("/")
            # Split by / and check if there's a lag at the end
            if part =~ /(.+)\s+(\+\d+[a-z]+)$/i
              # Has a lag time (e.g., "93/55 +1d")
              dep_ids = $1.split("/").map(&:strip)
              lag = $2.strip
              dep_ids.each do |dep_id|
                predecessors << parse_single_predecessor(dep_id, lag)
              end
            else
              # No lag time, just split by /
              part.split("/").map(&:strip).each do |dep_id|
                predecessors << parse_single_predecessor(dep_id)
              end
            end
          else
            # Simple dependency (e.g., "42" or "8" or "10+7d")
            predecessors << parse_single_predecessor(part)
          end
        end

        # Remove any nil values and return unique dependencies
        predecessors.compact.uniq
      end

      # Parse a single predecessor string like "8", "10+7d", "0+7d"
      def parse_single_predecessor(dep_str, default_lag = nil)
        return nil if dep_str.blank?

        dep_str = dep_str.strip

        # Check if there's a lag time (e.g., "10+7d" or "0+7d")
        if dep_str =~ /^(\d+)\s*(\+\d+[a-z]+)$/i
          task_id = $1.to_i
          lag = $2.strip
          return { "id" => task_id, "lag" => lag } if task_id > 0
        elsif default_lag
          # Use provided lag
          task_id = dep_str.to_i
          return { "id" => task_id, "lag" => default_lag } if task_id > 0
        else
          # No lag, just task ID
          task_id = dep_str.to_i
          return { "id" => task_id } if task_id > 0
        end

        nil
      end

      def task_to_json(task)
        {
          id: task.id,
          construction_id: task.construction_id,
          purchase_order_id: task.purchase_order_id,
          title: task.title,
          status: task.status,
          start_date: task.start_date,
          complete_date: task.complete_date,
          duration: task.duration,
          duration_days: task.duration_days,
          supplier_category: task.supplier_category,
          supplier_name: task.supplier_name,
          paid_internal: task.paid_internal,
          approx_date: task.approx_date,
          confirm: task.confirm,
          supplier_confirm: task.supplier_confirm,
          task_started: task.task_started,
          completed: task.completed,
          predecessors: task.predecessors,
          attachments: task.attachments,
          matched_to_po: task.matched_to_po,
          sequence_order: task.sequence_order,
          purchase_order: task.purchase_order ? {
            id: task.purchase_order.id,
            purchase_order_number: task.purchase_order.purchase_order_number,
            description: task.purchase_order.description,
            status: task.purchase_order.status
          } : nil,
          suggested_purchase_orders: task.matched_to_po ? [] : task.suggested_purchase_orders.map { |po|
            {
              id: po.id,
              purchase_order_number: po.purchase_order_number,
              description: po.description,
              status: po.status,
              supplier_name: po.supplier&.name
            }
          },
          created_at: task.created_at,
          updated_at: task.updated_at
        }
      end
    end
  end
end
