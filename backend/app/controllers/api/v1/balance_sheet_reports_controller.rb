# frozen_string_literal: true

module Api
  module V1
    class BalanceSheetReportsController < ApplicationController
      before_action :set_company

      # GET /api/v1/companies/:company_id/balance_sheet_reports
      def index
        reports = @company.balance_sheet_reports.order(financial_year: :desc)

        # Filter by financial year
        reports = reports.for_financial_year(params[:financial_year]) if params[:financial_year].present?

        # Filter by status
        reports = reports.where(status: params[:status]) if params[:status].present?

        render json: {
          success: true,
          data: reports.map { |r| serialize_report(r) },
          summary: {
            total_reports: reports.count,
            completed: reports.completed.count,
            pending: reports.pending.count,
            failed: reports.failed.count,
            financial_years: reports.distinct.pluck(:financial_year).compact.sort.reverse
          }
        }
      end

      # GET /api/v1/companies/:company_id/balance_sheet_reports/:id
      def show
        report = @company.balance_sheet_reports.find(params[:id])

        render json: {
          success: true,
          data: serialize_report(report, include_url: true)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Report not found" }, status: :not_found
      end

      # POST /api/v1/companies/:company_id/balance_sheet_reports/generate
      def generate
        financial_year = params[:financial_year] || current_financial_year

        # Find or create report for this FY
        report = @company.balance_sheet_reports.find_or_initialize_by(financial_year: financial_year)

        if report.new_record?
          report.company_name = @company.name
          report.company_code = @company.short_code.presence || @company.name[0..1].upcase
          report.report_date = financial_year_end(financial_year)
          report.save!
        end

        # Generate the report (fetches from Xero, generates PDF, uploads to SharePoint)
        report.generate!

        render json: {
          success: report.completed?,
          data: serialize_report(report.reload, include_url: true),
          error: report.error_message
        }
      rescue StandardError => e
        Rails.logger.error("Balance Sheet report generation failed: #{e.message}")
        render json: {
          success: false,
          error: "Generation failed: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/companies/:company_id/balance_sheet_reports/:id/regenerate
      def regenerate
        report = @company.balance_sheet_reports.find(params[:id])
        report.generate!

        render json: {
          success: report.completed?,
          data: serialize_report(report.reload, include_url: true),
          error: report.error_message
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Report not found" }, status: :not_found
      end

      # POST /api/v1/companies/:company_id/balance_sheet_reports/generate_historical
      # Generate monthly Balance Sheet reports for all months since Xero connection
      def generate_historical
        result = BalanceSheetReport.generate_historical!(@company)

        render json: {
          success: result[:success],
          data: @company.balance_sheet_reports.order(period_end_date: :desc, financial_year: :desc).map { |r| serialize_report(r) },
          summary: {
            created: result[:created],
            skipped: result[:skipped],
            errors: result[:errors]
          },
          message: result[:success] ? "Generated #{result[:created]} reports (#{result[:skipped]} already existed)" : result[:error]
        }
      rescue StandardError => e
        Rails.logger.error("Historical Balance Sheet generation failed: #{e.message}")
        render json: {
          success: false,
          error: "Generation failed: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/companies/:company_id/balance_sheet_reports/:id/download
      def download
        report = @company.balance_sheet_reports.find(params[:id])

        unless report.status == "completed" && report.cloudinary_url.present?
          return render json: { success: false, error: "Report not available for download" }, status: :unprocessable_entity
        end

        redirect_to report.cloudinary_url, allow_other_host: true
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Report not found" }, status: :not_found
      end

      private

      def set_company
        @company = Corporate.find(params[:company_id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Company not found" }, status: :not_found
      end

      def serialize_report(report, include_url: false)
        data = {
          id: report.id,
          display_name: report.display_name,            # "Balance Sheet December 2025 FY2026"
          company_id: report.company_id,
          company_name: report.company_name,
          company_code: report.company_code,
          financial_year: report.financial_year,
          period: report.period,                        # "Jan25", "Feb25", etc.
          period_end_date: report.period_end_date,      # Date for sorting
          period_label: report.period_label,            # "January 2025" (human-readable)
          report_date: report.report_date,
          total_assets: report.total_assets&.to_f,
          total_liabilities: report.total_liabilities&.to_f,
          net_assets: report.net_assets&.to_f,
          file_name: report.file_name,
          file_size: report.file_size,
          status: report.status,
          error_message: report.error_message,
          generated_at: report.generated_at&.iso8601,
          created_at: report.created_at.iso8601,
          updated_at: report.updated_at.iso8601
        }

        data[:download_url] = report.cloudinary_url if include_url && report.cloudinary_url.present?

        data
      end

      def current_financial_year
        today = Date.current
        year = today.month >= 7 ? today.year + 1 : today.year
        "FY#{year}"
      end

      def financial_year_end(fy)
        year = fy.gsub(/\D/, "").to_i
        Date.new(year, 6, 30)
      end
    end
  end
end
