# frozen_string_literal: true

module Api
  module V1
    module Gl
      # Controller for batch payments and ABA file generation
      class PaymentBatchesController < ApplicationController
        before_action :set_corporate_company
        before_action :set_batch, only: [:show, :update, :destroy, :add_bills, :add_payment,
                                         :remove_item, :submit, :approve, :reject,
                                         :generate_aba, :download_aba, :process_batch, :complete]

        # GET /api/v1/gl/payment_batches
        def index
          batches = @corporate_company.gl_payment_batches
                                      .includes(:bank_account, :created_by, :approved_by)
                                      .order(created_at: :desc)

          batches = batches.where(status: params[:status]) if params[:status].present?

          render json: { success: true, data: batches.as_json(include: [:bank_account, :created_by]) }
        end

        # GET /api/v1/gl/payment_batches/:id
        def show
          render json: {
            success: true,
            data: @batch.as_json(
              include: {
                items: { include: [:contact, :invoice] },
                bank_account: {},
                created_by: { only: [:id, :name] },
                approved_by: { only: [:id, :name] }
              }
            )
          }
        end

        # POST /api/v1/gl/payment_batches
        def create
          @batch = @corporate_company.gl_payment_batches.build(batch_params)
          @batch.created_by = current_user
          @batch.payment_date ||= Date.current

          if @batch.save
            render json: { success: true, data: @batch }, status: :created
          else
            render json: { success: false, error: @batch.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/payment_batches/:id
        def destroy
          unless %w[draft failed].include?(@batch.status)
            render json: { success: false, error: "Cannot delete batch in #{@batch.status} status" },
                   status: :unprocessable_entity
            return
          end

          @batch.destroy
          render json: { success: true, message: "Batch deleted" }
        end

        # POST /api/v1/gl/payment_batches/:id/add_bills
        def add_bills
          bills = ::Gl::Invoice.where(id: params[:bill_ids], invoice_type: "bill")
          @batch.add_bills!(bills)

          render json: { success: true, data: @batch.reload, message: "#{bills.count} bills added" }
        end

        # POST /api/v1/gl/payment_batches/:id/add_payment
        def add_payment
          contact = Contact.find(params[:contact_id])
          @batch.add_payment!(
            contact: contact,
            amount: params[:amount].to_d,
            reference: params[:reference]
          )

          render json: { success: true, data: @batch.reload }
        end

        # DELETE /api/v1/gl/payment_batches/:id/items/:item_id
        def remove_item
          item = @batch.items.find(params[:item_id])
          @batch.remove_item!(item)

          render json: { success: true, data: @batch.reload }
        end

        # POST /api/v1/gl/payment_batches/:id/submit
        def submit
          if @batch.submit_for_approval!
            render json: { success: true, data: @batch, message: "Batch submitted for approval" }
          else
            render json: { success: false, error: @batch.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/payment_batches/:id/approve
        def approve
          if @batch.approve!(current_user)
            render json: { success: true, data: @batch, message: "Batch approved" }
          else
            render json: { success: false, error: "Cannot approve batch" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/payment_batches/:id/reject
        def reject
          if @batch.reject!(params[:reason])
            render json: { success: true, data: @batch, message: "Batch rejected" }
          else
            render json: { success: false, error: "Cannot reject batch" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/payment_batches/:id/generate_aba
        def generate_aba
          content = @batch.generate_aba!

          if content
            render json: {
              success: true,
              data: {
                batch: @batch,
                aba_file_name: @batch.aba_file_name,
                aba_generated_at: @batch.aba_generated_at
              },
              message: "ABA file generated"
            }
          else
            render json: { success: false, error: "Cannot generate ABA. Batch must be approved." },
                   status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/payment_batches/:id/download_aba
        def download_aba
          unless @batch.aba_file_content.present?
            render json: { success: false, error: "ABA file not generated" }, status: :not_found
            return
          end

          send_data @batch.aba_file_content,
                    filename: @batch.aba_file_name,
                    type: "text/plain",
                    disposition: "attachment"
        end

        # POST /api/v1/gl/payment_batches/:id/process
        def process_batch
          if @batch.mark_processing!
            render json: { success: true, data: @batch, message: "Batch marked as processing" }
          else
            render json: { success: false, error: "Cannot process batch" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/payment_batches/:id/complete
        def complete
          if @batch.complete!
            render json: { success: true, data: @batch, message: "Batch completed" }
          else
            render json: { success: false, error: "Cannot complete batch" }, status: :unprocessable_entity
          end
        end

        # GET /api/v1/gl/payment_batches/payable_bills
        def payable_bills
          bills = @corporate_company.gl_invoices
                                    .where(invoice_type: "bill", status: %w[approved submitted])
                                    .includes(:contact)
                                    .order(due_date: :asc)

          # Filter by contact
          bills = bills.where(contact_id: params[:contact_id]) if params[:contact_id].present?

          # Filter by due date
          if params[:due_before].present?
            bills = bills.where("due_date <= ?", Date.parse(params[:due_before]))
          end

          render json: {
            success: true,
            data: bills.as_json(include: :contact),
            totals: {
              count: bills.count,
              total_amount: bills.sum(:total)
            }
          }
        end

        # GET /api/v1/gl/payment_batches/summary
        def summary
          batches = @corporate_company.gl_payment_batches

          render json: {
            success: true,
            data: {
              by_status: {
                draft: batches.draft.count,
                pending_approval: batches.pending.count,
                approved: batches.approved.count,
                completed: batches.completed.count
              },
              pending_amount: batches.pending.sum(:total_amount),
              approved_amount: batches.approved.sum(:total_amount),
              this_month: batches.completed.where("completed_at >= ?", Date.current.beginning_of_month)
                                 .sum(:total_amount)
            }
          }
        end

        private

        def set_corporate_company
          @corporate_company = Corporate.find(params[:corporate_company_id])
        end

        def set_batch
          @batch = @corporate_company.gl_payment_batches.find(params[:id])
        end

        def batch_params
          params.require(:payment_batch).permit(:payment_date, :bank_account_id)
        end
      end
    end
  end
end
