# frozen_string_literal: true

module Api
  module V1
    class SmReportsController < ApplicationController
      # GET /api/v1/sm_reports/dashboard
      # Main dashboard summary
      def dashboard
        service = SmDashboardService.new(construction_id: params[:construction_id])

        render json: {
          success: true,
          project_summary: service.project_summary,
          trade_breakdown: service.trade_breakdown
        }
      end

      # GET /api/v1/sm_reports/utilization
      # Resource utilization report
      def utilization
        service = SmDashboardService.new(construction_id: params[:construction_id])
        start_date = parse_date(params[:start_date])
        end_date = parse_date(params[:end_date])

        report = service.resource_utilization(
          start_date: start_date,
          end_date: end_date
        )

        render json: { success: true }.merge(report)
      end

      # GET /api/v1/sm_reports/costs
      # Cost tracking report
      def costs
        service = SmDashboardService.new(construction_id: params[:construction_id])
        start_date = parse_date(params[:start_date])
        end_date = parse_date(params[:end_date])

        report = service.cost_summary(
          start_date: start_date,
          end_date: end_date
        )

        render json: { success: true }.merge(report)
      end

      # GET /api/v1/sm_reports/trends
      # Weekly trend data for charts
      def trends
        service = SmDashboardService.new(construction_id: params[:construction_id])
        weeks = (params[:weeks] || 8).to_i.clamp(1, 52)

        render json: {
          success: true,
          weeks: service.weekly_trends(weeks: weeks)
        }
      end

      # GET /api/v1/sm_reports/forecast
      # Upcoming work forecast
      def forecast
        service = SmDashboardService.new(construction_id: params[:construction_id])
        days = (params[:days] || 14).to_i.clamp(1, 90)

        render json: {
          success: true
        }.merge(service.upcoming_forecast(days: days))
      end

      # GET /api/v1/sm_reports/export
      # Export report data (CSV/JSON)
      def export
        service = SmDashboardService.new(construction_id: params[:construction_id])
        report_type = params[:type] || 'utilization'
        format = params[:format] || 'json'

        start_date = parse_date(params[:start_date]) || Date.current.beginning_of_month
        end_date = parse_date(params[:end_date]) || Date.current.end_of_month

        data = case report_type
               when 'utilization'
                 service.resource_utilization(start_date: start_date, end_date: end_date)
               when 'costs'
                 service.cost_summary(start_date: start_date, end_date: end_date)
               when 'trends'
                 { weeks: service.weekly_trends(weeks: 12) }
               else
                 service.project_summary
               end

        if format == 'csv'
          csv_data = generate_csv(report_type, data)
          send_data csv_data,
                    filename: "sm_#{report_type}_#{Date.current}.csv",
                    type: 'text/csv'
        else
          render json: {
            success: true,
            report_type: report_type,
            period: { start_date: start_date, end_date: end_date },
            data: data
          }
        end
      end

      # GET /api/v1/sm_reports/resource/:resource_id
      # Individual resource report
      def resource
        resource = SmResource.find(params[:resource_id])
        start_date = parse_date(params[:start_date]) || Date.current.beginning_of_month
        end_date = parse_date(params[:end_date]) || Date.current.end_of_month

        allocations = resource.resource_allocations
          .where(allocation_date: start_date..end_date)
          .includes(:task)
          .order(:allocation_date)

        time_entries = resource.time_entries
          .where(entry_date: start_date..end_date)
          .includes(:task)
          .order(:entry_date)

        working_days = calculate_working_days(start_date, end_date)
        capacity = working_days * (resource.availability_hours_per_day || 8.0)
        allocated_hours = allocations.sum(:allocated_hours).to_f
        logged_hours = time_entries.sum(:total_hours).to_f

        # Calculate costs
        rate = resource.hourly_rate || 0
        regular_cost = time_entries.regular.sum(:total_hours).to_f * rate
        overtime_cost = time_entries.overtime.sum(:total_hours).to_f * rate * 1.5
        total_cost = regular_cost + overtime_cost

        render json: {
          success: true,
          resource: {
            id: resource.id,
            name: resource.name,
            type: resource.resource_type,
            trade: resource.trade,
            hourly_rate: resource.hourly_rate.to_f
          },
          period: { start_date: start_date, end_date: end_date },
          summary: {
            capacity_hours: capacity.round(1),
            allocated_hours: allocated_hours.round(1),
            logged_hours: logged_hours.round(1),
            utilization: capacity > 0 ? (allocated_hours / capacity * 100).round(1) : 0,
            efficiency: allocated_hours > 0 ? (logged_hours / allocated_hours * 100).round(1) : 0
          },
          costs: {
            regular: regular_cost.round(2),
            overtime: overtime_cost.round(2),
            total: total_cost.round(2)
          },
          allocations_by_task: allocations.group_by(&:task).map do |task, task_allocs|
            {
              task_id: task.id,
              task_name: task.name,
              hours: task_allocs.sum(&:allocated_hours).to_f.round(1),
              days: task_allocs.count
            }
          end,
          daily_breakdown: (start_date..end_date).map do |date|
            day_allocs = allocations.select { |a| a.allocation_date == date }
            day_entries = time_entries.select { |e| e.entry_date == date }
            {
              date: date,
              allocated: day_allocs.sum(&:allocated_hours).to_f,
              logged: day_entries.sum(&:total_hours).to_f
            }
          end
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Resource not found' }, status: :not_found
      end

      # GET /api/v1/sm_reports/task/:task_id
      # Individual task cost report
      def task
        task = SmTask.find(params[:task_id])

        allocations = task.resource_allocations.includes(:resource)
        time_entries = task.time_entries.includes(:resource).approved

        allocated_hours = allocations.sum(:allocated_hours).to_f
        logged_hours = time_entries.sum(:total_hours).to_f

        # Calculate costs by resource
        cost_by_resource = {}
        time_entries.each do |entry|
          resource = entry.resource
          rate = resource.hourly_rate || 0
          multiplier = entry.entry_type == 'overtime' ? 1.5 : 1.0
          cost = entry.total_hours * rate * multiplier

          cost_by_resource[resource.id] ||= {
            resource_id: resource.id,
            resource_name: resource.name,
            resource_type: resource.resource_type,
            hours: 0,
            cost: 0
          }
          cost_by_resource[resource.id][:hours] += entry.total_hours
          cost_by_resource[resource.id][:cost] += cost
        end

        total_cost = cost_by_resource.values.sum { |r| r[:cost] }

        render json: {
          success: true,
          task: {
            id: task.id,
            name: task.name,
            task_number: task.task_number,
            trade: task.trade,
            start_date: task.start_date,
            end_date: task.end_date,
            status: task.status
          },
          summary: {
            allocated_hours: allocated_hours.round(1),
            logged_hours: logged_hours.round(1),
            efficiency: allocated_hours > 0 ? (logged_hours / allocated_hours * 100).round(1) : 0,
            total_cost: total_cost.round(2)
          },
          resources: cost_by_resource.values.map do |r|
            r[:hours] = r[:hours].round(1)
            r[:cost] = r[:cost].round(2)
            r
          end
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Task not found' }, status: :not_found
      end

      private

      def parse_date(date_string)
        Date.parse(date_string) if date_string.present?
      rescue ArgumentError
        nil
      end

      def calculate_working_days(start_date, end_date)
        calculator = WorkingDaysCalculator.new
        calculator.working_days_between(start_date, end_date)
      rescue StandardError
        (start_date..end_date).count { |d| (1..5).cover?(d.wday) }
      end

      def generate_csv(report_type, data)
        require 'csv'

        CSV.generate(headers: true) do |csv|
          case report_type
          when 'utilization'
            csv << ['Resource', 'Type', 'Trade', 'Capacity', 'Allocated', 'Logged', 'Utilization %']
            data[:resources]&.each do |r|
              csv << [r[:name], r[:type], r[:trade], r[:capacity], r[:allocated], r[:logged], r[:utilization]]
            end
          when 'costs'
            csv << ['Category', 'Amount']
            csv << ['Total Cost', data.dig(:summary, :total_cost)]
            csv << ['Budget', data.dig(:summary, :budget)]
            csv << ['Variance', data.dig(:summary, :variance)]
            csv << []
            csv << ['Trade', 'Cost']
            data[:by_trade]&.each do |trade, cost|
              csv << [trade, cost]
            end
          when 'trends'
            csv << ['Week', 'Tasks Completed', 'Hours Logged', 'Hours Approved', 'Efficiency %']
            data[:weeks]&.each do |w|
              csv << [w[:week_label], w[:tasks_completed], w[:hours_logged], w[:hours_approved], w[:efficiency]]
            end
          end
        end
      end
    end
  end
end
