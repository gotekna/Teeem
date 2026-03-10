# frozen_string_literal: true

module Api
  module V1
    # NDIS Price Guides Controller
    #
    # Provides SDA price guide rates for use in claim calculations and tenant UI.
    #
    # Primary source: NdisPriceGuide model (when available via migration).
    # Fallback:       SdaPaymentCalculator::SDA_PRICE_LIMITS (hardcoded 2025-26 rates).
    #
    # This dual-source design means the endpoint works immediately with static rates,
    # and automatically upgrades to database-driven rates once the NdisPriceGuide
    # migration is in place.
    class NdisPriceGuidesController < ApplicationController
      # GET /api/v1/ndis_price_guides
      # Returns all current SDA price guide rates.
      # Params:
      #   financial_year: e.g. "2025-26" (optional, defaults to current/latest)
      def index
        if ndis_price_guide_table_exists?
          guides = NdisPriceGuide.all
          guides = guides.where(financial_year: params[:financial_year]) if params[:financial_year].present?
          guides = guides.order(:sda_category, :location_group)

          render json: {
            success: true,
            data:    guides.as_json,
            source:  "database"
          }
        else
          render json: {
            success: true,
            data:    static_price_guide_data,
            source:  "static",
            note:    "Using built-in 2025-26 rates. Run ndis_price_guides migration for database-managed rates."
          }
        end
      end

      # GET /api/v1/ndis_price_guides/rate
      # Looks up a specific rate by SDA category and optional parameters.
      # Params:
      #   category:        SDA category (required) - improved_liveability / fully_accessible / robust / high_physical_support
      #   building_type:   new_build | existing (default: new_build)
      #   location_group:  1-5 (default: 1 = Major Cities), only used when database available
      def rate
        category      = params[:category]
        building_type = params[:building_type].presence || "new_build"

        unless Property::SDA_CATEGORIES.include?(category)
          return render_error(
            "Invalid SDA category. Must be one of: #{Property::SDA_CATEGORIES.join(', ')}",
            status: :bad_request
          )
        end

        unless %w[new_build existing].include?(building_type)
          return render_error("Invalid building_type. Must be 'new_build' or 'existing'", status: :bad_request)
        end

        if ndis_price_guide_table_exists?
          location_group = params[:location_group].presence || "1"
          guide = NdisPriceGuide.find_by(
            sda_category:   category,
            building_type:  building_type,
            location_group: location_group
          )

          if guide
            render json: { success: true, data: guide.as_json, source: "database" }
          else
            # Fallback to static if specific combination not in DB
            weekly_rate = SdaPaymentCalculator.price_limit(category, building_type)
            render json: {
              success:     true,
              data:        static_rate_response(category, building_type, weekly_rate),
              source:      "static_fallback",
              note:        "Rate not found in database for this combination. Using built-in rate."
            }
          end
        else
          weekly_rate = SdaPaymentCalculator.price_limit(category, building_type)
          render json: {
            success: true,
            data:    static_rate_response(category, building_type, weekly_rate),
            source:  "static"
          }
        end
      end

      private

      def ndis_price_guide_table_exists?
        @ndis_price_guide_exists ||= Object.const_defined?("NdisPriceGuide") && NdisPriceGuide.table_exists?
      end

      # Returns the full static price guide data derived from SdaPaymentCalculator.
      def static_price_guide_data
        financial_year = "2025-26"

        Property::SDA_CATEGORIES.flat_map do |category|
          %w[new_build existing].map do |building_type|
            weekly_rate = SdaPaymentCalculator.price_limit(category, building_type)
            {
              sdaCategory:    category,
              buildingType:   building_type,
              locationGroup:  "1",
              weeklyRate:     weekly_rate.to_f,
              annualRate:     (weekly_rate * 52).to_f.round(2),
              financialYear:  financial_year
            }
          end
        end
      end

      def static_rate_response(category, building_type, weekly_rate)
        {
          sdaCategory:   category,
          buildingType:  building_type,
          locationGroup: params[:location_group].presence || "1",
          weeklyRate:    weekly_rate.to_f,
          annualRate:    (weekly_rate * 52).to_f.round(2),
          financialYear: "2025-26",
          mrrDspBase:    SdaPaymentCalculator::DSP_BASE_WEEKLY.to_f,
          mrrCraMax:     SdaPaymentCalculator::CRA_MAX_WEEKLY.to_f,
          maxParticipantContribution: (
            SdaPaymentCalculator::DSP_BASE_WEEKLY * SdaPaymentCalculator::MRRC_DSP_PERCENTAGE +
            SdaPaymentCalculator::CRA_MAX_WEEKLY
          ).to_f.round(2)
        }
      end
    end
  end
end
