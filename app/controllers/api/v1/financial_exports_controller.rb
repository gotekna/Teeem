module Api
  module V1
    class FinancialExportsController < ApplicationController
      before_action :set_company

      # GET /api/v1/financial_exports/transactions
      def transactions
        service = FinancialExportService.new(company: @company)

        filters = build_filters
        csv_data = service.export_transactions_csv(filters: filters)

        send_data csv_data,
                  filename: "transactions_#{Date.current.strftime('%Y%m%d')}.csv",
                  type: 'text/csv'
      end

      # GET /api/v1/financial_exports/balance_sheet
      def balance_sheet
        service = FinancialExportService.new(company: @company)

        as_of_date = params[:as_of_date] ? Date.parse(params[:as_of_date]) : Date.current
        csv_data = service.export_balance_sheet_csv(as_of_date: as_of_date)

        send_data csv_data,
                  filename: "balance_sheet_#{as_of_date.strftime('%Y%m%d')}.csv",
                  type: 'text/csv'
      rescue Date::Error => e
        render json: {
          success: false,
          error: "Invalid date format: #{e.message}"
        }, status: :unprocessable_entity
      end

      # GET /api/v1/financial_exports/profit_loss
      def profit_loss
        service = FinancialExportService.new(company: @company)

        from_date = params[:from_date] ? Date.parse(params[:from_date]) : Date.current.beginning_of_month
        to_date = params[:to_date] ? Date.parse(params[:to_date]) : Date.current
        csv_data = service.export_profit_loss_csv(from_date: from_date, to_date: to_date)

        send_data csv_data,
                  filename: "profit_loss_#{from_date.strftime('%Y%m%d')}_#{to_date.strftime('%Y%m%d')}.csv",
                  type: 'text/csv'
      rescue Date::Error => e
        render json: {
          success: false,
          error: "Invalid date format: #{e.message}"
        }, status: :unprocessable_entity
      end

      # GET /api/v1/financial_exports/job_profitability
      def job_profitability
        service = FinancialExportService.new(company: @company)

        construction_ids = params[:construction_ids]&.split(',')&.map(&:to_i)
        from_date = params[:from_date] ? Date.parse(params[:from_date]) : nil
        to_date = params[:to_date] ? Date.parse(params[:to_date]) : Date.current

        csv_data = service.export_job_profitability_csv(
          construction_ids: construction_ids,
          from_date: from_date,
          to_date: to_date
        )

        send_data csv_data,
                  filename: "job_profitability_#{Date.current.strftime('%Y%m%d')}.csv",
                  type: 'text/csv'
      rescue Date::Error => e
        render json: {
          success: false,
          error: "Invalid date format: #{e.message}"
        }, status: :unprocessable_entity
      end

      # GET /api/v1/financial_exports/chart_of_accounts
      def chart_of_accounts
        service = FinancialExportService.new(company: @company)

        csv_data = service.export_chart_of_accounts_csv

        send_data csv_data,
                  filename: "chart_of_accounts_#{Date.current.strftime('%Y%m%d')}.csv",
                  type: 'text/csv'
      end

      # GET /api/v1/financial_exports/accountant_package
      def accountant_package
        service = FinancialExportService.new(company: @company)

        from_date = params[:from_date] ? Date.parse(params[:from_date]) : Date.current.beginning_of_year
        to_date = params[:to_date] ? Date.parse(params[:to_date]) : Date.current

        csv_data = service.export_accountant_package_csv(from_date: from_date, to_date: to_date)

        send_data csv_data,
                  filename: "accountant_package_#{from_date.strftime('%Y%m%d')}_#{to_date.strftime('%Y%m%d')}.csv",
                  type: 'text/csv'
      rescue Date::Error => e
        render json: {
          success: false,
          error: "Invalid date format: #{e.message}"
        }, status: :unprocessable_entity
      end

      private

      def set_company
        @company = if params[:company_id]
                    Company.find(params[:company_id])
                  else
                    current_user.company
                  end
      rescue ActiveRecord::RecordNotFound
        render json: {
          success: false,
          error: "Company not found"
        }, status: :not_found
      end

      def build_filters
        filters = {}
        filters[:transaction_type] = params[:transaction_type] if params[:transaction_type].present?
        filters[:category] = params[:category] if params[:category].present?
        filters[:status] = params[:status] if params[:status].present?
        filters[:construction_id] = params[:construction_id] if params[:construction_id].present?
        filters[:from_date] = Date.parse(params[:from_date]) if params[:from_date].present?
        filters[:to_date] = Date.parse(params[:to_date]) if params[:to_date].present?
        filters
      end
    end
  end
end
