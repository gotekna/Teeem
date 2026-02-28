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
      before_action :set_return_record, only: [:confirm_details, :accept, :reject, :extract]

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
            custom_quote_line: [{ parent: :children }, :children, { custom_quote: :job }]
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
      #
      # For CC-level custom quotes, allocations can be passed inline:
      #   { allocations: [{ lineId: 1, amount: 5000 }, ...] }
      def accept
        notes = params[:confirmationNotes]
        include_tender_desc = ActiveModel::Type::Boolean.new.cast(params[:includeTenderDescription])

        if @source == :qt
          accept_quote_tracker!(@record, notes)
        else
          accept_custom_quote_supplier!(@record, notes,
            include_tender_description: include_tender_desc,
            allocations: params[:allocations])
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

      # POST /api/v1/quote_returns/:id/extract
      # AI-extract price/dates from attached quote PDF and auto-save to record
      def extract
        unless @source == :cqs
          return render json: { success: false, error: "AI extraction only available for custom quotes" }, status: :unprocessable_entity
        end

        doc = @record.warehouse_document
        unless doc&.storage_blob
          return render json: { success: false, error: "No document attached" }, status: :unprocessable_entity
        end

        result = QuoteParsingService.new.extract!(doc)

        # Auto-save extracted data back to the record
        updates = {}
        updates[:price_quoted] = result[:priceQuoted] if result[:priceQuoted].present? && @record.price_quoted.blank?
        updates[:quote_number] = result[:quoteNumber] if result[:quoteNumber].present? && @record.quote_number.blank?
        updates[:valid_to] = result[:validTo] if result[:validTo].present? && @record.valid_to.blank?
        updates[:response_notes] = result[:notesSummary] if result[:notesSummary].present? && @record.response_notes.blank?
        updates[:date_received] = Date.current if @record.date_received.blank?

        if updates.any?
          # Move to responded if currently sent
          updates[:status] = 'responded' if @record.status == 'sent'
          @record.update!(updates)
        end

        render json: {
          success: true,
          data: {
            extraction: result,
            saved: updates.any?,
            updatedFields: updates.keys.map(&:to_s)
          }
        }
      rescue StandardError => e
        Rails.logger.error "[QuoteReturns#extract] Failed for #{params[:id]}: #{e.message}"
        render json: { success: false, error: "Extraction failed: #{e.message}" }, status: :unprocessable_entity
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

      def accept_custom_quote_supplier!(cqs, notes, include_tender_description: false, allocations: nil)
        pos = nil
        ActiveRecord::Base.transaction do
          # Save allocations for CC-level quotes (must exist before PO creation)
          if allocations.present?
            save_allocations!(cqs, allocations)
          end

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
          pos.each { |po| enhance_po_from_cqs!(po, cqs, include_tender_description: include_tender_description) }
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

      # ─── Allocation Saving ─────────────────────────────────────────────

      def save_allocations!(cqs, allocs)
        # Clear any existing allocations (idempotent on re-try)
        cqs.allocations.destroy_all

        allocs.each do |alloc|
          cqs.allocations.create!(
            custom_quote_line_id: alloc[:lineId],
            allocated_amount: alloc[:amount]
          )
        end
      end

      # ─── PO Enhancement ──────────────────────────────────────────────

      def enhance_po_from_qt!(po, qt)
        updates = { status: 'approved' }
        updates[:special_instructions] = qt.quote_request_instructions if qt.quote_request_instructions.present?
        po.update!(updates)
      end

      def enhance_po_from_cqs!(po, cqs, include_tender_description: false)
        line = cqs.custom_quote_line
        updates = { status: 'approved' }
        updates[:quote_warehouse_document_id] = cqs.warehouse_document_id if cqs.warehouse_document_id.present?
        updates[:special_instructions] = line.rfq_instructions if line.rfq_instructions.present?

        # Append tender description to PO description if requested
        if include_tender_description && line.tender_description.present?
          existing = po.description.to_s
          tender_desc = line.tender_description.truncate(2000)
          updates[:description] = existing.present? ? "#{existing}\n\n#{tender_desc}" : tender_desc
        end

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
        cc_line = parent || line
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
          confirmedAt: cqs.respond_to?(:confirmed_at) ? cqs.confirmed_at&.iso8601 : nil,
          parentLine: build_parent_line_context(cc_line, cqs)
        }
      end

      # Lightweight CC line context for allocation UI (no supplier arrays)
      def build_parent_line_context(cc_line, cqs = nil)
        children = cc_line.children.order(:position)
        children_ids = children.map(&:id)

        # Strategy 1: Find POs via allocations (CC-level accept flow)
        po_by_line = {}
        if children_ids.any?
          CustomQuoteAllocation
            .where(custom_quote_line_id: children_ids)
            .where.not(purchase_order_id: nil)
            .includes(purchase_order: [:quote_warehouse_document, :purchase_order_documents])
            .each do |alloc|
              po_by_line[alloc.custom_quote_line_id] ||= alloc.purchase_order
            end
        end

        # Strategy 2: Find POs via sm_task_id match (fallback for POs created outside allocation flow)
        task_ids = children.filter_map(&:sm_task_id)
        po_by_task = {}
        if task_ids.any?
          PurchaseOrder
            .where(sm_task_id: task_ids)
            .includes(:quote_warehouse_document, :purchase_order_documents)
            .each do |po|
              po_by_task[po.sm_task_id] ||= po
            end
        end

        {
          id: cc_line.id,
          name: cc_line.name,
          quoteLevel: cc_line.quote_level,
          tenderDescription: cc_line.tender_description,
          budgetAmount: cc_line.budget_amount&.to_f,
          children: children.map { |child|
            po = po_by_line[child.id] || (child.sm_task_id ? po_by_task[child.sm_task_id] : nil)
            child_data = {
              id: child.id,
              name: child.name,
              budgetAmount: child.budget_amount&.to_f,
              purchaseOrderId: po&.id,
              purchaseOrderNumber: po&.purchase_order_number
            }
            if po
              child_data[:po] = {
                budget: po.budget&.to_f,
                total: po.total&.to_f,
                description: po.description&.truncate(120),
                plansCount: po.purchase_order_documents.size,
                hasQuoteAttached: po.quote_warehouse_document_id.present?,
                status: po.status
              }
            end
            child_data
          }
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
            documentId: cqs.warehouse_document_id
          }
        }
      end
    end
  end
end
