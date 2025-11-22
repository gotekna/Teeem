# frozen_string_literal: true

module Api
  module V1
    class SmTimeEntriesController < ApplicationController
      before_action :set_task, only: [:index, :create]
      before_action :set_time_entry, only: [:show, :update, :destroy, :approve]

      # GET /api/v1/sm_tasks/:sm_task_id/time_entries
      def index
        @entries = @task.time_entries.includes(:resource, :created_by, :approved_by).ordered

        # Filter by date range
        if params[:start_date].present? && params[:end_date].present?
          start_date = Date.parse(params[:start_date])
          end_date = Date.parse(params[:end_date])
          @entries = @entries.for_date_range(start_date, end_date)
        end

        # Filter by approval status
        @entries = @entries.approved if params[:approved] == 'true'
        @entries = @entries.pending_approval if params[:pending] == 'true'

        render json: {
          success: true,
          time_entries: @entries.map { |e| time_entry_to_json(e) },
          task: {
            id: @task.id,
            name: @task.name
          },
          summary: {
            total_hours: @entries.sum(:total_hours),
            regular_hours: @entries.regular.sum(:total_hours),
            overtime_hours: @entries.overtime.sum(:total_hours)
          }
        }
      end

      # GET /api/v1/sm_time_entries/:id
      def show
        render json: {
          success: true,
          time_entry: time_entry_to_json(@time_entry, include_details: true)
        }
      end

      # POST /api/v1/sm_tasks/:sm_task_id/time_entries
      def create
        @time_entry = @task.time_entries.new(time_entry_params)
        @time_entry.created_by = current_user

        # Auto-calculate total hours if start/end time provided
        if @time_entry.start_time && @time_entry.end_time && @time_entry.total_hours.blank?
          @time_entry.total_hours = @time_entry.calculate_total_hours
        end

        if @time_entry.save
          render json: {
            success: true,
            message: 'Time entry created successfully',
            time_entry: time_entry_to_json(@time_entry)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @time_entry.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/sm_time_entries/:id
      def update
        # Don't allow editing approved entries unless admin
        if @time_entry.approved? && !current_user&.admin?
          return render json: {
            success: false,
            error: 'Cannot edit approved time entries'
          }, status: :forbidden
        end

        if @time_entry.update(time_entry_params)
          render json: {
            success: true,
            time_entry: time_entry_to_json(@time_entry)
          }
        else
          render json: {
            success: false,
            errors: @time_entry.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/sm_time_entries/:id
      def destroy
        # Don't allow deleting approved entries unless admin
        if @time_entry.approved? && !current_user&.admin?
          return render json: {
            success: false,
            error: 'Cannot delete approved time entries'
          }, status: :forbidden
        end

        @time_entry.destroy

        render json: {
          success: true,
          message: 'Time entry deleted successfully'
        }
      end

      # POST /api/v1/sm_time_entries/:id/approve
      def approve
        @time_entry.approve!(current_user)

        render json: {
          success: true,
          message: 'Time entry approved',
          time_entry: time_entry_to_json(@time_entry)
        }
      end

      # POST /api/v1/sm_time_entries/bulk_approve
      def bulk_approve
        entry_ids = params[:entry_ids]

        unless entry_ids.is_a?(Array) && entry_ids.present?
          return render json: {
            success: false,
            error: 'entry_ids must be a non-empty array'
          }, status: :unprocessable_entity
        end

        approved_count = 0
        SmTimeEntry.where(id: entry_ids, approved_at: nil).each do |entry|
          entry.approve!(current_user)
          approved_count += 1
        end

        render json: {
          success: true,
          message: "#{approved_count} entries approved",
          approved_count: approved_count
        }
      end

      # GET /api/v1/sm_time_entries/by_resource/:resource_id
      def by_resource
        resource = SmResource.find(params[:resource_id])
        entries = resource.time_entries.includes(:task, :created_by, :approved_by).ordered

        # Filter by date range
        if params[:start_date].present? && params[:end_date].present?
          start_date = Date.parse(params[:start_date])
          end_date = Date.parse(params[:end_date])
          entries = entries.for_date_range(start_date, end_date)
        end

        render json: {
          success: true,
          resource: {
            id: resource.id,
            name: resource.name,
            resource_type: resource.resource_type
          },
          time_entries: entries.map { |e| time_entry_to_json(e) },
          summary: {
            total_hours: entries.sum(:total_hours),
            regular_hours: entries.regular.sum(:total_hours),
            overtime_hours: entries.overtime.sum(:total_hours),
            pending_approval: entries.pending_approval.count
          }
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Resource not found' }, status: :not_found
      end

      # GET /api/v1/sm_time_entries/timesheet
      # Returns timesheet data for a date range (daily breakdown)
      def timesheet
        start_date = params[:start_date] ? Date.parse(params[:start_date]) : Date.current.beginning_of_week
        end_date = params[:end_date] ? Date.parse(params[:end_date]) : start_date + 6.days

        # Get all entries for the date range
        entries = SmTimeEntry.includes(:task, :resource, :created_by)
          .for_date_range(start_date, end_date)

        # Filter by resource if specified
        entries = entries.where(resource_id: params[:resource_id]) if params[:resource_id].present?

        # Filter by construction if specified
        if params[:construction_id].present?
          entries = entries.joins(:task).where(sm_tasks: { construction_id: params[:construction_id] })
        end

        # Group by date
        by_date = {}
        (start_date..end_date).each do |date|
          by_date[date.to_s] = {
            date: date,
            day_name: date.strftime('%A'),
            entries: [],
            total_hours: 0
          }
        end

        entries.each do |entry|
          date_key = entry.entry_date.to_s
          if by_date[date_key]
            by_date[date_key][:entries] << time_entry_to_json(entry)
            by_date[date_key][:total_hours] += entry.total_hours
          end
        end

        render json: {
          success: true,
          start_date: start_date,
          end_date: end_date,
          timesheet: by_date.values,
          summary: {
            total_hours: entries.sum(:total_hours),
            total_entries: entries.count,
            pending_approval: entries.pending_approval.count
          }
        }
      rescue ArgumentError
        render json: { success: false, error: 'Invalid date format' }, status: :unprocessable_entity
      end

      # GET /api/v1/sm_time_entries/resource_timesheet/:resource_id
      # Uses SmTimesheetService for detailed timesheet view
      def resource_timesheet
        service = SmTimesheetService.new(user: current_user)
        start_date = parse_date(params[:start_date]) || Date.current.beginning_of_week
        end_date = parse_date(params[:end_date]) || start_date + 6.days

        timesheet = service.timesheet_for_resource(
          resource_id: params[:resource_id],
          start_date: start_date,
          end_date: end_date
        )

        render json: { success: true }.merge(timesheet)
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Resource not found' }, status: :not_found
      end

      # GET /api/v1/sm_time_entries/task_timesheet/:task_id
      def task_timesheet
        service = SmTimesheetService.new(user: current_user)
        timesheet = service.timesheet_for_task(task_id: params[:task_id])

        render json: { success: true }.merge(timesheet)
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Task not found' }, status: :not_found
      end

      # GET /api/v1/sm_time_entries/pending_approvals
      def pending_approvals
        service = SmTimesheetService.new(user: current_user)
        entries = service.pending_approvals(limit: params[:limit]&.to_i || 50)

        render json: {
          success: true,
          entries: entries,
          count: entries.count
        }
      end

      # GET /api/v1/sm_time_entries/weekly_summary/:resource_id
      def weekly_summary
        service = SmTimesheetService.new(user: current_user)
        week_start = parse_date(params[:week_start]) || Date.current.beginning_of_week

        summary = service.weekly_summary(
          resource_id: params[:resource_id],
          week_start: week_start
        )

        render json: {
          success: true,
          resource_id: params[:resource_id],
          week_start: week_start,
          days: summary
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Resource not found' }, status: :not_found
      end

      # POST /api/v1/sm_time_entries/log_time
      # Quick time logging via SmTimesheetService
      def log_time
        service = SmTimesheetService.new(user: current_user)
        task = SmTask.find(params[:task_id])
        resource = SmResource.find(params[:resource_id])

        result = service.log_time(
          task: task,
          resource: resource,
          date: parse_date(params[:entry_date]) || Date.current,
          hours: params[:hours].to_f,
          entry_type: params[:entry_type] || 'regular',
          description: params[:description],
          start_time: params[:start_time],
          end_time: params[:end_time],
          break_minutes: params[:break_minutes]&.to_i || 0
        )

        if result[:success]
          render json: {
            success: true,
            time_entry: time_entry_to_json(result[:time_entry])
          }, status: :created
        else
          render json: { success: false, errors: result[:errors] }, status: :unprocessable_entity
        end
      rescue ActiveRecord::RecordNotFound => e
        render json: { success: false, error: e.message }, status: :not_found
      end

      # GET /api/v1/sm_time_entries/export_payroll
      def export_payroll
        service = SmTimesheetService.new(user: current_user)
        start_date = parse_date(params[:start_date])
        end_date = parse_date(params[:end_date])

        unless start_date && end_date
          return render json: {
            success: false,
            error: 'start_date and end_date are required'
          }, status: :unprocessable_entity
        end

        payroll_data = service.export_for_payroll(
          start_date: start_date,
          end_date: end_date,
          resource_ids: params[:resource_ids]
        )

        render json: {
          success: true,
          period: { start_date: start_date, end_date: end_date },
          payroll: payroll_data,
          totals: {
            total_regular_hours: payroll_data.sum { |r| r[:hours][:regular] },
            total_overtime_hours: payroll_data.sum { |r| r[:hours][:overtime] },
            total_cost: payroll_data.sum { |r| r[:cost][:total] }
          }
        }
      end

      private

      def parse_date(date_string)
        Date.parse(date_string) if date_string.present?
      rescue ArgumentError
        nil
      end

      def set_task
        @task = SmTask.find(params[:sm_task_id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: 'Task not found'
        }, status: :not_found
      end

      def set_time_entry
        @time_entry = SmTimeEntry.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: 'Time entry not found'
        }, status: :not_found
      end

      def time_entry_params
        params.require(:sm_time_entry).permit(
          :resource_id,
          :allocation_id,
          :entry_date,
          :start_time,
          :end_time,
          :break_minutes,
          :total_hours,
          :entry_type,
          :description
        )
      end

      def time_entry_to_json(entry, include_details: false)
        json = {
          id: entry.id,
          task_id: entry.task_id,
          task_name: entry.task.name,
          resource_id: entry.resource_id,
          resource_name: entry.resource.name,
          entry_date: entry.entry_date,
          start_time: entry.start_time&.strftime('%H:%M'),
          end_time: entry.end_time&.strftime('%H:%M'),
          break_minutes: entry.break_minutes,
          total_hours: entry.total_hours,
          entry_type: entry.entry_type,
          description: entry.description,
          approved: entry.approved?,
          approved_at: entry.approved_at,
          approved_by_name: entry.approved_by&.name,
          created_by_name: entry.created_by&.name,
          created_at: entry.created_at,
          updated_at: entry.updated_at
        }

        if include_details
          json[:task] = {
            id: entry.task_id,
            name: entry.task.name,
            construction_id: entry.task.construction_id,
            start_date: entry.task.start_date,
            end_date: entry.task.end_date
          }
          json[:resource] = {
            id: entry.resource.id,
            name: entry.resource.name,
            resource_type: entry.resource.resource_type,
            hourly_rate: entry.resource.hourly_rate
          }
        end

        json
      end
    end
  end
end
