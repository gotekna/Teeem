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

        # Search using SSoT SearchService
        if params[:search].present?
          bills = SearchService.apply(
            bills,
            params[:search],
            columns: %w[supplier_name_raw invoice_number],
            mode: params[:search_mode] || 'contains',
            model: BillInboxItem
          )
        end

        # Manual pagination (no kaminari)
        page = (params[:page] || 1).to_i
        per_page = (params[:per_page] || 25).to_i
        total_count = bills.count
        total_pages = (total_count.to_f / per_page).ceil

        bills = bills.recent.limit(per_page).offset((page - 1) * per_page)

        render json: {
          bills: bills.as_json(
            include: {
              corporate_company: {},
              supplier: {},
              matched_purchase_order: {}
            },
            methods: [ :has_invoice_file?, :invoice_file_content_type, :invoice_file_filename ]
          ),
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
      # Downloads from SharePoint (SSoT) - no Active Storage fallback
      def download
        unless @bill.sharepoint_file_id.present?
          return render json: { error: "No SharePoint file ID - file not uploaded yet" }, status: :not_found
        end

        content = @bill.download_invoice_file
        unless content
          return render json: { error: "Failed to download from SharePoint" }, status: :service_unavailable
        end

        disposition = params[:disposition] == "attachment" ? "attachment" : "inline"
        send_data content,
                  filename: @bill.invoice_file_filename || "invoice.pdf",
                  type: @bill.invoice_file_content_type || "application/pdf",
                  disposition: disposition
      end

      # POST /api/v1/bill_inbox
      def create
        @bill = BillInbox.new(bill_params)
        @bill.source = "upload"

        if @bill.save
          # SharePoint upload happens via after_commit callback
          # Extraction will be queued after SharePoint upload completes (in the job)
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
        unless @bill.sharepoint_file_id.present?
          return render json: { error: "No SharePoint file - upload not complete" }, status: :unprocessable_entity
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
