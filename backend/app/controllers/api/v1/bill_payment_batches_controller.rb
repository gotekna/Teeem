# frozen_string_literal: true

module Api
  module V1
    class BillPaymentBatchesController < ApplicationController
      before_action :set_corporate_company, only: [ :index, :create, :eligible_bills ]
      before_action :set_batch, only: [ :show, :update, :destroy, :add_bill, :remove_bill,
                                        :generate_aba, :download_aba, :submit_for_approval,
                                        :approve, :mark_submitted, :mark_completed ]

      # GET /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches
      def index
        batches = @corporate_company.bill_payment_batches
                    .includes(:bank_account, :created_by, :approved_by)
                    .order(created_at: :desc)

        batches = batches.where(status: params[:status]) if params[:status].present?
        batches = batches.page(params[:page]).per(params[:per_page] || 25)

        render json: {
          batches: batches.as_json(include: {
            bank_account: {},
            created_by: {},
            approved_by: {}
          }),
          meta: {
            total_count: batches.total_count,
            total_pages: batches.total_pages,
            current_page: batches.current_page
          }
        }
      end

      # GET /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches/:id
      def show
        render json: @batch.as_json(
          include: {
            bank_account: {},
            created_by: {},
            approved_by: {},
            bill_payments: {
              include: {
                bill_inbox: {
                  include: { supplier: {} }
                }
              }
            }
          },
          methods: [ :formatted_total, :status_color ]
        )
      end

      # POST /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches
      def create
        bank_account = @corporate_company.bank_accounts.find(params[:bank_account_id])

        unless bank_account.is_ap_enabled
          return render json: { error: "Bank account is not enabled for AP payments" }, status: :unprocessable_entity
        end

        @batch = @corporate_company.bill_payment_batches.build(
          bank_account: bank_account,
          payment_date: params[:payment_date] || TenantSetting.today + 1.day,
          processing_description: params[:description],
          created_by: current_user
        )

        if @batch.save
          render json: @batch, status: :created
        else
          render json: { errors: @batch.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # PATCH /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches/:id
      def update
        if @batch.update(batch_params)
          render json: @batch
        else
          render json: { errors: @batch.errors.full_messages }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches/:id
      def destroy
        if @batch.cancel!
          render json: { success: true }
        else
          render json: { error: "Cannot cancel batch in #{@batch.status} status" }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches/:id/add_bill
      def add_bill
        unless @batch.can_add_items?
          return render json: { error: "Cannot add items to batch in #{@batch.status} status" }, status: :unprocessable_entity
        end

        bill = BillInbox.find(params[:bill_inbox_id])

        unless bill.payable?
          return render json: { error: "Bill is not payable (status: #{bill.status})" }, status: :unprocessable_entity
        end

        # Check for overpayment
        amount = params[:amount]&.to_d || bill.remaining_balance
        if amount > bill.remaining_balance
          return render json: { error: "Amount ($#{amount}) exceeds remaining balance ($#{bill.remaining_balance})" }, status: :unprocessable_entity
        end

        @batch.add_bill!(bill, amount: amount)
        bill.update!(status: "processing")

        render json: @batch.reload, include: [ :bill_payments ]
      end

      # DELETE /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches/:id/remove_bill/:bill_payment_id
      def remove_bill
        payment = @batch.bill_payments.find(params[:bill_payment_id])

        unless payment.can_be_removed?
          return render json: { error: "Cannot remove payment in #{payment.status} status" }, status: :unprocessable_entity
        end

        payment.bill_inbox.update!(status: "approved")
        payment.destroy!
        @batch.send(:recalculate_totals!)

        render json: @batch.reload
      end

      # POST /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches/:id/generate_aba
      def generate_aba
        unless @batch.can_generate_file?
          return render json: { error: "Cannot generate file for batch in #{@batch.status} status" }, status: :unprocessable_entity
        end

        if @batch.bill_payments.empty?
          return render json: { error: "Batch has no payments" }, status: :unprocessable_entity
        end

        result = @batch.generate_aba_file!

        if result[:success]
          render json: {
            success: true,
            filename: result[:filename],
            batch: @batch.reload
          }
        else
          render json: { error: result[:error], errors: result[:errors] }, status: :unprocessable_entity
        end
      rescue AbaFileGeneratorService::ValidationError => e
        render json: { error: e.message }, status: :unprocessable_entity
      end

      # GET /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches/:id/download_aba
      def download_aba
        unless @batch.aba_file_content.present?
          return render json: { error: "ABA file has not been generated" }, status: :not_found
        end

        send_data @batch.aba_file_content,
                  filename: @batch.aba_file_name,
                  type: "text/plain",
                  disposition: "attachment"
      end

      # POST /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches/:id/submit_for_approval
      def submit_for_approval
        if @batch.submit_for_approval!
          render json: @batch
        else
          render json: { error: "Cannot submit batch for approval" }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches/:id/approve
      def approve
        unless @batch.can_approve?
          return render json: { error: "Cannot approve batch in #{@batch.status} status" }, status: :unprocessable_entity
        end

        @batch.approve!(current_user)
        render json: @batch
      end

      # POST /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches/:id/mark_submitted
      def mark_submitted
        unless @batch.can_submit?
          return render json: { error: "Cannot mark as submitted in #{@batch.status} status" }, status: :unprocessable_entity
        end

        @batch.mark_submitted!
        render json: @batch
      end

      # POST /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches/:id/mark_completed
      def mark_completed
        unless @batch.status == "submitted"
          return render json: { error: "Batch must be submitted before completing" }, status: :unprocessable_entity
        end

        @batch.mark_completed!

        # Sync payments to Xero
        @batch.bill_payments.each do |payment|
          XeroBillPaymentSyncJob.perform_later(payment.id) if payment.bill_inbox.xero_invoice_id.present?
        end

        render json: @batch
      end

      # GET /api/v1/corporate_companies/:corporate_company_id/bill_payment_batches/eligible_bills
      def eligible_bills
        bills = BillInbox
          .where(corporate_company: @corporate_company)
          .where(status: "approved")
          .includes(:supplier, :matched_purchase_order)

        # Filter by due date
        if params[:due_by].present?
          bills = bills.where("due_date <= ?", params[:due_by])
        end

        # Filter by supplier
        if params[:supplier_id].present?
          bills = bills.where(supplier_id: params[:supplier_id])
        end

        render json: bills.as_json(
          include: {
            supplier: {},
            matched_purchase_order: {}
          },
          methods: [ :remaining_balance ]
        )
      end

      private

      def set_corporate_company
        # Support both nested (/companies/:id/bill_payment_batches) and top-level (/bill_payment_batches) routes
        if params[:corporate_company_id].present?
          @corporate_company = Corporate.find(params[:corporate_company_id])
        elsif params[:company_id].present?
          @corporate_company = Corporate.find(params[:company_id])
        else
          # For top-level route without company filter, use the user's default company
          @corporate_company = current_user&.corporate_company || Corporate.first
        end
      end

      def set_batch
        @batch = BillPaymentBatch.find(params[:id])

        # Ensure batch belongs to the right company if corporate_company_id is provided
        if params[:corporate_company_id].present? && @batch.corporate_company_id != params[:corporate_company_id].to_i
          raise ActiveRecord::RecordNotFound
        end
      end

      def batch_params
        params.permit(:payment_date, :processing_description, :notes)
      end
    end
  end
end
