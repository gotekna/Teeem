module Api
  module V1
    class AssetReportsController < ApplicationController
      # GET /api/v1/asset_reports/register
      # Asset Register - Full list of all assets with values and status
      def register
        assets = Asset.includes(:corporate_company, :depreciation_profile, :asset_insurance, :assigned_user)
                      .order(:company_id, :asset_type, :name)

        # Apply filters
        assets = assets.where(company_id: params[:company_id]) if params[:company_id].present?
        assets = assets.where(asset_type: params[:asset_type]) if params[:asset_type].present?
        assets = assets.where(status: params[:status]) if params[:status].present?

        render json: {
          success: true,
          report: {
            title: "Asset Register",
            generated_at: Time.current.iso8601,
            filters: {
              company_id: params[:company_id],
              asset_type: params[:asset_type],
              status: params[:status]
            },
            summary: {
              total_assets: assets.count,
              total_purchase_value: assets.sum(:purchase_price) || 0,
              total_book_value: assets.sum(:current_book_value) || 0,
              by_type: assets.group(:asset_type).count,
              by_status: assets.group(:status).count
            },
            assets: assets.map do |asset|
              {
                id: asset.id,
                asset_number: asset.asset_number,
                name: asset.name,
                display_name: asset.display_name,
                asset_type: asset.asset_type,
                status: asset.status,
                company_name: asset.corporate_company&.name,
                company_code: asset.corporate_company&.code,
                make: asset.make,
                model: asset.model,
                serial_number: asset.serial_number,
                registration_number: asset.registration_number,
                location: asset.location,
                assigned_to: asset.assigned_user&.full_name,
                purchase_date: asset.purchase_date,
                purchase_price: asset.purchase_price,
                current_book_value: asset.current_book_value,
                depreciation_method: asset.depreciation_profile&.book_method,
                effective_life: asset.depreciation_profile&.effective_life_years,
                insurance_status: asset.asset_insurance&.status,
                insurance_expiry: asset.asset_insurance&.renewal_date
              }
            end
          }
        }
      end

      # GET /api/v1/asset_reports/depreciation
      # Depreciation Schedule - Year-by-year depreciation for all assets
      def depreciation
        financial_year = params[:financial_year] || current_financial_year

        assets = Asset.includes(:corporate_company, :depreciation_profile, :depreciation_schedules)
                      .joins(:depreciation_profile)
                      .order(:company_id, :asset_type, :name)

        # Apply filters
        assets = assets.where(company_id: params[:company_id]) if params[:company_id].present?
        assets = assets.where(asset_type: params[:asset_type]) if params[:asset_type].present?

        # Get schedules for the selected financial year
        schedules = AssetDepreciationSchedule.where(financial_year: financial_year)
                                              .index_by(&:asset_id)

        render json: {
          success: true,
          report: {
            title: "Depreciation Schedule",
            financial_year: financial_year,
            generated_at: Time.current.iso8601,
            filters: {
              company_id: params[:company_id],
              asset_type: params[:asset_type]
            },
            summary: {
              total_assets: assets.count,
              total_book_depreciation: schedules.values.sum { |s| s.book_depreciation || 0 },
              total_tax_depreciation: schedules.values.sum { |s| s.tax_depreciation || 0 },
              total_book_wdv: schedules.values.sum { |s| s.book_closing_wdv || 0 },
              total_tax_wdv: schedules.values.sum { |s| s.tax_closing_wdv || 0 }
            },
            assets: assets.map do |asset|
              schedule = schedules[asset.id]
              profile = asset.depreciation_profile

              {
                id: asset.id,
                asset_number: asset.asset_number,
                name: asset.name,
                display_name: asset.display_name,
                asset_type: asset.asset_type,
                company_name: asset.corporate_company&.name,
                purchase_date: asset.purchase_date,
                purchase_price: asset.purchase_price,
                depreciable_cost: profile&.depreciable_cost,
                residual_value: profile&.residual_value,
                effective_life_years: profile&.effective_life_years,
                book_method: profile&.book_method,
                tax_method: profile&.tax_method,
                depreciation_start_date: profile&.depreciation_start_date,
                is_division_43: profile&.is_division_43,
                division_43_rate: profile&.division_43_rate,
                in_low_value_pool: profile&.in_low_value_pool,
                schedule: schedule ? {
                  days_held: schedule.days_held,
                  book_opening_wdv: schedule.book_opening_wdv,
                  book_depreciation: schedule.book_depreciation,
                  book_closing_wdv: schedule.book_closing_wdv,
                  book_accumulated: schedule.book_accumulated,
                  tax_opening_wdv: schedule.tax_opening_wdv,
                  tax_depreciation: schedule.tax_depreciation,
                  tax_closing_wdv: schedule.tax_closing_wdv,
                  tax_accumulated: schedule.tax_accumulated,
                  status: schedule.status
                } : nil
              }
            end
          }
        }
      end

      # GET /api/v1/asset_reports/insurance
      # Insurance Summary - Coverage, renewals, and premiums
      def insurance
        assets = Asset.includes(:corporate_company, :asset_insurance)
                      .joins(:asset_insurance)
                      .order(:company_id, "asset_insurances.renewal_date")

        # Apply filters
        assets = assets.where(company_id: params[:company_id]) if params[:company_id].present?
        assets = assets.where(asset_type: params[:asset_type]) if params[:asset_type].present?

        # Status filter
        case params[:insurance_status]
        when "expired"
          assets = assets.where("asset_insurances.renewal_date < ?", Date.current)
        when "expiring_soon"
          assets = assets.where("asset_insurances.renewal_date BETWEEN ? AND ?", Date.current, 30.days.from_now)
        when "active"
          assets = assets.where("asset_insurances.renewal_date >= ?", Date.current)
        end

        # Calculate summaries
        all_insurances = AssetInsurance.joins(:asset).where(assets: { id: assets.pluck(:id) })
        expired_count = all_insurances.where("renewal_date < ?", Date.current).count
        expiring_soon_count = all_insurances.where("renewal_date BETWEEN ? AND ?", Date.current, 30.days.from_now).count

        render json: {
          success: true,
          report: {
            title: "Insurance Summary",
            generated_at: Time.current.iso8601,
            filters: {
              company_id: params[:company_id],
              asset_type: params[:asset_type],
              insurance_status: params[:insurance_status]
            },
            summary: {
              total_insured_assets: assets.count,
              total_annual_premium: all_insurances.sum(:premium_amount) || 0,
              total_coverage: all_insurances.sum(:coverage_amount) || 0,
              expired_count: expired_count,
              expiring_soon_count: expiring_soon_count,
              by_insurer: all_insurances.group(:insurer_name).count
            },
            assets: assets.map do |asset|
              insurance = asset.asset_insurance

              {
                id: asset.id,
                asset_number: asset.asset_number,
                name: asset.name,
                display_name: asset.display_name,
                asset_type: asset.asset_type,
                company_name: asset.corporate_company&.name,
                current_book_value: asset.current_book_value,
                insurance: {
                  id: insurance.id,
                  policy_number: insurance.policy_number,
                  insurer_name: insurance.insurer_name,
                  broker_name: insurance.broker_name,
                  start_date: insurance.start_date,
                  renewal_date: insurance.renewal_date,
                  premium_amount: insurance.premium_amount,
                  coverage_amount: insurance.coverage_amount,
                  excess_amount: insurance.excess_amount,
                  payment_frequency: insurance.payment_frequency,
                  status: insurance.status,
                  days_until_renewal: insurance.days_until_renewal,
                  expired: insurance.expired?,
                  expiring_soon: insurance.expiring_soon?
                }
              }
            end
          }
        }
      end

      # GET /api/v1/asset_reports/summary
      # Dashboard summary with key metrics
      def summary
        assets = Asset.includes(:corporate_company, :depreciation_profile, :asset_insurance)

        # Apply company filter
        assets = assets.where(company_id: params[:company_id]) if params[:company_id].present?

        active_assets = assets.where(status: "active")
        disposed_assets = assets.where(status: "disposed")

        # Insurance metrics
        insured_assets = assets.joins(:asset_insurance)
        expired_insurance = insured_assets.where("asset_insurances.renewal_date < ?", Date.current)
        expiring_soon = insured_assets.where("asset_insurances.renewal_date BETWEEN ? AND ?", Date.current, 30.days.from_now)

        # Depreciation metrics for current FY
        current_fy = current_financial_year
        fy_schedules = AssetDepreciationSchedule.joins(:asset)
                                                 .where(financial_year: current_fy)
        fy_schedules = fy_schedules.where(assets: { company_id: params[:company_id] }) if params[:company_id].present?

        render json: {
          success: true,
          summary: {
            total_assets: assets.count,
            active_assets: active_assets.count,
            disposed_assets: disposed_assets.count,
            by_type: assets.group(:asset_type).count,
            by_status: assets.group(:status).count,
            financials: {
              total_purchase_value: assets.sum(:purchase_price) || 0,
              total_book_value: active_assets.sum(:current_book_value) || 0,
              total_depreciation: (assets.sum(:purchase_price) || 0) - (active_assets.sum(:current_book_value) || 0)
            },
            current_fy_depreciation: {
              financial_year: current_fy,
              book_depreciation: fy_schedules.sum(:book_depreciation) || 0,
              tax_depreciation: fy_schedules.sum(:tax_depreciation) || 0
            },
            insurance: {
              insured_count: insured_assets.count,
              uninsured_count: assets.count - insured_assets.count,
              expired_count: expired_insurance.count,
              expiring_soon_count: expiring_soon.count,
              total_annual_premium: AssetInsurance.joins(:asset).where(assets: { id: assets.pluck(:id) }).sum(:premium_amount) || 0
            }
          }
        }
      end

      private

      def current_financial_year
        today = Date.current
        year = today.month >= 7 ? today.year + 1 : today.year
        "FY#{year}"
      end
    end
  end
end
