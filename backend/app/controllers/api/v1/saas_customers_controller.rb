# frozen_string_literal: true

module Api
  module V1
    # SaaS Customer Management Controller
    # Manages SaaS customer subscriptions, billing, and profitability
    #
    # Endpoints:
    # - GET    /api/v1/saas_customers          - List all SaaS customers
    # - GET    /api/v1/saas_customers/:id      - Show customer details
    # - POST   /api/v1/saas_customers          - Create new SaaS customer
    # - PATCH  /api/v1/saas_customers/:id      - Update customer
    # - DELETE /api/v1/saas_customers/:id      - Remove SaaS status (soft)
    # - GET    /api/v1/saas_customers/:id/profitability - Get profitability metrics
    # - GET    /api/v1/saas_customers/:id/billing_history - Get billing history
    # - POST   /api/v1/saas_customers/:id/calculate_fee - Calculate fee for turnover
    #
    class SaasCustomersController < ApplicationController
      before_action :set_customer, only: [:show, :update, :destroy, :profitability, :billing_history, :calculate_fee]

      # GET /api/v1/saas_customers
      def index
        customers = Contact.saas_customers
          .includes(:support_contact, :upline_contact, :saas_billing_records)
          .order(:name)

        # Filter by status if provided
        customers = customers.where(saas_status: params[:status]) if params[:status].present?

        # Filter by support contact (for referrer views)
        customers = customers.where(support_contact_id: params[:support_contact_id]) if params[:support_contact_id].present?

        render json: {
          success: true,
          data: customers.map { |c| customer_json(c) }
        }
      end

      # GET /api/v1/saas_customers/:id
      def show
        render json: {
          success: true,
          data: customer_json(@customer, full: true)
        }
      end

      # POST /api/v1/saas_customers
      # Converts an existing contact to a SaaS customer
      def create
        contact = Contact.find(params[:contact_id])

        if contact.is_saas_customer?
          render json: { success: false, error: "Contact is already a SaaS customer" }, status: :unprocessable_entity
          return
        end

        contact.assign_attributes(saas_customer_params)
        contact.is_saas_customer = true
        contact.saas_started_at ||= Date.current

        if contact.save
          render json: { success: true, data: customer_json(contact, full: true) }, status: :created
        else
          render json: { success: false, error: contact.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/saas_customers/:id
      def update
        if @customer.update(saas_customer_params)
          render json: { success: true, data: customer_json(@customer, full: true) }
        else
          render json: { success: false, error: @customer.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/saas_customers/:id
      # Soft delete - marks as churned, doesn't delete contact
      def destroy
        @customer.update!(
          saas_status: "churned",
          saas_churned_at: Date.current
        )
        render json: { success: true, message: "Customer marked as churned" }
      end

      # GET /api/v1/saas_customers/:id/profitability
      # Returns profitability metrics for date range
      def profitability
        start_date = params[:start_date]&.to_date || 12.months.ago.to_date
        end_date = params[:end_date]&.to_date || Date.current

        render json: {
          success: true,
          data: @customer.customer_profitability(start_date, end_date)
        }
      end

      # GET /api/v1/saas_customers/:id/billing_history
      def billing_history
        records = @customer.saas_billing_records
          .includes(:gl_invoice)
          .order(billing_period_start: :desc)

        records = records.limit(params[:limit].to_i) if params[:limit].present?

        render json: {
          success: true,
          data: records.map { |r| billing_record_json(r) }
        }
      end

      # POST /api/v1/saas_customers/:id/calculate_fee
      # Calculate fee for a given turnover (for preview/quotes)
      def calculate_fee
        turnover = params[:turnover].to_d

        render json: {
          success: true,
          data: SaasPricingService.calculate(turnover)
        }
      end

      # GET /api/v1/saas_customers/dashboard
      # Returns aggregate metrics for SaaS dashboard
      def dashboard
        active_customers = Contact.active_saas

        render json: {
          success: true,
          data: {
            total_customers: active_customers.count,
            total_mrr: calculate_total_mrr(active_customers),
            total_arr: calculate_total_mrr(active_customers) * 12,
            average_customer_value: calculate_average_value(active_customers),
            status_breakdown: Contact.saas_customers.group(:saas_status).count,
            recent_signups: active_customers.where("saas_started_at >= ?", 30.days.ago).count,
            churn_this_month: Contact.saas_customers.where("saas_churned_at >= ?", 30.days.ago).count
          }
        }
      end

      # GET /api/v1/saas_customers/select
      # Lightweight endpoint for dropdown/select components
      def select
        customers = Contact.active_saas.order(:name).pluck(:id, :name, :display_name)

        render json: {
          success: true,
          data: customers.map { |id, name, display_name| { id: id, name: display_name.presence || name } }
        }
      end

      # GET /api/v1/saas_customers/pricing_calculator
      # Public endpoint for pricing calculator (used by CostTab)
      def pricing_calculator
        turnover = params[:turnover].to_d

        result = SaasPricingService.calculate(turnover)
        commissions = SaasPricingService.calculate_commissions(
          result[:cost],
          params[:support_contact_id].present?,
          params[:upline_contact_id].present?
        )

        render json: {
          success: true,
          data: result.merge(commissions: commissions)
        }
      end

      private

      def set_customer
        @customer = Contact.saas_customers.find(params[:id])
      end

      def saas_customer_params
        params.permit(
          :annual_turnover,
          :saas_status,
          :saas_started_at,
          :support_contact_id,
          :upline_contact_id
        )
      end

      def customer_json(customer, full: false)
        fee_data = customer.calculate_saas_fee

        data = {
          id: customer.id,
          name: customer.name,
          display_name: customer.display_name,
          annual_turnover: customer.annual_turnover,
          saas_status: customer.saas_status,
          saas_started_at: customer.saas_started_at,
          saas_churned_at: customer.saas_churned_at,
          monthly_fee: fee_data[:cost] ? (fee_data[:cost] / 12.0).round(2) : 0,
          annual_fee: fee_data[:cost] || 0,
          effective_rate: fee_data[:effective_rate],
          support_contact: customer.support_contact ? {
            id: customer.support_contact.id,
            name: customer.support_contact.display_name
          } : nil,
          upline_contact: customer.upline_contact ? {
            id: customer.upline_contact.id,
            name: customer.upline_contact.display_name
          } : nil
        }

        if full
          # Add detailed metrics
          data[:cost_to_serve] = customer.cost_to_serve
          data[:tickets_count] = customer.support_tickets.count
          data[:open_tickets_count] = customer.support_tickets.active.count
          data[:billing_records_count] = customer.saas_billing_records.count
          data[:last_billing] = customer.saas_billing_records.order(billing_period_end: :desc).first&.billing_period_end
          data[:tier_breakdown] = fee_data[:tiers]
        end

        data
      end

      def billing_record_json(record)
        {
          id: record.id,
          billing_period_start: record.billing_period_start,
          billing_period_end: record.billing_period_end,
          turnover_reported: record.turnover_reported,
          fee_calculated: record.fee_calculated,
          effective_rate: record.effective_rate,
          status: record.status,
          invoice_id: record.gl_invoice_id,
          invoice_number: record.gl_invoice&.invoice_number,
          created_at: record.created_at
        }
      end

      def calculate_total_mrr(customers)
        customers.sum do |c|
          fee = c.calculate_saas_fee
          fee[:cost] ? fee[:cost] / 12.0 : 0
        end.round(2)
      end

      def calculate_average_value(customers)
        return 0 if customers.empty?
        (calculate_total_mrr(customers) / customers.count).round(2)
      end
    end
  end
end
