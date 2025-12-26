# frozen_string_literal: true

module Api
  module V1
    module Gl
      # Controller for TPAR (Taxable Payments Annual Report)
      class TparController < ApplicationController
        before_action :set_corporate_company
        before_action :set_report, only: [:show, :refresh, :submit, :lodge]

        # GET /api/v1/gl/tpar
        def index
          reports = @corporate_company.gl_tpar_reports
                                      .includes(:payees)
                                      .order(financial_year: :desc)

          render json: { success: true, data: reports }
        end

        # GET /api/v1/gl/tpar/:id
        def show
          render json: {
            success: true,
            data: @report.as_json(include: { payees: { include: :contact } })
          }
        end

        # POST /api/v1/gl/tpar/generate
        def generate
          financial_year = params[:financial_year] || ::Gl::TparReport.current_financial_year

          if @corporate_company.gl_tpar_reports.exists?(financial_year: financial_year)
            render json: { success: false, error: "Report for #{financial_year} already exists" },
                   status: :unprocessable_entity
            return
          end

          report = ::Gl::TparReport.generate!(
            @corporate_company,
            financial_year: financial_year,
            user: current_user
          )

          render json: { success: true, data: report }, status: :created
        end

        # POST /api/v1/gl/tpar/:id/refresh
        def refresh
          return unless @report.status == "draft"

          @report.payees.destroy_all
          @report.populate_payees!
          @report.calculate_totals!

          render json: { success: true, data: @report.reload, message: "Report refreshed" }
        end

        # POST /api/v1/gl/tpar/:id/submit
        def submit
          if @report.submit_for_review!
            render json: { success: true, data: @report, message: "Report submitted for review" }
          else
            render json: { success: false, error: "Cannot submit report" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/tpar/:id/lodge
        def lodge
          # This would integrate with ATO SBR
          @report.mark_lodged!(params[:reference])
          render json: { success: true, data: @report, message: "Report marked as lodged" }
        end

        # GET /api/v1/gl/tpar/contractors
        def contractors
          contractors = @corporate_company.contacts
                                          .where(tpar_required: true)
                                          .order(:name)

          render json: { success: true, data: contractors }
        end

        # POST /api/v1/gl/tpar/mark_contractor
        def mark_contractor
          contact = @corporate_company.contacts.find(params[:contact_id])
          contact.update!(
            tpar_required: params[:tpar_required],
            tpar_industry_code: params[:industry_code]
          )

          render json: { success: true, data: contact }
        end

        # GET /api/v1/gl/tpar/preview
        def preview
          financial_year = params[:financial_year] || ::Gl::TparReport.current_financial_year
          year_start = financial_year.split("-").first.to_i
          period_start = Date.new(year_start, 7, 1)
          period_end = Date.new(year_start + 1, 6, 30)

          payments = ::Gl::Invoice
                     .joins(:contact)
                     .where(corporate_company: @corporate_company)
                     .where(invoice_type: "bill", status: "paid")
                     .where(date: period_start..period_end)
                     .where(contacts: { tpar_required: true })
                     .includes(:contact)
                     .group_by(&:contact_id)

          preview_data = payments.map do |_contact_id, invoices|
            contact = invoices.first.contact
            {
              contact: contact.as_json(only: [:id, :name, :abn]),
              payment_count: invoices.count,
              gross_paid: invoices.sum(&:total),
              gst_paid: invoices.sum(&:tax)
            }
          end

          render json: {
            success: true,
            data: {
              financial_year: financial_year,
              period: { start: period_start, end: period_end },
              payees: preview_data,
              totals: {
                payee_count: preview_data.count,
                total_gross: preview_data.sum { |p| p[:gross_paid] },
                total_gst: preview_data.sum { |p| p[:gst_paid] }
              }
            }
          }
        end

        private

        def set_corporate_company
          @corporate_company = CorporateCompany.find(params[:corporate_company_id])
        end

        def set_report
          @report = @corporate_company.gl_tpar_reports.find(params[:id])
        end
      end
    end
  end
end
