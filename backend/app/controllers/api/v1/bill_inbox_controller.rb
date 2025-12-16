# frozen_string_literal: true

module Api
  module V1
    class BillInboxController < ApplicationController
      before_action :set_bill, only: [ :show, :update, :destroy, :download, :extract, :match, :approve, :reject ]

      # GET /api/v1/bill_inbox
      def index
        bills = BillInbox.includes(:corporate_company, :supplier, :matched_purchase_order, :approved_by)

        # Filter by status
        bills = bills.by_status(params[:status]) if params[:status].present?

        # Filter by company
        bills = bills.for_company(params[:corporate_company_id]) if params[:corporate_company_id].present?

        # Filter by match status
        bills = bills.where(match_status: params[:match_status]) if params[:match_status].present?

        # Filter by date range
        if params[:from_date].present?
          bills = bills.where("invoice_date >= ?", params[:from_date])
        end
        if params[:to_date].present?
          bills = bills.where("invoice_date <= ?", params[:to_date])
        end

        # Search
        if params[:search].present?
          search_term = "%#{params[:search]}%"
          bills = bills.where(
            "supplier_name_raw ILIKE ? OR invoice_number ILIKE ?",
            search_term, search_term
          )
        end

        # Manual pagination (no kaminari)
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 25).to_i
        total_count = bills.count
        total_pages = (total_count.to_f / per_page).ceil

        bills = bills.recent.limit(per_page).offset((page - 1) * per_page)

        render json: {
          bills: bills.as_json(include: {
            corporate_company: {},
            supplier: {},
            matched_purchase_order: {}
          }),
          meta: {
            total_count: total_count,
            total_pages: total_pages,
            current_page: page
          }
        }
      end

      # GET /api/v1/bill_inbox/:id
      def show
        # Get xero tenant name from corporate company's xero connection
        xero_tenant_name = @bill.corporate_company&.corporate_company_xero_connection&.xero_tenant_name

        render json: @bill.as_json(
          include: {
            corporate_company: {},
            detected_company: {},
            supplier: {},
            matched_purchase_order: {
              include: { supplier: {} }
            },
            approved_by: {},
            bill_payments: {
              include: { bill_payment_batch: {} }
            }
          },
          methods: [ :remaining_balance, :variance_percent, :status_color, :has_invoice_file?, :invoice_file_content_type, :invoice_file_filename ]
        ).merge(
          ai_extraction_result: @bill.ai_extraction_result,
          ocr_extraction_result: @bill.ocr_extraction_result,
          comparison_data: @bill.comparison_data,
          contact_comparison_data: @bill.contact_comparison_data,
          extracted_at: @bill.extracted_at,
          xero_tenant_name: xero_tenant_name
        )
      end

      # GET /api/v1/bill_inbox/:id/download
      # Params:
      #   disposition: "inline" (default) or "attachment" (to open in system app)
      def download
        unless @bill.invoice_file.attached?
          return render json: { error: "No invoice file attached" }, status: :not_found
        end

        begin
          # disposition=attachment will trigger download/open in system app
          disposition = params[:disposition] == "attachment" ? "attachment" : "inline"

          # Stream the file
          send_data @bill.invoice_file.download,
                    filename: @bill.invoice_file.filename.to_s,
                    type: @bill.invoice_file.content_type,
                    disposition: disposition
        rescue ActiveStorage::FileNotFoundError => e
          Rails.logger.error("File not found in storage for BillInbox #{@bill.id}: #{e.message}")
          render json: { error: "Invoice file not found in storage" }, status: :not_found
        end
      end

      # POST /api/v1/bill_inbox
      def create
        @bill = BillInbox.new(bill_params)
        @bill.source = "upload"

        if @bill.save
          # Queue extraction if file is attached
          if @bill.invoice_file.attached?
            InvoiceExtractionJob.perform_later(@bill.id)
          end

          render json: @bill, status: :created
        else
          render json: { errors: @bill.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/bill_inbox/:id
      def update
        if @bill.update(bill_params)
          render json: @bill
        else
          render json: { errors: @bill.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/bill_inbox/:id
      def destroy
        if @bill.status.in?(%w[pending extracted error])
          @bill.destroy
          render json: { success: true }
        else
          render json: { error: "Cannot delete bill in #{@bill.status} status" }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/bill_inbox/:id/extract
      def extract
        unless @bill.invoice_file.attached?
          return render json: { error: "No invoice file attached" }, status: :unprocessable_entity
        end

        InvoiceExtractionJob.perform_later(@bill.id)
        render json: { success: true, message: "Extraction queued" }
      end

      # POST /api/v1/bill_inbox/:id/match
      def match
        unless @bill.status.in?(%w[extracted error])
          return render json: { error: "Bill must be extracted before matching" }, status: :unprocessable_entity
        end

        BillMatchingJob.perform_later(@bill.id)
        render json: { success: true, message: "Matching queued" }
      end

      # POST /api/v1/bill_inbox/:id/approve
      def approve
        unless @bill.status == "approval_pending"
          return render json: { error: "Bill is not pending approval" }, status: :unprocessable_entity
        end

        @bill.approve!(current_user)
        render json: @bill
      end

      # POST /api/v1/bill_inbox/:id/reject
      def reject
        unless @bill.status == "approval_pending"
          return render json: { error: "Bill is not pending approval" }, status: :unprocessable_entity
        end

        reason = params[:reason] || "No reason provided"
        @bill.reject!(current_user, reason)
        render json: @bill
      end

      # GET /api/v1/bill_inbox/stats
      def stats
        bills = BillInbox.all
        bills = bills.for_company(params[:corporate_company_id]) if params[:corporate_company_id].present?

        render json: {
          total: bills.count,
          pending: bills.where(status: "pending").count,
          extracting: bills.where(status: %w[extracting extracted matching]).count,
          awaiting_approval: bills.where(status: "approval_pending").count,
          approved: bills.where(status: "approved").count,
          paid: bills.where(status: "paid").count,
          rejected: bills.where(status: "rejected").count,
          errors: bills.where(status: "error").count,
          with_variance: bills.with_variance.count,
          total_amount_pending: bills.where(status: %w[approval_pending approved]).sum(:total_amount)
        }
      end

      private

      def set_bill
        @bill = BillInbox.find(params[:id])
      end

      def bill_params
        params.permit(
          :corporate_company_id, :supplier_id, :invoice_number,
          :invoice_date, :due_date, :subtotal, :tax_amount, :total_amount,
          :notes, :invoice_file
        )
      end
    end
  end
end
