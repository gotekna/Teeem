module Api
  module V1
    class SdaPriceGuidesController < BaseController
      # GET /api/v1/sda_price_guide
      def show
        guide = SdaPriceGuide.current_guide
        unless guide
          render json: { success: false, error: "No SDA Price Guide loaded" }, status: :not_found
          return
        end

        render json: {
          success: true,
          data: {
            financial_year: guide.financial_year,
            version: guide.version,
            valid_from: guide.valid_from,
            valid_to: guide.valid_to,
            expired: SdaPriceGuide.expired?,
            mrrc_single_annual: SdaPriceGuide.mrrc_annual(participant_type: "single"),
            mrrc_couple_annual: SdaPriceGuide.mrrc_annual(participant_type: "couple_each"),
            building_types: SdaPriceGuide::BUILDING_TYPES,
            design_categories: SdaPriceGuide::DESIGN_CATEGORIES,
            dwelling_stock_types: SdaPriceGuide::DWELLING_STOCK_TYPES,
          },
        }
      end

      # GET /api/v1/sda_price_guide/rates
      # Params: dwelling_stock_type, building_type, design_category, fire_sprinklers, gst_credits_claimed
      def rates
        guide = SdaPriceGuide.current_guide
        unless guide
          render json: { success: false, error: "No SDA Price Guide loaded" }, status: :not_found
          return
        end

        scope = guide.sda_benchmark_rates

        scope = scope.where(dwelling_stock_type: params[:dwelling_stock_type]) if params[:dwelling_stock_type].present?
        scope = scope.where(building_type: params[:building_type]) if params[:building_type].present?
        scope = scope.where(design_category: params[:design_category]) if params[:design_category].present?

        if params[:fire_sprinklers].present?
          scope = scope.where(fire_sprinklers: ActiveModel::Type::Boolean.new.cast(params[:fire_sprinklers]))
        end
        if params[:gst_credits_claimed].present?
          scope = scope.where(gst_credits_claimed: ActiveModel::Type::Boolean.new.cast(params[:gst_credits_claimed]))
        end

        rates = scope.order(:building_type, :design_category, :onsite_overnight_assistance)
          .map do |rate|
            {
              id: rate.id,
              dwelling_stock_type: rate.dwelling_stock_type,
              building_type: rate.building_type,
              building_label: rate.label,
              max_residents: rate.max_residents,
              design_category: rate.design_category,
              fire_sprinklers: rate.fire_sprinklers,
              gst_credits_claimed: rate.gst_credits_claimed,
              onsite_overnight_assistance: rate.onsite_overnight_assistance,
              annual_base_price: rate.annual_base_price,
              weekly_rate: rate.weekly_rate,
            }
          end

        render json: { success: true, data: rates }
      end

      # GET /api/v1/sda_price_guide/calculate
      # Params: property_id OR manual params (dwelling_stock_type, building_type, design_category, etc.)
      def calculate
        guide = SdaPriceGuide.current_guide
        unless guide
          render json: { success: false, error: "No SDA Price Guide loaded" }, status: :not_found
          return
        end

        if params[:property_id].present?
          property = Property.find(params[:property_id])
          annual_amount = SdaPriceGuide.lookup_rate(property)
          mrrc_annual = SdaPriceGuide.mrrc_annual

          render json: {
            success: true,
            data: {
              annual_sda_amount: annual_amount,
              weekly_sda_amount: annual_amount ? (annual_amount / 52.0).round(2) : nil,
              mrrc_annual: mrrc_annual,
              mrrc_weekly: mrrc_annual ? (mrrc_annual / 52.0).round(2) : nil,
              total_annual: annual_amount && mrrc_annual ? annual_amount + mrrc_annual : nil,
              financial_year: guide.financial_year,
              expired: SdaPriceGuide.expired?,
            },
          }
        else
          # Manual calculation
          rate = guide.sda_benchmark_rates.find_by(
            dwelling_stock_type: params[:dwelling_stock_type] || "post_2023_new_build",
            building_type: params[:building_type],
            design_category: params[:design_category],
            fire_sprinklers: ActiveModel::Type::Boolean.new.cast(params[:fire_sprinklers] || "false"),
            gst_credits_claimed: ActiveModel::Type::Boolean.new.cast(params[:gst_credits_claimed] || "true"),
            onsite_overnight_assistance: ActiveModel::Type::Boolean.new.cast(params[:ooa] || "false")
          )

          unless rate
            render json: { success: false, error: "No matching rate found" }, status: :not_found
            return
          end

          # Apply location factor if provided
          annual_amount = rate.annual_base_price
          location_factor = 1.0

          if params[:sa4_region].present?
            stock_type = params[:dwelling_stock_type]&.include?("new_build") ? "new_build" : "existing_legacy"
            factor_record = guide.sda_location_factors.find_by(
              sa4_region: params[:sa4_region],
              stock_type: stock_type,
              building_type: params[:building_type]
            )
            location_factor = factor_record&.factor || 1.0
            annual_amount = (annual_amount * location_factor).round(0)
          end

          mrrc_annual = SdaPriceGuide.mrrc_annual

          render json: {
            success: true,
            data: {
              annual_sda_amount: annual_amount,
              weekly_sda_amount: (annual_amount / 52.0).round(2),
              location_factor: location_factor,
              mrrc_annual: mrrc_annual,
              mrrc_weekly: mrrc_annual ? (mrrc_annual / 52.0).round(2) : nil,
              total_annual: mrrc_annual ? annual_amount + mrrc_annual : annual_amount,
              financial_year: guide.financial_year,
              expired: SdaPriceGuide.expired?,
            },
          }
        end
      end

      # GET /api/v1/sda_price_guide/location_factors
      def location_factors
        guide = SdaPriceGuide.current_guide
        unless guide
          render json: { success: false, error: "No SDA Price Guide loaded" }, status: :not_found
          return
        end

        regions = guide.sda_location_factors
          .select(:sa4_region)
          .distinct
          .order(:sa4_region)
          .pluck(:sa4_region)

        render json: { success: true, data: regions }
      end
    end
  end
end
