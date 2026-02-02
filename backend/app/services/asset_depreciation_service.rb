# World-Class Asset Register - Depreciation Calculation Service
# Handles ATO-compliant depreciation calculations for Australian financial years
class AssetDepreciationService
  # Australian Financial Year: July 1 - June 30

  def initialize(asset)
    @asset = asset
    @profile = asset.depreciation_profile
    @company = asset.corporate
  end

  # Calculate depreciation for a specific financial year
  def calculate_for_year(financial_year)
    return { success: false, error: "No depreciation profile" } unless @profile

    fy_dates = parse_financial_year(financial_year)

    # Check if asset was disposed before this period
    if @asset.disposed? && @asset.disposal.disposal_date < fy_dates[:start]
      return { success: false, error: "Asset disposed before this period" }
    end

    # Check if depreciation hasn't started yet
    if @profile.depreciation_start_date > fy_dates[:end]
      return { success: false, error: "Depreciation not started in this period" }
    end

    # Calculate days held in this financial year
    held_start = [@profile.depreciation_start_date, fy_dates[:start]].max
    held_end = if @asset.disposed?
                 [@asset.disposal.disposal_date, fy_dates[:end]].min
    else
                 fy_dates[:end]
    end

    days_held = (held_end - held_start).to_i + 1
    days_in_year = (fy_dates[:end] - fy_dates[:start]).to_i + 1

    # Get opening WDV (from previous year's closing or original cost)
    previous_schedule = @asset.depreciation_schedules
                              .where("period_end < ?", fy_dates[:start])
                              .order(period_end: :desc)
                              .first

    book_opening_wdv = previous_schedule&.book_closing_wdv || @profile.depreciable_cost
    tax_opening_wdv = previous_schedule&.tax_closing_wdv || @profile.depreciable_cost

    # Calculate depreciation
    book_depreciation = @profile.calculate_yearly_depreciation(:book, book_opening_wdv, days_held, days_in_year)
    tax_depreciation = @profile.calculate_yearly_depreciation(:tax, tax_opening_wdv, days_held, days_in_year)

    # Calculate accumulated depreciation
    previous_book_accumulated = previous_schedule&.book_accumulated || 0
    previous_tax_accumulated = previous_schedule&.tax_accumulated || 0

    # Find or create schedule record
    schedule = @asset.depreciation_schedules.find_or_initialize_by(financial_year: financial_year)
    schedule.assign_attributes(
      period_start: fy_dates[:start],
      period_end: fy_dates[:end],
      days_held: days_held,
      days_in_year: days_in_year,
      book_opening_wdv: book_opening_wdv,
      tax_opening_wdv: tax_opening_wdv,
      book_depreciation: book_depreciation,
      tax_depreciation: tax_depreciation,
      book_closing_wdv: book_opening_wdv - book_depreciation,
      tax_closing_wdv: tax_opening_wdv - tax_depreciation,
      book_accumulated: previous_book_accumulated + book_depreciation,
      tax_accumulated: previous_tax_accumulated + tax_depreciation,
      book_method_applied: @profile.book_method,
      tax_method_applied: @profile.tax_method,
      status: "calculated"
    )

    if schedule.save
      { success: true, schedule: schedule }
    else
      { success: false, errors: schedule.errors.full_messages }
    end
  end

  # Calculate all years from depreciation start to current FY
  def calculate_all_years
    return { success: false, error: "No depreciation profile" } unless @profile

    start_fy = financial_year_for_date(@profile.depreciation_start_date)
    current_fy = financial_year_for_date(Date.current)

    results = []
    fy = start_fy

    while fy <= current_fy
      result = calculate_for_year(fy)
      results << { financial_year: fy, **result }

      break if @asset.disposed? # Don't calculate beyond disposal

      fy = next_financial_year(fy)
    end

    { success: true, schedules: results }
  end

  # Generate depreciation forecast for future years
  def forecast(years = 10)
    return { success: false, error: "No depreciation profile" } unless @profile
    return { success: false, error: "Asset is disposed" } if @asset.disposed?

    forecasts = []
    current_fy = financial_year_for_date(Date.current)

    # Get current WDV
    latest_schedule = @asset.depreciation_schedules.order(period_end: :desc).first
    book_wdv = latest_schedule&.book_closing_wdv || @profile.depreciable_cost
    tax_wdv = latest_schedule&.tax_closing_wdv || @profile.depreciable_cost
    book_accumulated = latest_schedule&.book_accumulated || 0
    tax_accumulated = latest_schedule&.tax_accumulated || 0

    residual = @profile.residual_value || 0

    years.times do |i|
      fy = offset_financial_year(current_fy, i + 1)

      book_depreciation = @profile.calculate_yearly_depreciation(:book, book_wdv)
      tax_depreciation = @profile.calculate_yearly_depreciation(:tax, tax_wdv)

      book_wdv -= book_depreciation
      tax_wdv -= tax_depreciation
      book_accumulated += book_depreciation
      tax_accumulated += tax_depreciation

      forecasts << {
        financial_year: fy,
        book_depreciation: book_depreciation.round(2),
        tax_depreciation: tax_depreciation.round(2),
        book_closing_wdv: book_wdv.round(2),
        tax_closing_wdv: tax_wdv.round(2),
        book_accumulated: book_accumulated.round(2),
        tax_accumulated: tax_accumulated.round(2)
      }

      # Stop if fully depreciated to residual value
      break if book_wdv <= residual && tax_wdv <= residual
    end

    { success: true, forecasts: forecasts }
  end

  # Class method to calculate depreciation for all assets
  def self.calculate_all_for_year(financial_year, company_id: nil)
    scope = Asset.depreciable
    scope = scope.where(company_id: company_id) if company_id.present?

    results = { success: 0, failed: 0, errors: [] }

    scope.find_each do |asset|
      service = new(asset)
      result = service.calculate_for_year(financial_year)

      if result[:success]
        results[:success] += 1
      else
        results[:failed] += 1
        results[:errors] << { asset_id: asset.id, error: result[:error] || result[:errors] }
      end
    end

    results
  end

  # Get summary statistics for a company
  def self.company_summary(company_id, financial_year = nil)
    financial_year ||= AssetDepreciationSchedule.current_financial_year

    assets = Asset.where(company_id: company_id).active
    schedules = AssetDepreciationSchedule.joins(:asset)
                                          .where(assets: { company_id: company_id })
                                          .where(financial_year: financial_year)

    {
      total_assets: assets.count,
      total_purchase_value: assets.sum(:purchase_price) || 0,
      total_book_wdv: schedules.sum(:book_closing_wdv) || 0,
      total_tax_wdv: schedules.sum(:tax_closing_wdv) || 0,
      total_book_depreciation: schedules.sum(:book_depreciation) || 0,
      total_tax_depreciation: schedules.sum(:tax_depreciation) || 0,
      financial_year: financial_year
    }
  end

  private

  def parse_financial_year(fy_string)
    # Parse "FY2025" to get July 1, 2024 - June 30, 2025
    year = fy_string.gsub(/FY/, "").to_i
    {
      start: Date.new(year - 1, 7, 1),
      end: Date.new(year, 6, 30)
    }
  end

  def financial_year_for_date(date)
    # If July or later, it's the next calendar year's FY
    fy_year = date.month >= 7 ? date.year + 1 : date.year
    "FY#{fy_year}"
  end

  def next_financial_year(fy_string)
    year = fy_string.gsub(/FY/, "").to_i
    "FY#{year + 1}"
  end

  def offset_financial_year(fy_string, offset)
    year = fy_string.gsub(/FY/, "").to_i
    "FY#{year + offset}"
  end
end
