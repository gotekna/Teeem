# frozen_string_literal: true

module Gl
  # BAS Service
  # Wraps BAS (Business Activity Statement) preparation functionality
  # Delegates to BasPreparationService for detailed calculations
  class BasService
    attr_reader :company, :period

    def initialize(company, period = nil)
      @company = company
      @period = period || current_quarter
    end

    # Get full BAS data
    def index
      preparation_service.generate
    end

    # Preview BAS before lodgement
    def preview
      preparation_service.preview
    end

    # Get GST section
    def gst
      preparation_service.gst_section
    end

    # Get PAYG section
    def payg
      preparation_service.payg_section
    end

    # Get available periods
    def periods
      available_periods
    end

    # Get lodgement history
    def history
      lodgement_history
    end

    # Validate BAS data
    def validate
      preparation_service.validate
    end

    # Export BAS data
    def export(format: 'json')
      preparation_service.export(format: format)
    end

    # Compare with previous period
    def comparison
      preparation_service.comparison
    end

    # Get GST reconciliation
    def gst_reconciliation
      preparation_service.gst_reconciliation
    end

    # Get transactions for the period
    def transactions
      preparation_service.transactions
    end

    # Mark as lodged
    def mark_lodged(lodged_date: nil, reference: nil)
      preparation_service.mark_lodged(
        lodged_date: lodged_date || Date.current,
        reference: reference
      )
    end

    # Get chart data
    def chart_data
      preparation_service.chart_data
    end

    private

    def preparation_service
      @preparation_service ||= BasPreparationService.new(company, period)
    end

    def current_quarter
      today = Date.current
      month = today.month

      case month
      when 7..9 then 'Q1'   # Jul-Sep
      when 10..12 then 'Q2' # Oct-Dec
      when 1..3 then 'Q3'   # Jan-Mar
      else 'Q4'             # Apr-Jun
      end
    end

    def available_periods
      current_fy_year = Date.current.month >= 7 ? Date.current.year + 1 : Date.current.year

      periods = []

      # Last 2 financial years
      [current_fy_year, current_fy_year - 1].each do |fy_year|
        %w[Q1 Q2 Q3 Q4].each do |quarter|
          quarter_dates = quarter_date_range(fy_year, quarter)

          # Only include past quarters
          next if quarter_dates[:end] > Date.current

          periods << {
            period: quarter,
            financial_year: "FY#{fy_year}",
            label: "#{quarter} FY#{fy_year}",
            start_date: quarter_dates[:start],
            end_date: quarter_dates[:end],
            due_date: quarter_dates[:end] + 28.days,
            status: lodgement_status(fy_year, quarter)
          }
        end
      end

      periods.reverse
    end

    def quarter_date_range(fy_year, quarter)
      case quarter
      when 'Q1'
        { start: Date.new(fy_year - 1, 7, 1), end: Date.new(fy_year - 1, 9, 30) }
      when 'Q2'
        { start: Date.new(fy_year - 1, 10, 1), end: Date.new(fy_year - 1, 12, 31) }
      when 'Q3'
        { start: Date.new(fy_year, 1, 1), end: Date.new(fy_year, 3, 31) }
      when 'Q4'
        { start: Date.new(fy_year, 4, 1), end: Date.new(fy_year, 6, 30) }
      end
    end

    def lodgement_status(fy_year, quarter)
      # Would check against lodgement records
      'not_lodged'
    end

    def lodgement_history
      # Would return past lodgements
      []
    end
  end
end
