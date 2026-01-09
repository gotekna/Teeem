# frozen_string_literal: true

module Gl
  # Cash Flow Service
  # Wraps cash flow forecasting functionality
  # Delegates to CashFlowForecastService for detailed forecasting
  class CashFlowService
    attr_reader :company, :as_at_date

    def initialize(company, as_at_date: nil)
      @company = company
      @as_at_date = as_at_date || Date.current
    end

    # Get cash flow forecast
    def forecast(days: 90)
      forecast_service.generate
    end

    # Get summary
    def summary
      forecast_service.summary
    end

    # Get inflows breakdown
    def inflows
      forecast_service.inflows_breakdown
    end

    # Get outflows breakdown
    def outflows
      forecast_service.outflows_breakdown
    end

    # Get recurring items
    def recurring
      forecast_service.recurring_items
    end

    # Get weekly breakdown
    def weekly
      forecast_service.weekly_breakdown
    end

    # Get daily breakdown
    def daily(days: 30)
      forecast_service.daily_breakdown(days)
    end

    # Get warnings/alerts
    def warnings
      forecast_service.warnings
    end

    # Run scenario analysis
    def scenario(params)
      forecast_service.scenario_analysis(params)
    end

    # Get chart data
    def chart_data
      forecast_service.chart_data
    end

    private

    def forecast_service
      @forecast_service ||= CashFlowForecastService.new(
        company,
        as_at_date: as_at_date
      )
    end
  end
end
