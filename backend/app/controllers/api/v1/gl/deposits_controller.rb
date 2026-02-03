# frozen_string_literal: true

module Api
  module V1
    module Gl
      class DepositsController < ApplicationController
        # GET /api/v1/gl/deposits
        def index
          deposits = current_company.gl_deposits
                                    .includes(:contact, :job, :allocations)
                                    .order(received_date: :desc)

          # Filter by contact
          deposits = deposits.where(contact_id: params[:contact_id]) if params[:contact_id].present?

          # Filter by job
          deposits = deposits.where(job_id: params[:job_id]) if params[:job_id].present?

          # Filter by status
          deposits = deposits.where(status: params[:status]) if params[:status].present?

          # Filter by type
          deposits = deposits.where(deposit_type: params[:type]) if params[:type].present?

          # Only with balance
          deposits = deposits.with_balance if params[:with_balance] == "true"

          render json: {
            success: true,
            data: deposits.map { |d| deposit_json(d) }
          }
        end

        # GET /api/v1/gl/deposits/:id
        def show
          deposit = find_deposit

          render json: {
            success: true,
            data: deposit_json(deposit, include_allocations: true)
          }
        end

        # POST /api/v1/gl/deposits
        def create
          deposit = current_company.gl_deposits.build(deposit_params)
          deposit.received_by = current_user

          if deposit.save
            render json: {
              success: true,
              data: deposit_json(deposit),
              message: "Deposit recorded"
            }
          else
            render json: {
              success: false,
              error: deposit.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/deposits/:id
        def update
          deposit = find_deposit

          if deposit.applied_amount.to_d > 0
            return render json: {
              success: false,
              error: "Cannot update a deposit that has been applied to invoices"
            }, status: :unprocessable_entity
          end

          if deposit.update(deposit_params)
            render json: {
              success: true,
              data: deposit_json(deposit),
              message: "Deposit updated"
            }
          else
            render json: {
              success: false,
              error: deposit.errors.full_messages.join(", ")
            }, status: :unprocessable_entity
          end
        end

        # DELETE /api/v1/gl/deposits/:id
        def destroy
          deposit = find_deposit

          if deposit.applied_amount.to_d > 0
            return render json: {
              success: false,
              error: "Cannot delete a deposit that has been applied to invoices"
            }, status: :unprocessable_entity
          end

          deposit.destroy

          render json: {
            success: true,
            message: "Deposit deleted"
          }
        end

        # POST /api/v1/gl/deposits/:id/apply
        def apply
          deposit = find_deposit
          invoice = Gl::Invoice.find(params[:invoice_id])
          amount = params[:amount]&.to_d || [deposit.balance, invoice.balance_due].min

          allocation = deposit.apply_to_invoice!(invoice, amount: amount, user: current_user)

          render json: {
            success: true,
            data: deposit_json(deposit.reload, include_allocations: true),
            allocation: {
              id: allocation.id,
              invoice_id: allocation.invoice_id,
              amount: allocation.amount
            },
            message: "Deposit applied: $#{amount}"
          }
        rescue StandardError => e
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end

        # POST /api/v1/gl/deposits/:id/unapply
        def unapply
          deposit = find_deposit
          invoice = Gl::Invoice.find(params[:invoice_id])

          deposit.unapply_from_invoice!(invoice, user: current_user)

          render json: {
            success: true,
            data: deposit_json(deposit.reload, include_allocations: true),
            message: "Deposit allocation reversed"
          }
        rescue StandardError => e
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end

        # POST /api/v1/gl/deposits/:id/refund
        def refund
          deposit = find_deposit
          amount = params[:amount]&.to_d || deposit.balance
          reason = params[:reason]

          deposit.refund!(amount: amount, user: current_user, reason: reason)

          render json: {
            success: true,
            data: deposit_json(deposit),
            message: "Refund processed: $#{amount}"
          }
        rescue StandardError => e
          render json: {
            success: false,
            error: e.message
          }, status: :unprocessable_entity
        end

        # GET /api/v1/gl/deposits/for_invoice/:invoice_id
        def for_invoice
          invoice = Gl::Invoice.find(params[:invoice_id])
          deposits = Gl::Deposit.available_for_invoice(invoice)

          render json: {
            success: true,
            data: deposits.map { |d| deposit_json(d) },
            invoice_balance: invoice.balance_due
          }
        end

        # GET /api/v1/gl/deposits/summary
        def summary
          deposits = current_company.gl_deposits

          render json: {
            success: true,
            data: {
              total_received: deposits.sum(:amount),
              total_applied: deposits.sum(:applied_amount),
              total_refunded: deposits.sum(:refunded_amount),
              total_balance: deposits.sum(:balance),
              by_type: {
                deposits: deposits.where(deposit_type: "deposit").sum(:balance),
                prepayments: deposits.where(deposit_type: "prepayment").sum(:balance),
                retainers: deposits.where(deposit_type: "retainer").sum(:balance)
              },
              counts: {
                total: deposits.count,
                with_balance: deposits.with_balance.count,
                fully_applied: deposits.where(status: "fully_applied").count
              }
            }
          }
        end

        # GET /api/v1/gl/deposits/by_contact/:contact_id
        def by_contact
          contact = Contact.find(params[:contact_id])
          deposits = current_company.gl_deposits
                                    .for_contact(contact.id)
                                    .order(received_date: :desc)

          render json: {
            success: true,
            data: {
              contact_id: contact.id,
              contact_name: contact.name,
              deposits: deposits.map { |d| deposit_json(d) },
              total_balance: deposits.sum(:balance)
            }
          }
        end

        private

        def find_deposit
          current_company.gl_deposits.find(params[:id])
        end

        def deposit_params
          params.permit(
            :contact_id, :job_id, :bank_account_id, :reference,
            :received_date, :amount, :deposit_type, :payment_method,
            :payment_reference, :description, :notes
          )
        end

        def deposit_json(deposit, include_allocations: false)
          data = {
            id: deposit.id,
            reference: deposit.reference,
            contact_id: deposit.contact_id,
            contact_name: deposit.contact.name,
            job_id: deposit.job_id,
            job_name: deposit.job&.name,
            received_date: deposit.received_date,
            amount: deposit.amount,
            applied_amount: deposit.applied_amount,
            refunded_amount: deposit.refunded_amount,
            balance: deposit.balance,
            deposit_type: deposit.deposit_type,
            type_label: deposit.type_label,
            status: deposit.status,
            payment_method: deposit.payment_method,
            payment_reference: deposit.payment_reference,
            description: deposit.description,
            bank_account_id: deposit.bank_account_id,
            received_by: deposit.received_by&.name,
            created_at: deposit.created_at
          }

          if include_allocations
            data[:allocations] = deposit.allocations.map do |a|
              {
                id: a.id,
                invoice_id: a.invoice_id,
                invoice_number: a.invoice.invoice_number,
                amount: a.amount,
                allocated_at: a.allocated_at,
                allocated_by: a.allocated_by&.name
              }
            end
          end

          data
        end

        def current_company
          @current_company ||= Corporate.find(
            params[:corporate_id] || current_user.corporate_id
          )
        end
      end
    end
  end
end
