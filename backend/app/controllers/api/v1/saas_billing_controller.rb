# frozen_string_literal: true

module Api
  module V1
    # SaaS Billing Controller
    # Manages billing records and invoicing for SaaS customers
    #
    # Endpoints:
    # - GET    /api/v1/saas_billing              - List all billing records
    # - GET    /api/v1/saas_billing/:id          - Show billing record details
    # - POST   /api/v1/saas_billing              - Create billing record
    # - PATCH  /api/v1/saas_billing/:id          - Update billing record
    # - DELETE /api/v1/saas_billing/:id          - Delete billing record
    # - POST   /api/v1/saas_billing/generate_monthly - Generate monthly billing
    # - POST   /api/v1/saas_billing/:id/create_invoice - Create GL invoice
    #
    class SaasBillingController < ApplicationController
      before_action :set_billing_record, only: [:show, :update, :destroy, :create_invoice]

      # GET /api/v1/saas_billing
      def index
        records = SaasBillingRecord
          .includes(:contact, :gl_invoice)
          .order(billing_period_start: :desc)

        # Filters
        records = records.where(contact_id: params[:customer_id]) if params[:customer_id].present?
        records = records.where(status: params[:status]) if params[:status].present?

        # Date range filter
        if params[:start_date].present? && params[:end_date].present?
          records = records.where(billing_period_start: params[:start_date]..params[:end_date])
        end

        # Pagination
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 50).to_i
        total = records.count
        records = records.offset((page - 1) * per_page).limit(per_page)

        render json: {
          success: true,
          data: records.map { |r| billing_record_json(r) },
          meta: {
            total: total,
            page: page,
            per_page: per_page,
            total_pages: (total.to_f / per_page).ceil
          }
        }
      end

      # GET /api/v1/saas_billing/:id
      def show
        render json: {
          success: true,
          data: billing_record_json(@record, full: true)
        }
      end

      # POST /api/v1/saas_billing
      def create
        @record = SaasBillingRecord.new(billing_record_params)

        if @record.save
          # Create referral commissions
          ReferralCommissionService.calculate_for_billing_record(@record)

          render json: { success: true, data: billing_record_json(@record, full: true) }, status: :created
        else
          render json: { success: false, error: @record.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/saas_billing/:id
      def update
        if @record.update(billing_record_params)
          render json: { success: true, data: billing_record_json(@record, full: true) }
        else
          render json: { success: false, error: @record.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/saas_billing/:id
      def destroy
        if @record.gl_invoice_id.present?
          render json: { success: false, error: "Cannot delete billing record with linked invoice" }, status: :unprocessable_entity
          return
        end

        @record.destroy
        render json: { success: true, message: "Billing record deleted" }
      end

      # POST /api/v1/saas_billing/generate_monthly
      # Generates billing records for all active customers for a given month
      def generate_monthly
        billing_month = params[:billing_month]&.to_date || Date.current.beginning_of_month

        begin
          ReferralCommissionService.generate_monthly_billing(billing_month)
          render json: {
            success: true,
            message: "Monthly billing generated for #{billing_month.strftime('%B %Y')}"
          }
        rescue => e
          render json: { success: false, error: e.message }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/saas_billing/:id/create_invoice
      # Creates a GL invoice from the billing record
      def create_invoice
        if @record.gl_invoice_id.present?
          render json: { success: false, error: "Invoice already exists" }, status: :unprocessable_entity
          return
        end

        invoice = @record.create_gl_invoice!

        render json: {
          success: true,
          data: billing_record_json(@record.reload, full: true),
          invoice: {
            id: invoice.id,
            invoice_number: invoice.invoice_number
          }
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/saas_billing/summary
      # Returns billing summary for dashboard
      def summary
        current_month = Date.current.beginning_of_month
        last_month = current_month - 1.month

        current_records = SaasBillingRecord.where(billing_period_start: current_month)
        last_records = SaasBillingRecord.where(billing_period_start: last_month)

        render json: {
          success: true,
          data: {
            current_month: {
              period: current_month,
              total_revenue: current_records.sum(:fee_calculated),
              records_count: current_records.count,
              pending: current_records.pending.count,
              invoiced: current_records.invoiced.count,
              paid: current_records.paid.count
            },
            last_month: {
              period: last_month,
              total_revenue: last_records.sum(:fee_calculated),
              records_count: last_records.count
            },
            revenue_growth: calculate_growth(
              last_records.sum(:fee_calculated),
              current_records.sum(:fee_calculated)
            ),
            outstanding_invoices: SaasBillingRecord.where(status: %w[pending invoiced]).sum(:fee_calculated)
          }
        }
      end

      private

      def set_billing_record
        @record = SaasBillingRecord.find(params[:id])
      end

      def billing_record_params
        params.permit(
          :contact_id, :billing_period_start, :billing_period_end,
          :turnover_reported, :status
        )
      end

      def billing_record_json(record, full: false)
        data = {
          id: record.id,
          customer: {
            id: record.contact.id,
            name: record.contact.display_name
          },
          billing_period_start: record.billing_period_start,
          billing_period_end: record.billing_period_end,
          turnover_reported: record.turnover_reported,
          fee_calculated: record.fee_calculated,
          effective_rate: record.effective_rate,
          status: record.status,
          created_at: record.created_at,
          invoice: record.gl_invoice ? {
            id: record.gl_invoice.id,
            invoice_number: record.gl_invoice.invoice_number,
            status: record.gl_invoice.status
          } : nil
        }

        if full
          data[:tier_breakdown] = record.tier_breakdown
          data[:commissions] = record.referral_commissions.map do |c|
            {
              id: c.id,
              level: c.commission_level,
              referrer: c.referrer_contact.display_name,
              amount: c.commission_amount,
              status: c.status
            }
          end
        end

        data
      end

      def calculate_growth(previous, current)
        return 0 if previous.zero?
        ((current - previous) / previous * 100).round(1)
      end
    end
  end
end
