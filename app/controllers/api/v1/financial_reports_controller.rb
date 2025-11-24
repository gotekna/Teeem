module Api
  module V1
    class FinancialReportsController < ApplicationController
      before_action :set_company, only: [:balance_sheet, :profit_loss, :job_profitability]

      # GET /api/v1/financial_reports/balance_sheet
      def balance_sheet
        service = FinancialReportingService.new(company: @company)

        as_of_date = params[:as_of_date] ? Date.parse(params[:as_of_date]) : Date.current
        report = service.generate_balance_sheet(as_of_date: as_of_date)

        render json: {
          success: true,
          report: report
        }
      rescue Date::Error => e
        render json: {
          success: false,
          error: "Invalid date format: #{e.message}"
        }, status: :unprocessable_entity
      rescue FinancialReportingService::ReportError => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # GET /api/v1/financial_reports/profit_loss
      def profit_loss
        service = FinancialReportingService.new(company: @company)

        from_date = params[:from_date] ? Date.parse(params[:from_date]) : Date.current.beginning_of_month
        to_date = params[:to_date] ? Date.parse(params[:to_date]) : Date.current
        group_by = params[:group_by] # 'month', 'quarter', 'year', or nil

        report = service.generate_profit_loss(
          from_date: from_date,
          to_date: to_date,
          group_by: group_by
        )

        render json: {
          success: true,
          report: report
        }
      rescue Date::Error => e
        render json: {
          success: false,
          error: "Invalid date format: #{e.message}"
        }, status: :unprocessable_entity
      rescue FinancialReportingService::ReportError => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # GET /api/v1/financial_reports/job_profitability
      def job_profitability
        service = FinancialReportingService.new(company: @company)

        construction_ids = params[:construction_ids]&.split(',')&.map(&:to_i)
        from_date = params[:from_date] ? Date.parse(params[:from_date]) : nil
        to_date = params[:to_date] ? Date.parse(params[:to_date]) : Date.current

        report = service.generate_job_profitability(
          construction_ids: construction_ids,
          from_date: from_date,
          to_date: to_date
        )

        render json: {
          success: true,
          report: report
        }
      rescue Date::Error => e
        render json: {
          success: false,
          error: "Invalid date format: #{e.message}"
        }, status: :unprocessable_entity
      rescue FinancialReportingService::ReportError => e
        render json: {
          success: false,
          error: e.message
        }, status: :unprocessable_entity
      end

      # GET /api/v1/financial_reports/account_balances
      def account_balances
        service = FinancialReportingService.new(company: @company)

        as_of_date = params[:as_of_date] ? Date.parse(params[:as_of_date]) : Date.current
        balances = service.get_account_balances(as_of_date: as_of_date)

        render json: {
          success: true,
          balances: balances,
          as_of_date: as_of_date.iso8601
        }
      rescue Date::Error => e
        render json: {
          success: false,
          error: "Invalid date format: #{e.message}"
        }, status: :unprocessable_entity
      end

      # GET /api/v1/financial_reports/trial_balance
      def trial_balance
        service = FinancialReportingService.new(company: @company)

        as_of_date = params[:as_of_date] ? Date.parse(params[:as_of_date]) : Date.current
        result = service.trial_balance(as_of_date: as_of_date)

        render json: {
          success: true,
          trial_balance: result
        }
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
    end
  end
end
