# frozen_string_literal: true

# QuoteReturnsController - Unified view of supplier quote responses
#
# Combines data from two quoting systems:
# 1. QuoteTracker - simple per-task quotes
# 2. CustomQuoteSupplier - CC/PO-level hierarchical quotes
#
# Provides a single list of all "returned" (responded/accepted/rejected) quotes
# with actions to accept (create PO) or reject with a confirmation workflow.
#
module Api
  module V1
    class QuoteReturnsController < ApplicationController
      before_action :set_job, only: [:index]
      before_action :set_return_record, only: [:confirm_details, :accept, :reject]

      # GET /api/v1/jobs/:job_id/quote_returns
      # Returns unified list of all quote returns for a job
      def index
        rows = []

        # ─── QuoteTracker returns ───────────────────────────────────────
        qt_scope = QuoteTracker.where(job_id: @job.id)
          .where(status: %w[sent responded accepted rejected])
          .includes(:supplier, :sm_schedule_master, :sm_task, :sent_by, :purchase_order)

        # Load confirmed_by if column exists (after migration)
        qt_scope = qt_scope.includes(:confirmed_by) if QuoteTracker.column_names.include?('confirmed_by_id')

        qt_scope.find_each do |qt|
          rows << qt_return_json(qt)
        end

        # ─── CustomQuoteSupplier returns ────────────────────────────────
        cqs_scope = CustomQuoteSupplier
          .joins(custom_quote_line: :custom_quote)
          .where(custom_quotes: { job_id: @job.id })
          .where(status: %w[sent responded accepted rejected])
          .includes(
            :supplier, :purchase_order, :warehouse_document, :sent_by,
            custom_quote_line: [:parent, { custom_quote: :job }]
          )

        # Load confirmed_by if column exists (after migration)
        cqs_scope = cqs_scope.includes(:confirmed_by) if CustomQuoteSupplier.column_names.include?('confirmed_by_id')

        cqs_scope.find_each do |cqs|
          rows << cqs_return_json(cqs)
        end

        # Sort by most recent date DESC (dateReceived, then dateSent as fallback), nulls last
        rows.sort_by! { |r| r[:dateReceived] || r[:dateSent] || "1900-01-01" }.reverse!

        # Summary stats
        total_value = rows.select { |r| r[:status] == 'accepted' }.sum { |r| r[:priceQuoted] || 0 }

        render json: {
          success: true,
          data: {
            jobId: @job.id,
            returns: rows,
            summary: {
              totalReturns: rows.size,
              sentCount: rows.count { |r| r[:status] == 'sent' },
              acceptedCount: rows.count { |r| r[:status] == 'accepted' },
              rejectedCount: rows.count { |r| r[:status] == 'rejected' },
              respondedCount: rows.count { |r| r[:status] == 'responded' },
              totalAcceptedValue: total_value.to_f
            }
          }
        }
      end

      # GET /api/v1/quote_returns/:id/confirm_details
      # Returns side-by-side data for the confirmation dialog
      def confirm_details
        if @source == :qt
          render json: { success: true, data: qt_confirm_details(@record) }
        else
          render json: { success: true, data: cqs_confirm_details(@record) }
        end
      end

      # POST /api/v1/quote_returns/:id/accept
      # Accepts a quote and creates PO(s) with confirmation tracking
      def accept
        notes = params[:confirmationNotes]

        if @source == :qt
          accept_quote_tracker!(@record, notes)
        else
          accept_custom_quote_supplier!(@record, notes)
        end
      rescue => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      # POST /api/v1/quote_returns/:id/reject
      # Rejects a quote with confirmation tracking
      def reject
        notes = params[:confirmationNotes]

        ActiveRecord::Base.transaction do
          @record.reject!

          if @record.respond_to?(:confirmed_by_id=)
            @record.update!(
              confirmed_by_id: current_user.id,
              confirmed_at: Time.current,
              confirmation_notes: notes
            )
          end
        end

        render json: {
          success: true,
          message: "Quote rejected"
        }
      rescue => e
        render json: { success: false, error: e.message }, status: :unprocessable_entity
      end

      private

      def set_job
        @job = Job.find(params[:job_id] || params[:id])
      end

      # Parse composite ID: "qt_123" or "cqs_456"
      def set_return_record
        raw_id = params[:id].to_s
        if raw_id.start_with?('qt_')
          @source = :qt
          @record = QuoteTracker.find(raw_id.sub('qt_', '').to_i)
        elsif raw_id.start_with?('cqs_')
          @source = :cqs
          @record = CustomQuoteSupplier.find(raw_id.sub('cqs_', '').to_i)
        else
          render json: { success: false, error: "Invalid quote return ID format" }, status: :bad_request
        end
      end

      # ─── Accept Logic ────────────────────────────────────────────────

      def accept_quote_tracker!(qt, notes)
        po = nil
        ActiveRecord::Base.transaction do
          po = qt.accept_and_create_po!(current_user)

          # Record confirmation
          if qt.respond_to?(:confirmed_by_id=)
            qt.update!(
              confirmed_by_id: current_user.id,
              confirmed_at: Time.current,
              confirmation_notes: notes
            )
          end

          # Enhance PO with quote details
          enhance_po_from_qt!(po, qt)
        end

        render json: {
          success: true,
          message: "Quote accepted. PO #{po.purchase_order_number} created.",
          data: {
            purchaseOrders: [{
              id: po.id,
              poNumber: po.purchase_order_number,
              budget: po.budget&.to_f,
              status: po.status
            }]
          }
        }
      end

      def accept_custom_quote_supplier!(cqs, notes)
        pos = nil
        ActiveRecord::Base.transaction do
          pos = CustomQuotePoCreatorService.accept!(supplier: cqs, user: current_user)

          # Record confirmation
          if cqs.respond_to?(:confirmed_by_id=)
            cqs.update!(
              confirmed_by_id: current_user.id,
              confirmed_at: Time.current,
              confirmation_notes: notes
            )
          end

          # Enhance POs with quote details
          pos.each { |po| enhance_po_from_cqs!(po, cqs) }
        end

        render json: {
          success: true,
          message: "Quote accepted. #{pos.size} PO#{'s' if pos.size > 1} created.",
          data: {
            purchaseOrders: pos.map { |po|
              {
                id: po.id,
                poNumber: po.purchase_order_number,
                budget: po.budget&.to_f,
                status: po.status
              }
            }
          }
        }
      end

      # ─── PO Enhancement ──────────────────────────────────────────────

      def enhance_po_from_qt!(po, qt)
        updates = { status: 'approved' }
        updates[:special_instructions] = qt.quote_request_instructions if qt.quote_request_instructions.present?
        po.update!(updates)
      end

      def enhance_po_from_cqs!(po, cqs)
        line = cqs.custom_quote_line
        updates = { status: 'approved' }
        updates[:quote_warehouse_document_id] = cqs.warehouse_document_id if cqs.warehouse_document_id.present?
        updates[:special_instructions] = line.rfq_instructions if line.rfq_instructions.present?
        po.update!(updates)
      end

      # ─── JSON Serializers ────────────────────────────────────────────

      def qt_return_json(qt)
        {
          id: "qt_#{qt.id}",
          source: 'quote_tracker',
          sourceId: qt.id,
          supplierName: qt.supplier&.display_name,
          supplierId: qt.supplier_id,
          itemName: qt.task_name,
          parentName: qt.sm_schedule_master&.cost_centre,
          priceQuoted: qt.price_quoted&.to_f,
          dateSent: qt.date_sent&.iso8601,
          sentByName: qt.sent_by&.name,
          dateReceived: qt.date_received&.iso8601,
          quoteNumber: qt.quote_number,
          validTo: qt.valid_to&.iso8601,
          status: qt.status,
          isBestPrice: qt.is_best_price,
          responseNotes: qt.response_notes,
          warehouseDocumentId: nil,
          tenderDescription: qt.quote_request_instructions,
          purchaseOrderId: qt.purchase_order_id,
          purchaseOrderNumber: qt.purchase_order&.purchase_order_number,
          confirmedBy: qt.respond_to?(:confirmed_by) ? qt.confirmed_by&.name : nil,
          confirmedAt: qt.respond_to?(:confirmed_at) ? qt.confirmed_at&.iso8601 : nil
        }
      end

      def cqs_return_json(cqs)
        line = cqs.custom_quote_line
        parent = line.parent
        {
          id: "cqs_#{cqs.id}",
          source: 'custom_quote',
          sourceId: cqs.id,
          supplierName: cqs.supplier&.name,
          supplierId: cqs.supplier_id,
          itemName: line.name,
          parentName: parent&.name,
          priceQuoted: cqs.price_quoted&.to_f,
          dateSent: cqs.date_sent&.iso8601,
          sentByName: cqs.sent_by&.name,
          dateReceived: cqs.date_received&.iso8601,
          quoteNumber: cqs.quote_number,
          validTo: cqs.valid_to&.iso8601,
          status: cqs.status,
          isBestPrice: cqs.is_best_price,
          responseNotes: cqs.response_notes,
          warehouseDocumentId: cqs.warehouse_document_id,
          tenderDescription: line.tender_description,
          purchaseOrderId: cqs.purchase_order_id,
          purchaseOrderNumber: cqs.purchase_order&.purchase_order_number,
          confirmedBy: cqs.respond_to?(:confirmed_by) ? cqs.confirmed_by&.name : nil,
          confirmedAt: cqs.respond_to?(:confirmed_at) ? cqs.confirmed_at&.iso8601 : nil
        }
      end

      # ─── Confirm Details ─────────────────────────────────────────────

      def qt_confirm_details(qt)
        {
          requested: {
            description: qt.quote_request_instructions,
            budget: nil,
            taskName: qt.task_name,
            rfqInstructions: qt.quote_request_instructions
          },
          quoted: {
            supplierName: qt.supplier&.display_name,
            price: qt.price_quoted&.to_f,
            quoteNumber: qt.quote_number,
            validTo: qt.valid_to&.iso8601,
            responseNotes: qt.response_notes,
            timeframe: qt.timeframe,
            documentUrl: nil
          }
        }
      end

      def cqs_confirm_details(cqs)
        line = cqs.custom_quote_line
        {
          requested: {
            description: line.tender_description,
            budget: line.budget_amount&.to_f,
            taskName: line.name,
            documentTypeNames: line.respond_to?(:document_type_names) ? line.document_type_names : [],
            rfqInstructions: line.rfq_instructions
          },
          quoted: {
            supplierName: cqs.supplier&.name,
            price: cqs.price_quoted&.to_f,
            quoteNumber: cqs.quote_number,
            validTo: cqs.valid_to&.iso8601,
            responseNotes: cqs.response_notes,
            timeframe: cqs.timeframe,
            documentUrl: cqs.warehouse_document_id ? "/api/v1/warehouse_documents/#{cqs.warehouse_document_id}/download" : nil
          }
        }
      end
    end
  end
end
