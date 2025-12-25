# frozen_string_literal: true

module Api
  module V1
    module Gl
      class CurrenciesController < ApplicationController
        before_action :set_currency, only: %i[show update destroy set_as_base]

        # GET /api/v1/gl/currencies
        def index
          currencies = current_company.gl_currencies.ordered

          currencies = currencies.active if params[:active] == 'true'

          render json: {
            success: true,
            data: currencies.map { |c| currency_json(c) },
            base_currency: base_currency_json
          }
        end

        # GET /api/v1/gl/currencies/:id
        def show
          render json: {
            success: true,
            data: currency_json(@currency, include_rates: true)
          }
        end

        # POST /api/v1/gl/currencies
        def create
          currency = current_company.gl_currencies.build(currency_params)

          if currency.save
            render json: {
              success: true,
              data: currency_json(currency)
            }, status: :created
          else
            render json: {
              success: false,
              error: currency.errors.full_messages.join(', ')
            }, status: :unprocessable_entity
          end
        end

        # PATCH/PUT /api/v1/gl/currencies/:id
        def update
          if @currency.update(currency_params)
            render json: {
              success: true,
              data: currency_json(@currency)
            }
          else
            render json: {
              success: false,
              error: @currency.errors.full_messages.join(', ')
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/currencies/:id
        def destroy
          if @currency.base?
            return render json: {
              success: false,
              error: 'Cannot delete base currency'
            }, status: :unprocessable_entity
          end

          # Check if currency is in use
          if currency_in_use?(@currency)
            return render json: {
              success: false,
              error: 'Currency is in use and cannot be deleted'
            }, status: :unprocessable_entity
          end

          @currency.destroy!
          render json: { success: true }
        end

        # POST /api/v1/gl/currencies/:id/set_as_base
        def set_as_base
          # Remove base flag from current base
          current_base = ::Gl::Currency.base_currency_for(current_company)
          current_base&.update!(is_base_currency: false)

          # Set new base
          @currency.update!(is_base_currency: true)

          render json: {
            success: true,
            data: currency_json(@currency),
            message: "#{@currency.code} is now the base currency"
          }
        rescue ActiveRecord::RecordInvalid => e
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end

        # POST /api/v1/gl/currencies/setup_defaults
        def setup_defaults
          base_code = params[:base_code] || 'AUD'
          ::Gl::Currency.setup_defaults_for(current_company, base_code: base_code)

          render json: {
            success: true,
            message: "Default currencies set up with #{base_code} as base",
            data: current_company.gl_currencies.reload.map { |c| currency_json(c) }
          }
        end

        # GET /api/v1/gl/currencies/convert
        def convert
          converter = ::Gl::CurrencyConverter.new(current_company)

          result = converter.convert(
            params[:amount].to_d,
            from_currency: params[:from],
            to_currency: params[:to],
            date: parse_date(params[:date])
          )

          render json: {
            success: true,
            data: result
          }
        rescue ArgumentError => e
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end

        # ═══════════════════════════════════════════════════════════════
        # EXCHANGE RATES
        # ═══════════════════════════════════════════════════════════════

        # GET /api/v1/gl/currencies/rates
        def rates
          date = parse_date(params[:date])
          converter = ::Gl::CurrencyConverter.new(current_company)

          render json: {
            success: true,
            data: converter.rates_for_date(date),
            date: date
          }
        end

        # POST /api/v1/gl/currencies/rates
        def set_rate
          service = ::Gl::RatesFetchService.new(current_company)

          result = service.set_manual_rate(
            params[:currency_code],
            params[:rate].to_d,
            date: parse_date(params[:date])
          )

          if result[:success]
            render json: { success: true, data: result }
          else
            render json: { success: false, error: result[:error] }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/currencies/rates/fetch
        def fetch_rates
          service = ::Gl::RatesFetchService.new(current_company)

          result = service.fetch_rates(
            date: parse_date(params[:date]),
            source: params[:source] || 'auto'
          )

          if result[:success]
            render json: { success: true, data: result }
          else
            render json: { success: false, error: result[:error] }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/currencies/rates/import
        def import_rates
          service = ::Gl::RatesFetchService.new(current_company)

          result = service.import_rates(
            params[:rates].to_unsafe_h,
            date: parse_date(params[:date]),
            source: params[:source] || 'manual'
          )

          render json: { success: true, data: result }
        end

        # GET /api/v1/gl/currencies/rates/history
        def rate_history
          service = ::Gl::RatesFetchService.new(current_company)

          history = service.rate_history(
            params[:currency_code],
            from_date: parse_date(params[:from_date], default: 30.days.ago.to_date),
            to_date: parse_date(params[:to_date])
          )

          render json: {
            success: true,
            data: history,
            currency: params[:currency_code]
          }
        end

        # GET /api/v1/gl/currencies/rates/stale
        def rates_stale
          service = ::Gl::RatesFetchService.new(current_company)

          render json: {
            success: true,
            stale: service.rates_stale?
          }
        end

        # ═══════════════════════════════════════════════════════════════
        # REVALUATION
        # ═══════════════════════════════════════════════════════════════

        # GET /api/v1/gl/currencies/revaluation/preview
        def revaluation_preview
          service = ::Gl::CurrencyRevaluationService.new(
            current_company,
            revaluation_date: parse_date(params[:date])
          )

          render json: {
            success: true,
            data: service.preview
          }
        end

        # POST /api/v1/gl/currencies/revaluation/run
        def run_revaluation
          service = ::Gl::CurrencyRevaluationService.new(
            current_company,
            revaluation_date: parse_date(params[:date])
          )

          result = service.run_full_revaluation(
            create_journals: params[:create_journals] != false
          )

          render json: {
            success: true,
            data: result
          }
        end

        # GET /api/v1/gl/currencies/gain_loss
        def gain_loss
          converter = ::Gl::CurrencyConverter.new(current_company)

          result = converter.exchange_gain_loss(
            params[:amount].to_d,
            currency: params[:currency],
            original_date: parse_date(params[:original_date]),
            revaluation_date: parse_date(params[:revaluation_date])
          )

          render json: {
            success: true,
            data: result
          }
        rescue ArgumentError => e
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end

        private

        def set_currency
          @currency = current_company.gl_currencies.find(params[:id])
        end

        def currency_params
          params.permit(:code, :name, :symbol, :decimal_places, :is_base_currency, :active)
        end

        def parse_date(value, default: Date.current)
          return default if value.blank?

          Date.parse(value.to_s)
        rescue ArgumentError
          default
        end

        def currency_json(currency, include_rates: false)
          data = {
            id: currency.id,
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            decimal_places: currency.decimal_places,
            is_base_currency: currency.is_base_currency,
            active: currency.active,
            display_name: currency.display_name,
            current_rate: currency.rate_for(Date.current),
            created_at: currency.created_at,
            updated_at: currency.updated_at
          }

          if include_rates
            data[:recent_rates] = currency.exchange_rates
              .order(effective_date: :desc)
              .limit(30)
              .map do |rate|
                {
                  date: rate.effective_date,
                  rate: rate.rate,
                  source: rate.source,
                  change: rate.rate_change,
                  change_percentage: rate.rate_change_percentage
                }
              end
          end

          data
        end

        def base_currency_json
          base = ::Gl::Currency.base_currency_for(current_company)
          return nil unless base

          {
            id: base.id,
            code: base.code,
            name: base.name,
            symbol: base.symbol
          }
        end

        def currency_in_use?(currency)
          # Check if currency is used in any accounts, invoices, etc.
          Gl::Account.where(
            corporate_company: current_company,
            currency_code: currency.code
          ).exists? ||
          Gl::Invoice.where(
            corporate_company: current_company,
            currency_code: currency.code
          ).exists? ||
          Gl::JournalEntry.where(
            corporate_company: current_company,
            currency_code: currency.code
          ).exists?
        end

        def current_company
          @current_company ||= CorporateCompany.find(params[:corporate_company_id] || current_user.corporate_company_id)
        end
      end
    end
  end
end
