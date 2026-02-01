module Api
  module V1
    class DividendsController < ApplicationController
      before_action :set_company
      before_action :set_dividend, only: [ :show, :update, :destroy, :payments, :calculate_payments ]

      # GET /api/v1/companies/:company_id/dividends
      def index
        @dividends = @company.dividends
                             .includes(:dividend_payments)
                             .order(declaration_date: :desc)

        # Filter by status
        if params[:status].present?
          @dividends = @dividends.where(status: params[:status])
        end

        # Filter by year
        if params[:year].present?
          @dividends = @dividends.where("EXTRACT(YEAR FROM declaration_date) = ?", params[:year])
        end

        render json: {
          success: true,
          data: @dividends.map { |d| serialize_dividend(d) },
          summary: dividend_summary
        }
      end

      # GET /api/v1/companies/:company_id/dividends/:id
      def show
        render json: {
          success: true,
          data: serialize_dividend(@dividend, include_payments: true)
        }
      end

      # POST /api/v1/companies/:company_id/dividends
      def create
        @dividend = @company.dividends.new(dividend_params)

        if @dividend.save
          render json: {
            success: true,
            data: serialize_dividend(@dividend)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @dividend.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/companies/:company_id/dividends/:id
      def update
        if @dividend.update(dividend_params)
          render json: {
            success: true,
            data: serialize_dividend(@dividend)
          }
        else
          render json: {
            success: false,
            errors: @dividend.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/companies/:company_id/dividends/:id
      def destroy
        if @dividend.dividend_payments.any?
          return render json: {
            success: false,
            errors: [ "Cannot delete dividend with existing payments" ]
          }, status: :unprocessable_entity
        end

        @dividend.destroy
        render json: { success: true }
      end

      # GET /api/v1/companies/:company_id/dividends/:id/payments
      def payments
        @payments = @dividend.dividend_payments.includes(:shareholder)

        render json: {
          success: true,
          data: @payments.map { |p| serialize_payment(p) }
        }
      end

      # POST /api/v1/companies/:company_id/dividends/:id/calculate_payments
      # Calculate dividend payments based on shareholdings at record date
      def calculate_payments
        record_date = @dividend.record_date || @dividend.declaration_date

        # Get shareholdings at record date (for now, use current shareholdings)
        # TODO: Could track historical shareholdings for accurate calculation
        shareholdings = @company.corporate_company_shareholdings.includes(:shareholder)

        total_shares = shareholdings.sum(:number_of_shares)

        if total_shares.zero?
          return render json: {
            success: false,
            errors: [ "No shareholdings found for dividend calculation" ]
          }, status: :unprocessable_entity
        end

        payments_data = shareholdings.map do |sh|
          share_percentage = sh.number_of_shares.to_f / total_shares
          gross_amount = (@dividend.total_amount * share_percentage).round(2)
          franking_credit = (gross_amount * (@dividend.franking_percentage || 0) / 100).round(2)
          net_amount = gross_amount - franking_credit

          {
            shareholder_id: sh.shareholder_id,
            shareholder_name: sh.shareholder.display_name,
            shares_held: sh.number_of_shares,
            share_percentage: (share_percentage * 100).round(2),
            gross_amount: gross_amount,
            franking_credit: franking_credit,
            net_amount: net_amount
          }
        end

        render json: {
          success: true,
          data: {
            dividend: serialize_dividend(@dividend),
            record_date: record_date,
            total_shares: total_shares,
            total_amount: @dividend.total_amount,
            franking_percentage: @dividend.franking_percentage,
            payments: payments_data
          }
        }
      end

      # POST /api/v1/companies/:company_id/dividends/:id/create_payments
      # Create payment records based on calculation
      def create_payments
        @dividend = @company.dividends.find(params[:id])

        if @dividend.dividend_payments.any?
          return render json: {
            success: false,
            errors: [ "Payments already exist for this dividend" ]
          }, status: :unprocessable_entity
        end

        shareholdings = @company.corporate_company_shareholdings.includes(:shareholder)
        total_shares = shareholdings.sum(:number_of_shares)

        if total_shares.zero?
          return render json: {
            success: false,
            errors: [ "No shareholdings found" ]
          }, status: :unprocessable_entity
        end

        ActiveRecord::Base.transaction do
          shareholdings.each do |sh|
            share_percentage = sh.number_of_shares.to_f / total_shares
            gross_amount = (@dividend.total_amount * share_percentage).round(2)
            franking_credit = (gross_amount * (@dividend.franking_percentage || 0) / 100).round(2)
            net_amount = gross_amount - franking_credit

            @dividend.dividend_payments.create!(
              shareholder: sh.shareholder,
              shares_held: sh.number_of_shares,
              gross_amount: gross_amount,
              franking_credit: franking_credit,
              net_amount: net_amount
            )
          end
        end

        render json: {
          success: true,
          data: serialize_dividend(@dividend.reload, include_payments: true)
        }
      rescue ActiveRecord::RecordInvalid => e
        render json: {
          success: false,
          errors: [ e.message ]
        }, status: :unprocessable_entity
      end

      # POST /api/v1/companies/:company_id/dividends/:id/mark_paid
      def mark_paid
        @dividend = @company.dividends.find(params[:id])
        payment_date = params[:payment_date] || Date.current
        payment_method = params[:payment_method] || "bank_transfer"

        ActiveRecord::Base.transaction do
          @dividend.dividend_payments.update_all(
            paid_date: payment_date,
            payment_method: payment_method
          )
          @dividend.update!(
            status: "paid",
            payment_date: payment_date
          )
        end

        render json: {
          success: true,
          data: serialize_dividend(@dividend.reload, include_payments: true)
        }
      end

      private

      def set_company
        @company = Corporate.find(params[:company_id])
      end

      def set_dividend
        @dividend = @company.dividends.find(params[:id])
      end

      def dividend_params
        params.require(:dividend).permit(
          :declaration_date,
          :record_date,
          :payment_date,
          :total_amount,
          :franking_percentage,
          :dividend_type,
          :status,
          :notes
        )
      end

      def serialize_dividend(dividend, include_payments: false)
        data = {
          id: dividend.id,
          company_id: dividend.company_id,
          declaration_date: dividend.declaration_date,
          record_date: dividend.record_date,
          payment_date: dividend.payment_date,
          total_amount: dividend.total_amount,
          franking_percentage: dividend.franking_percentage,
          dividend_type: dividend.dividend_type,
          status: dividend.status,
          notes: dividend.notes,
          payments_count: dividend.dividend_payments.count,
          created_at: dividend.created_at,
          updated_at: dividend.updated_at
        }

        if include_payments
          data[:payments] = dividend.dividend_payments.includes(:shareholder).map { |p| serialize_payment(p) }
        end

        data
      end

      def serialize_payment(payment)
        {
          id: payment.id,
          shareholder_id: payment.shareholder_id,
          shareholder_name: payment.shareholder.display_name,
          shares_held: payment.shares_held,
          gross_amount: payment.gross_amount,
          franking_credit: payment.franking_credit,
          net_amount: payment.net_amount,
          paid_date: payment.paid_date,
          payment_method: payment.payment_method
        }
      end

      def dividend_summary
        {
          total_declared: @company.dividends.sum(:total_amount),
          total_paid: @company.dividends.where(status: "paid").sum(:total_amount),
          pending_payment: @company.dividends.where(status: "declared").sum(:total_amount),
          dividends_this_year: @company.dividends.where("EXTRACT(YEAR FROM declaration_date) = ?", Date.current.year).count
        }
      end
    end
  end
end
