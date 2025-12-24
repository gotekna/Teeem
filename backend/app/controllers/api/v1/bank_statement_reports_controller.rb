# frozen_string_literal: true

module Api
  module V1
    class BankStatementReportsController < ApplicationController
      before_action :set_company, only: [:index, :show, :generate_historical, :regenerate, :download], if: -> { params[:company_id].present? }

      # GET /api/v1/bank_statement_reports (global)
      # GET /api/v1/companies/:company_id/bank_statement_reports (company-scoped)
      # List generated reports, organized by bank and FY
      def index
        reports = base_scope.order(period_end: :desc, financial_year: :desc, bank_account_name: :asc)

        # Filter by bank account
        reports = reports.for_bank_account(params[:bank_account_id]) if params[:bank_account_id].present?

        # Filter by financial year
        reports = reports.for_financial_year(params[:financial_year]) if params[:financial_year].present?

        # Filter by status
        reports = reports.where(status: params[:status]) if params[:status].present?

        # Filter by bank code (e.g., NAB, WBC, BOQ, CBA, ANZ)
        reports = reports.for_bank(params[:bank_code]) if params[:bank_code].present?

        # Filter by company code (e.g., TH) - only for global route
        reports = reports.for_company(params[:company_code]) if params[:company_code].present? && @company.nil?

        render json: {
          success: true,
          data: reports.map { |r| serialize_report(r) },
          summary: {
            total_reports: reports.count,
            completed: reports.completed.count,
            pending: reports.pending.count,
            failed: reports.failed.count,
            bank_accounts: reports.unscope(:order).distinct.pluck(:bank_account_name).compact.sort,
            bank_codes: reports.unscope(:order).distinct.pluck(:bank_code).compact.sort,
            financial_years: reports.unscope(:order).distinct.pluck(:financial_year).compact.sort.reverse
          }
        }
      end

      # GET /api/v1/bank_statement_reports/:id
      # GET /api/v1/companies/:company_id/bank_statement_reports/:id
      def show
        report = base_scope.find(params[:id])

        render json: {
          success: true,
          data: serialize_report(report, include_url: true)
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Report not found" }, status: :not_found
      end

      # GET /api/v1/bank_statement_reports/:id/download
      # GET /api/v1/companies/:company_id/bank_statement_reports/:id/download
      # Download the PDF file (redirects to SharePoint URL)
      def download
        report = base_scope.find(params[:id])

        unless report.status == "completed" && report.cloudinary_url.present?
          return render json: { success: false, error: "Report not available for download" }, status: :unprocessable_entity
        end

        # Redirect to SharePoint URL for download
        redirect_to report.cloudinary_url, allow_other_host: true
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Report not found" }, status: :not_found
      end

      # POST /api/v1/bank_statement_reports/generate_all (global - all companies)
      # Trigger generation of all missing/outdated reports globally
      def generate_all
        result = BankStatementReportGenerationJob.perform_now(force: params[:force] == "true")

        render json: {
          success: true,
          data: result
        }
      rescue StandardError => e
        Rails.logger.error("Bank statement report generation failed: #{e.message}")
        render json: {
          success: false,
          error: "Generation failed: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/companies/:company_id/bank_statement_reports/generate_historical
      # Generate monthly bank statement reports for this company's bank accounts
      def generate_historical
        unless @company
          return render json: { success: false, error: "Company ID required" }, status: :bad_request
        end

        result = BankStatementReport.generate_historical!(@company)

        render json: {
          success: result[:success],
          data: @company.bank_accounts.linked_to_xero.flat_map do |ba|
            BankStatementReport.for_company_id(@company.id)
                               .for_bank_account(ba.xero_account_id)
                               .order(period_end: :desc)
                               .map { |r| serialize_report(r) }
          end,
          summary: {
            created: result[:created],
            skipped: result[:skipped],
            errors: result[:errors]
          },
          message: result[:success] ? "Generated #{result[:created]} reports (#{result[:skipped]} already existed)" : result[:error]
        }
      rescue StandardError => e
        Rails.logger.error("Historical bank statement generation failed: #{e.message}")
        render json: {
          success: false,
          error: "Generation failed: #{e.message}"
        }, status: :internal_server_error
      end

      # POST /api/v1/bank_statement_reports/:id/regenerate
      # POST /api/v1/companies/:company_id/bank_statement_reports/:id/regenerate
      # Regenerate a specific report
      def regenerate
        report = base_scope.find(params[:id])
        result = report.generate!

        render json: {
          success: result[:success],
          data: serialize_report(report.reload, include_url: true),
          error: result[:error]
        }
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Report not found" }, status: :not_found
      end

      # POST /api/v1/bank_statement_reports/batch_regenerate
      # Start batch regeneration of bank statement PDFs and document records
      # This is designed for bulk operations when bringing in new companies
      def batch_regenerate
        company_id = params[:company_id].presence&.to_i
        batch_size = (params[:batch_size].presence || 10).to_i
        force = params[:force] == "true"
        auto_continue = params[:auto_continue] == "true"

        # Enqueue the job
        BankStatementBatchRegenerateJob.perform_later(
          company_id: company_id,
          batch_size: batch_size,
          force: force,
          auto_continue: auto_continue
        )

        # Return current progress
        progress = BankStatementBatchRegenerateJob.progress(company_id: company_id, force: force)

        render json: {
          success: true,
          message: "Batch regeneration job enqueued",
          data: {
            job_enqueued: true,
            company_id: company_id,
            batch_size: batch_size,
            force: force,
            auto_continue: auto_continue,
            progress: progress
          }
        }
      rescue StandardError => e
        Rails.logger.error("Batch regeneration failed to start: #{e.message}")
        render json: {
          success: false,
          error: "Failed to start batch regeneration: #{e.message}"
        }, status: :internal_server_error
      end

      # GET /api/v1/bank_statement_reports/batch_progress
      # Get current progress of batch regeneration
      def batch_progress
        company_id = params[:company_id].presence&.to_i
        force = params[:force] == "true"

        progress = BankStatementBatchRegenerateJob.progress(company_id: company_id, force: force)

        # Get list of companies with pending work
        companies_with_pending = CorporateCompany
          .joins("LEFT JOIN bank_statement_reports ON bank_statement_reports.company_id = corporate_companies.id")
          .where(bank_statement_reports: { status: "completed" })
          .select("corporate_companies.id, corporate_companies.name, corporate_companies.code")
          .group("corporate_companies.id, corporate_companies.name, corporate_companies.code")
          .having("COUNT(bank_statement_reports.id) > 0")
          .map do |company|
            company_progress = BankStatementBatchRegenerateJob.progress(company_id: company.id, force: force)
            {
              id: company.id,
              name: company.name,
              code: company.code,
              total: company_progress[:total],
              completed: company_progress[:completed],
              pending: company_progress[:pending],
              percent: company_progress[:percent]
            }
          end
          .select { |c| c[:pending] > 0 || company_id.present? }

        render json: {
          success: true,
          data: {
            overall: progress,
            by_company: companies_with_pending.sort_by { |c| -c[:pending] }
          }
        }
      end

      # GET /api/v1/bank_statement_reports/by_structure
      # Returns reports organized by bank -> FY -> month for tree view
      def by_structure
        reports = base_scope.completed.order(bank_account_name: :asc, financial_year: :desc, month: :asc)

        # Group by bank account
        structure = {}
        reports.each do |report|
          bank = report.bank_account_name
          fy = report.financial_year

          structure[bank] ||= {
            name: bank,
            bank_account_id: report.bank_account_id,
            bank_code: report.bank_code,
            account_number: report.account_number,
            years: {}
          }
          structure[bank][:years][fy] ||= { financial_year: fy, months: [] }
          structure[bank][:years][fy][:months] << {
            id: report.id,
            month: report.month,
            month_name: report.month ? Date::MONTHNAMES[report.month] : "Annual",
            period_display: report.period_display,
            transaction_count: report.transaction_count,
            total_in: report.total_in&.to_f,
            total_out: report.total_out&.to_f,
            net_change: report.net_change&.to_f,
            generated_at: report.generated_at&.iso8601,
            file_name: report.file_name,
            bank_code: report.bank_code
          }
        end

        # Convert to array format
        data = structure.values.map do |bank|
          bank[:years] = bank[:years].values.map do |year|
            year[:months] = year[:months].sort_by { |m| m[:month] || 0 }
            year
          end
          bank
        end

        render json: {
          success: true,
          data: data
        }
      end

      private

      def set_company
        @company = CorporateCompany.find(params[:company_id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: "Company not found" }, status: :not_found
      end

      # Base scope - scoped to company if company_id present
      def base_scope
        if @company
          BankStatementReport.for_company_id(@company.id)
        else
          BankStatementReport.all
        end
      end

      def serialize_report(report, include_url: false)
        data = {
          id: report.id,
          display_name: report.display_name,            # "NAB December 2025" - for table display
          bank_account_id: report.bank_account_id,
          bank_account_name: report.bank_account_name,
          bank_code: report.bank_code,
          account_number: report.account_number,
          company_id: report.company_id,
          company_code: report.company_code,
          financial_year: report.financial_year,
          month: report.month,
          year: report.year,
          report_type: report.report_type,
          period_display: report.period_display,
          period_start: report.period_start,
          period_end: report.period_end,
          transaction_count: report.transaction_count,
          total_in: report.total_in&.to_f,
          total_out: report.total_out&.to_f,
          net_change: report.net_change&.to_f,
          file_name: report.file_name,
          file_size: report.file_size,
          status: report.status,
          error_message: report.error_message,
          generated_at: report.generated_at&.iso8601,
          needs_regeneration: report.needs_regeneration?,
          created_at: report.created_at.iso8601,
          updated_at: report.updated_at.iso8601
        }

        data[:download_url] = report.cloudinary_url if include_url && report.cloudinary_url.present?

        data
      end
    end
  end
end
