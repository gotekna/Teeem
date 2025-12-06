module Api
  module V1
    class ComplianceCalendarController < ApplicationController
      # GET /api/v1/compliance_calendar
      # Returns calendar items with optional filters
      def index
        service = ComplianceCalendarService.new(calendar_params)

        render json: {
          success: true,
          items: serialize_items(service.calendar_items),
          items_by_date: service.items_by_date.transform_values { |items| serialize_items(items) },
          summary: service.summary,
          filters: {
            start_date: service.instance_variable_get(:@start_date),
            end_date: service.instance_variable_get(:@end_date),
            company_id: params[:company_id],
            company_group_id: params[:company_group_id]
          }
        }
      end

      # GET /api/v1/compliance_calendar/summary
      # Returns just the summary statistics
      def summary
        service = ComplianceCalendarService.new(calendar_params)

        render json: {
          success: true,
          summary: service.summary
        }
      end

      # GET /api/v1/compliance_calendar/overdue
      # Returns all overdue items
      def overdue
        service = ComplianceCalendarService.new(calendar_params)

        render json: {
          success: true,
          items: serialize_items(service.overdue_items),
          count: service.overdue_items.count
        }
      end

      # GET /api/v1/compliance_calendar/upcoming
      # Returns items due in the next 30 days (or specified days)
      def upcoming
        days = params[:days]&.to_i || 30
        service = ComplianceCalendarService.new(calendar_params)

        render json: {
          success: true,
          items: serialize_items(service.upcoming_items(days)),
          days: days
        }
      end

      # GET /api/v1/compliance_calendar/by_company
      # Returns items grouped by company
      def by_company
        service = ComplianceCalendarService.new(calendar_params)

        render json: {
          success: true,
          companies: service.items_by_company.map do |company_id, data|
            {
              company_id: company_id,
              company_name: data[:company].name,
              company_code: data[:company].company_code,
              company_group: data[:company].company_group&.name,
              overdue_count: data[:overdue_count],
              pending_count: data[:pending_count],
              total_count: data[:total_count],
              items: serialize_items(data[:items])
            }
          end
        }
      end

      # POST /api/v1/compliance_calendar/generate
      # Generate annual compliance items for all companies
      def generate
        financial_year = params[:financial_year]&.to_i || ComplianceCalendarService.current_financial_year

        result = ComplianceCalendarService.generate_annual_compliance_items(financial_year: financial_year)

        render json: {
          success: true,
          generated: result[:generated],
          errors: result[:errors],
          financial_year: financial_year
        }
      end

      # POST /api/v1/compliance_calendar/send_reminders
      # Send reminders for upcoming items
      def send_reminders
        ComplianceCalendarService.send_reminders

        render json: {
          success: true,
          message: "Reminders queued"
        }
      end

      private

      def calendar_params
        {
          company_id: params[:company_id],
          company_group_id: params[:company_group_id],
          start_date: params[:start_date].present? ? Date.parse(params[:start_date]) : nil,
          end_date: params[:end_date].present? ? Date.parse(params[:end_date]) : nil,
          status: params[:status],
          include_completed: params[:include_completed] == "true"
        }
      end

      def serialize_items(items)
        items.map do |item|
          {
            id: item.id,
            company_id: item.company_id,
            company_name: item.company.name,
            company_code: item.company.code,
            company_group: item.company.company_group&.name,
            item_type: item.item_type,
            title: item.title,
            description: item.description,
            due_date: item.due_date,
            completed: item.completed,
            asic_related: item.asic_related,
            ato_related: item.ato_related,
            recurrence: item.recurrence,
            completed_at: item.completed_at,
            is_overdue: item.due_date < Date.today && !item.completed,
            days_until_due: (item.due_date - Date.today).to_i
          }
        end
      end
    end
  end
end
