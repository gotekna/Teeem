module Api
  module V1
    module Portal
      class PropertyValuationsController < BaseController
        before_action :require_owner

        # GET /api/v1/portal/property/valuations
        # Portfolio-wide valuation summary
        def index
          properties = current_portal_user.accessible_properties
            .includes(:property_type, tenancies: [])

          render json: {
            success: true,
            data: {
              portfolio: portfolio_valuation(properties),
              properties: properties.map { |p| property_valuation(p) },
            },
          }
        end

        # GET /api/v1/portal/property/valuations/:property_id
        # Detailed valuations for a single property
        def show
          property = current_portal_user.accessible_properties.find(params[:id])

          render json: {
            success: true,
            data: detailed_valuation(property),
          }
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Property not found" }, status: :not_found
        end

        # POST /api/v1/portal/property/valuations/:property_id/calculate
        # Custom DCF calculation with user-specified parameters
        def calculate
          property = current_portal_user.accessible_properties.find(params[:id])

          dcf = property.dcf_value(
            discount_rate: (params[:discount_rate] || 0.08).to_f,
            rental_growth: (params[:rental_growth] || 0.03).to_f,
            expense_growth: (params[:expense_growth] || 0.025).to_f,
            hold_years: (params[:hold_years] || 10).to_i,
            exit_cap_rate: (params[:exit_cap_rate] || 0.06).to_f,
          )

          cgt = property.estimated_cgt(
            marginal_tax_rate: (params[:marginal_tax_rate] || 0.37).to_f,
            selling_costs: (params[:selling_costs] || 0).to_f,
          )

          render json: {
            success: true,
            data: {
              dcf_value: dcf,
              estimated_cgt: cgt,
              parameters: {
                discount_rate: params[:discount_rate] || 0.08,
                rental_growth: params[:rental_growth] || 0.03,
                expense_growth: params[:expense_growth] || 0.025,
                hold_years: params[:hold_years] || 10,
                exit_cap_rate: params[:exit_cap_rate] || 0.06,
                marginal_tax_rate: params[:marginal_tax_rate] || 0.37,
                selling_costs: params[:selling_costs] || 0,
              },
            },
          }
        rescue ActiveRecord::RecordNotFound
          render json: { success: false, error: "Property not found" }, status: :not_found
        end

        private

        def require_owner
          unless current_portal_user&.owner?
            render json: { success: false, error: "Owner access required" }, status: :forbidden
          end
        end

        def portfolio_valuation(properties)
          total_purchase = properties.sum { |p| p.purchase_price || 0 }
          total_current = properties.sum(&:effective_value)
          total_gain = properties.sum { |p| p.unrealised_capital_gain || 0 }
          total_rent = properties.sum(&:annual_gross_rent)
          total_expenses = properties.sum(&:annual_expenses)

          {
            total_properties: properties.size,
            total_purchase_value: total_purchase,
            total_current_value: total_current,
            total_unrealised_gain: total_gain,
            total_gain_pct: total_purchase.positive? ? ((total_gain / total_purchase) * 100).round(2) : nil,
            total_annual_rent: total_rent,
            total_annual_expenses: total_expenses,
            total_net_income: total_rent - total_expenses,
            portfolio_yield: total_current.positive? ? (((total_rent - total_expenses) / total_current) * 100).round(2) : nil,
          }
        end

        def property_valuation(property)
          {
            id: property.id,
            property_code: property.property_code,
            name: property.name,
            address: property.full_address,
            purchase_price: property.purchase_price,
            purchase_date: property.purchase_date,
            current_valuation: property.current_valuation,
            effective_value: property.effective_value,
            gross_yield: property.gross_rental_yield,
            net_yield: property.net_rental_yield,
            grm: property.gross_rent_multiplier,
            unrealised_gain: property.unrealised_capital_gain,
          }
        end

        def detailed_valuation(property)
          {
            property: {
              id: property.id,
              property_code: property.property_code,
              name: property.name,
              address: property.full_address,
              bedrooms: property.bedrooms,
              bathrooms: property.bathrooms,
              land_area_sqm: property.land_area_sqm,
              floor_area_sqm: property.floor_area_sqm,
              year_built: property.year_built,
              construction_type: property.construction_type,
            },
            purchase: {
              price: property.purchase_price,
              date: property.purchase_date,
              stamp_duty: property.cost_base_stamp_duty,
              legal_fees: property.cost_base_legal_fees,
              other_costs: property.cost_base_other,
              capital_improvements: property.capital_improvements_total,
              total_cost_base: property.total_cost_base,
            },
            current_value: {
              valuation: property.current_valuation,
              valuation_date: property.valuation_date,
              effective_value: property.effective_value,
            },
            income: {
              weekly_rent: property.active_tenancy&.weekly_rent,
              rent_frequency: property.active_tenancy&.rent_frequency,
              annual_gross_rent: property.annual_gross_rent,
              annual_expenses: property.annual_expenses,
              annual_net_income: property.annual_net_income,
              sda: property.active_tenancy&.sda? ? {
                sda_weekly_rate: property.active_tenancy.sda_weekly_rate,
                participant_contribution: property.active_tenancy.participant_rent_contribution,
                ndia_payment: property.active_tenancy.ndia_payment_amount,
              } : nil,
            },
            expenses: {
              management_fee_pct: property.management_fee_pct,
              vacancy_rate_pct: property.vacancy_rate_pct,
              annual_insurance: property.annual_insurance,
              annual_council_rates: property.annual_council_rates,
              annual_water_rates: property.annual_water_rates,
              annual_body_corporate: property.annual_body_corporate,
              annual_other: property.annual_other_expenses,
              total: property.annual_expenses,
            },
            valuations: {
              gross_rental_yield: property.gross_rental_yield,
              net_rental_yield: property.net_rental_yield,
              cap_rate: property.cap_rate,
              gross_rent_multiplier: property.gross_rent_multiplier,
              cost_approach: property.cost_approach_value,
              dcf_10yr: property.dcf_value,
            },
            capital_gains: {
              unrealised_gain: property.unrealised_capital_gain,
              total_cost_base: property.total_cost_base,
              held_over_12_months: property.purchase_date.present? && property.purchase_date < 12.months.ago,
              cgt_discount_eligible: property.purchase_date.present? && property.purchase_date < 12.months.ago,
              estimated_cgt_at_37pct: property.estimated_cgt(marginal_tax_rate: 0.37),
              estimated_cgt_at_45pct: property.estimated_cgt(marginal_tax_rate: 0.45),
            },
          }
        end
      end
    end
  end
end
