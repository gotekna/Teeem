# frozen_string_literal: true

module Gl
  # Individual widget on a dashboard
  class DashboardWidget < ApplicationRecord
    self.table_name = "gl_dashboard_widgets"

    WIDGET_TYPES = %w[report chart kpi text].freeze

    belongs_to :dashboard, class_name: "Gl::ReportDashboard"
    belongs_to :custom_report, class_name: "Gl::CustomReport", optional: true

    validates :widget_type, presence: true, inclusion: { in: WIDGET_TYPES }
    validates :row, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :col, presence: true, numericality: { greater_than_or_equal_to: 0 }
    validates :width, presence: true, numericality: { greater_than: 0 }
    validates :height, presence: true, numericality: { greater_than: 0 }

    validate :report_required_for_report_type

    # Refresh widget data
    def refresh!
      return unless custom_report.present?

      custom_report.run!
      update!(last_refreshed_at: Time.current)
    end

    # Get current data
    def data
      case widget_type
      when "report", "chart"
        return nil unless custom_report.present?
        custom_report.execute_query
      when "kpi"
        calculate_kpi
      when "text"
        { content: config["content"] }
      end
    end

    # Check if data is stale (older than 5 minutes)
    def stale?
      return true if last_refreshed_at.nil?
      last_refreshed_at < 5.minutes.ago
    end

    private

    def report_required_for_report_type
      if widget_type.in?(%w[report chart]) && custom_report.nil?
        errors.add(:custom_report, "is required for report widgets")
      end
    end

    def calculate_kpi
      return {} if config.blank?

      # KPI config format:
      # { entity: "invoices", metric: "sum", field: "total", filters: [...] }
      entity = config["entity"]
      metric = config["metric"]
      field = config["field"]

      base_query = case entity
                   when "invoices" then Gl::Invoice.where(corporate_company: dashboard.corporate_company)
                   when "payments" then Gl::Payment.where(corporate_company: dashboard.corporate_company)
                   when "jobs" then Job.where(corporate_company: dashboard.corporate_company)
                   else return {}
                   end

      value = case metric
              when "sum" then base_query.sum(field)
              when "count" then base_query.count
              when "avg" then base_query.average(field)
              else 0
              end

      {
        value: value,
        label: config["label"] || title,
        format: config["format"] || "number"
      }
    end
  end
end
