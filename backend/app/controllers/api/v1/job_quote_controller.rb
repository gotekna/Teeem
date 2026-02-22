# frozen_string_literal: true

module Api
  module V1
    class JobQuoteController < ApplicationController
      before_action :set_job, only: [:summary, :apply_template]
      before_action :set_tracker, only: [:send_rfq, :record_response, :accept]

      # GET /api/v1/jobs/:job_id/quote_summary
      # Returns QuoteTracker rows grouped by SM Trade with best_price flags
      def summary
        trackers = QuoteTracker.where(job_id: @job.id)
          .includes(:sm_trade, :supplier, :contact, :sent_by, :purchase_order, :quote_template)
          .order(:sm_trade_id, :supplier_id)

        # Group by SM Trade
        grouped = trackers.group_by(&:sm_trade_id)

        trades = grouped.map do |sm_trade_id, trade_trackers|
          sm_trade = trade_trackers.first.sm_trade
          {
            smTradeId: sm_trade_id,
            tradeName: sm_trade&.name,
            totalSuppliers: trade_trackers.size,
            respondedCount: trade_trackers.count { |t| t.status == 'responded' || t.status == 'accepted' },
            sentCount: trade_trackers.count { |t| t.status == 'sent' },
            bestPrice: trade_trackers.select(&:is_best_price).first&.price_quoted&.to_f,
            suppliers: trade_trackers.map { |t| tracker_json(t) }
          }
        end

        # Calculate total estimated cost (sum of best prices per trade)
        total_estimated = trades.sum { |t| t[:bestPrice] || 0 }

        render json: {
          success: true,
          data: {
            jobId: @job.id,
            jobName: @job.name,
            totalTrades: trades.size,
            totalEstimated: total_estimated,
            trades: trades
          }
        }
      end

      # POST /api/v1/jobs/:job_id/apply_quote_template
      # Applies a template, creating QuoteTracker rows
      def apply_template
        template = QuoteTemplate.find(params[:template_id])

        # Check if there are existing trackers from this template
        existing = QuoteTracker.where(job_id: @job.id, quote_template_id: template.id).count
        if existing > 0
          render json: {
            success: false,
            error: "This template has already been applied to this job (#{existing} existing rows)"
          }, status: :unprocessable_entity
          return
        end

        rows = template.apply_to_job!(@job, created_by: current_user)

        render json: {
          success: true,
          data: {
            rowsCreated: rows.size,
            templateName: template.name
          },
          message: "Applied '#{template.name}' - created #{rows.size} quote tracker rows"
        }
      end

      # POST /api/v1/quote_trackers/:id/send_rfq
      # Marks a tracker as sent (Phase 4 will add actual email sending)
      def send_rfq
        @tracker.mark_sent!(current_user)
        render json: {
          success: true,
          data: tracker_json(@tracker.reload)
        }
      end

      # POST /api/v1/quote_trackers/:id/record_response
      # Records a supplier's price response
      def record_response
        price = params[:price_quoted]
        raise "Price is required" unless price.present?

        @tracker.record_response!(
          price: price.to_f,
          timeframe: params[:timeframe],
          notes: params[:response_notes]
        )

        render json: {
          success: true,
          data: tracker_json(@tracker.reload)
        }
      end

      # POST /api/v1/quote_trackers/:id/accept
      # Accepts a quote and creates a PO
      def accept
        po = @tracker.accept_and_create_po!(current_user)

        render json: {
          success: true,
          data: {
            tracker: tracker_json(@tracker.reload),
            purchaseOrder: {
              id: po.id,
              poNumber: po.purchase_order_number,
              budget: po.budget&.to_f
            }
          },
          message: "Quote accepted. Purchase Order #{po.purchase_order_number} created."
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      private

      def set_job
        @job = Job.find(params[:job_id])
      end

      def set_tracker
        @tracker = QuoteTracker.find(params[:id])
      end

      def tracker_json(tracker)
        {
          id: tracker.id,
          jobId: tracker.job_id,
          smTradeId: tracker.sm_trade_id,
          tradeName: tracker.sm_trade&.name,
          supplierId: tracker.supplier_id,
          supplierName: tracker.supplier&.display_name,
          contactId: tracker.contact_id,
          contactName: tracker.contact&.name,
          contactEmail: tracker.contact_email,
          status: tracker.status,
          requestedDate: tracker.requested_date&.iso8601,
          received: tracker.received,
          dateReceived: tracker.date_received&.iso8601,
          quoteNumber: tracker.quote_number,
          priceQuoted: tracker.price_quoted&.to_f,
          validTo: tracker.valid_to&.iso8601,
          instructions: tracker.quote_request_instructions,
          estimatingNotes: tracker.estimating_notes,
          sentAt: tracker.sent_at&.iso8601,
          sentByName: tracker.sent_by&.name,
          isBestPrice: tracker.is_best_price,
          purchaseOrderId: tracker.purchase_order_id,
          purchaseOrderNumber: tracker.purchase_order&.purchase_order_number,
          quoteTemplateId: tracker.quote_template_id,
          responseNotes: tracker.response_notes,
          timeframe: tracker.timeframe,
          createdAt: tracker.created_at&.iso8601,
          updatedAt: tracker.updated_at&.iso8601
        }
      end
    end
  end
end
