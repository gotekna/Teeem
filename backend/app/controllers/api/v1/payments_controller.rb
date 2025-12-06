module Api
  module V1
    class PaymentsController < ApplicationController
      before_action :set_payment, only: [ :show, :update, :destroy, :sync_to_xero ]
      before_action :set_purchase_order, only: [ :index, :create ]

      # GET /api/v1/purchase_orders/:purchase_order_id/payments
      def index
        @payments = @purchase_order.payments.recent

        render json: {
          success: true,
          payments: @payments.map { |payment| payment_json(payment) },
          summary: {
            total_paid: @purchase_order.payments.sum(:amount),
            po_total: @purchase_order.total,
            remaining: (@purchase_order.total || 0) - @purchase_order.payments.sum(:amount),
            payment_status: @purchase_order.payment_status
          }
        }
      end

      # GET /api/v1/payments/:id
      def show
        render json: {
          success: true,
          payment: payment_json(@payment)
        }
      end

      # POST /api/v1/purchase_orders/:purchase_order_id/payments
      def create
        @payment = @purchase_order.payments.build(payment_params)
        @payment.created_by = current_user if defined?(current_user)

        if @payment.save
          # Sync to Xero in background if enabled
          sync_payment_to_xero(@payment) if should_sync_to_xero?

          render json: {
            success: true,
            message: "Payment recorded successfully",
            payment: payment_json(@payment),
            purchase_order: {
              payment_status: @purchase_order.reload.payment_status,
              total_paid: @purchase_order.payments.sum(:amount)
            }
          }, status: :created
        else
          render json: {
            success: false,
            errors: @payment.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/payments/:id
      def update
        if @payment.update(payment_params)
          render json: {
            success: true,
            message: "Payment updated successfully",
            payment: payment_json(@payment)
          }
        else
          render json: {
            success: false,
            errors: @payment.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/payments/:id
      def destroy
        @payment.destroy

        render json: {
          success: true,
          message: "Payment deleted successfully"
        }
      end

      # POST /api/v1/payments/:id/sync_to_xero
      def sync_to_xero
        begin
          service = XeroPaymentSyncService.new(@payment)
          result = service.sync_to_xero

          if result[:success]
            render json: {
              success: true,
              message: "Payment synced to Xero successfully",
              xero_payment_id: result[:xero_payment_id],
              payment: payment_json(@payment.reload)
            }
          else
            render json: {
              success: false,
              error: result[:error]
            }, status: :unprocessable_entity
          end
        rescue StandardError => e
          Rails.logger.error("Payment sync error: #{e.message}")
          render json: {
            success: false,
            error: e.message
          }, status: :internal_server_error
        end
      end

      private

      def set_payment
        @payment = Payment.find(params[:id])
      end

      def set_purchase_order
        @purchase_order = PurchaseOrder.find(params[:purchase_order_id])
      end

      def payment_params
        params.require(:payment).permit(
          :amount,
          :payment_date,
          :payment_method,
          :reference_number,
          :notes
        )
      end

      def payment_json(payment)
        {
          id: payment.id,
          amount: payment.amount,
          payment_date: payment.payment_date,
          payment_method: payment.payment_method,
          reference_number: payment.reference_number,
          notes: payment.notes,
          xero_payment_id: payment.xero_payment_id,
          xero_synced_at: payment.xero_synced_at,
          xero_sync_error: payment.xero_sync_error,
          synced_to_xero: payment.synced_to_xero?,
          created_by: payment.created_by&.name,
          created_at: payment.created_at,
          updated_at: payment.updated_at,
          purchase_order: {
            id: payment.purchase_order.id,
            purchase_order_number: payment.purchase_order.purchase_order_number,
            supplier_name: payment.purchase_order.supplier&.name
          }
        }
      end

      def should_sync_to_xero?
        # Check if Xero is connected and auto-sync is enabled
        # You can make this configurable per organization later
        true
      end

      def sync_payment_to_xero(payment)
        # Queue background job for Xero sync
        # For now, sync immediately
        service = XeroPaymentSyncService.new(payment)
        service.sync_to_xero
      rescue StandardError => e
        Rails.logger.error("Failed to sync payment to Xero: #{e.message}")
        # Don't fail the payment creation if sync fails
      end
    end
  end
end
