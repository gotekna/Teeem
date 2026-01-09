# frozen_string_literal: true

module Api
  module V1
    module Gl
      # Controller for billable expenses
      class ExpensesController < ApplicationController
        before_action :set_corporate_company

        # GET /api/v1/gl/expenses
        def index
          expenses = @corporate_company.gl_billable_expenses
                                       .includes(:job, :contact, :user)
                                       .order(expense_date: :desc)

          expenses = expenses.where(job_id: params[:job_id]) if params[:job_id].present?
          expenses = expenses.where(status: params[:status]) if params[:status].present?
          expenses = expenses.unbilled if params[:unbilled_only] == "true"

          render json: { success: true, data: expenses.as_json(include: [:job, :contact, :user]) }
        end

        # GET /api/v1/gl/expenses/:id
        def show
          expense = @corporate_company.gl_billable_expenses.find(params[:id])
          render json: { success: true, data: expense.as_json(include: [:job, :contact, :user]) }
        end

        # POST /api/v1/gl/expenses
        def create
          expense = @corporate_company.gl_billable_expenses.build(expense_params)
          expense.user = current_user unless expense.user_id

          if expense.save
            render json: { success: true, data: expense }, status: :created
          else
            render json: { success: false, error: expense.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # PATCH /api/v1/gl/expenses/:id
        def update
          expense = @corporate_company.gl_billable_expenses.find(params[:id])

          if expense.update(expense_params)
            render json: { success: true, data: expense }
          else
            render json: { success: false, error: expense.errors.full_messages.join(", ") },
                   status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/expenses/:id/approve
        def approve
          expense = @corporate_company.gl_billable_expenses.find(params[:id])

          if expense.approve!
            render json: { success: true, data: expense }
          else
            render json: { success: false, error: "Cannot approve expense" }, status: :unprocessable_entity
          end
        end

        # POST /api/v1/gl/expenses/batch_approve
        def batch_approve
          expenses = @corporate_company.gl_billable_expenses
                                       .where(id: params[:expense_ids])
                                       .where(status: "pending")

          approved_count = expenses.count { |e| e.approve! }
          render json: { success: true, message: "#{approved_count} expenses approved" }
        end

        # POST /api/v1/gl/expenses/create_invoice
        def create_invoice
          expenses = @corporate_company.gl_billable_expenses
                                       .where(id: params[:expense_ids])
                                       .where(status: "approved")

          return render json: { success: false, error: "No approved expenses" }, status: :unprocessable_entity if expenses.empty?

          job = expenses.first.job
          contact = job.contact

          invoice = Gl::Invoice.create!(
            corporate_company: @corporate_company,
            contact: contact,
            job: job,
            invoice_type: "sales",
            date: Date.current,
            due_date: Date.current + 30.days,
            reference: "Expense Reimbursement - #{job.name}",
            status: "draft"
          )

          total = 0
          expenses.each do |expense|
            expense.add_to_invoice!(invoice)
            total += expense.billable_amount
          end

          invoice.update!(subtotal: total, total: total)

          render json: { success: true, data: invoice, message: "Invoice created with #{expenses.count} expenses" }
        end

        # GET /api/v1/gl/expenses/summary
        def summary
          expenses = @corporate_company.gl_billable_expenses

          render json: {
            success: true,
            data: {
              by_status: {
                pending: expenses.pending.sum(:billable_amount),
                approved: expenses.approved.sum(:billable_amount),
                billed: expenses.where(status: "billed").sum(:billable_amount)
              },
              by_type: expenses.group(:expense_type).sum(:billable_amount),
              total_markup: expenses.sum(:markup_amount),
              unbilled_count: expenses.unbilled.count
            }
          }
        end

        private

        def set_corporate_company
          @corporate_company = CorporateCompany.find(params[:corporate_company_id])
        end

        def expense_params
          params.require(:expense).permit(
            :job_id, :contact_id, :user_id, :expense_date, :expense_type,
            :description, :vendor_name, :receipt_reference, :cost_amount,
            :markup_percent, :billable, :reimbursable, :notes, :document_file_id
          )
        end
      end
    end
  end
end
