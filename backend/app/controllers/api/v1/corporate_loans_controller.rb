module Api
  module V1
    class CorporateLoansController < ApplicationController
      before_action :set_company, only: [ :index, :show, :create, :update, :destroy ]
      before_action :set_loan, only: [ :show, :update, :destroy ]

      # GET /api/v1/companies/:company_id/loans
      # Shows loans where company is either lender or borrower
      def index
        @loans = @company.all_loans
                         .includes(:lender_company, :borrower_company)
                         .order(loan_date: :desc)

        # Filter by role
        if params[:role] == "lender"
          @loans = @company.loans_as_lender
        elsif params[:role] == "borrower"
          @loans = @company.loans_as_borrower
        end

        # Filter by status
        if params[:status].present?
          @loans = @loans.where(status: params[:status])
        end

        render json: {
          success: true,
          data: @loans.map { |l| serialize_loan(l, perspective: @company) },
          summary: loan_summary
        }
      end

      # GET /api/v1/company_loans
      # List all loans across all companies
      def all
        @loans = CorporateLoan.includes(:lender_company, :borrower_company)
                            .order(loan_date: :desc)

        if params[:status].present?
          @loans = @loans.where(status: params[:status])
        end

        render json: {
          success: true,
          data: @loans.map { |l| serialize_loan(l) }
        }
      end

      # GET /api/v1/companies/:company_id/loans/:id
      def show
        render json: {
          success: true,
          data: serialize_loan(@loan, include_details: true)
        }
      end

      # POST /api/v1/companies/:company_id/loans
      def create
        @loan = CorporateLoan.new(loan_params)

        # Ensure the company is involved in the loan
        unless [ @loan.lender_company_id, @loan.borrower_company_id ].include?(@company.id)
          return render json: {
            success: false,
            errors: [ "Company must be either lender or borrower" ]
          }, status: :unprocessable_entity
        end

        if @loan.save
          render json: {
            success: true,
            data: serialize_loan(@loan)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @loan.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/companies/:company_id/loans/:id
      def update
        if @loan.update(loan_params)
          render json: {
            success: true,
            data: serialize_loan(@loan)
          }
        else
          render json: {
            success: false,
            errors: @loan.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/companies/:company_id/loans/:id
      def destroy
        @loan.destroy
        render json: { success: true }
      end

      # POST /api/v1/companies/:company_id/loans/:id/payment
      def record_payment
        @loan = @company.all_loans.find(params[:id])
        payment_amount = params[:amount].to_f
        payment_date = params[:payment_date] || Date.current

        if payment_amount <= 0
          return render json: {
            success: false,
            errors: [ "Payment amount must be positive" ]
          }, status: :unprocessable_entity
        end

        new_balance = (@loan.current_balance || @loan.principal_amount) - payment_amount

        @loan.update!(
          current_balance: [ new_balance, 0 ].max,
          status: new_balance <= 0 ? "repaid" : "active",
          notes: "#{@loan.notes}\n[#{payment_date}] Payment of $#{payment_amount.round(2)} received"
        )

        render json: {
          success: true,
          data: serialize_loan(@loan),
          payment: {
            amount: payment_amount,
            date: payment_date,
            remaining_balance: @loan.current_balance
          }
        }
      end

      private

      def set_company
        @company = Corporate.find(params[:company_id])
      end

      def set_loan
        @loan = @company.all_loans.find(params[:id])
      end

      def loan_params
        params.require(:company_loan).permit(
          :lender_company_id,
          :borrower_company_id,
          :principal_amount,
          :current_balance,
          :interest_rate,
          :interest_type,
          :loan_date,
          :maturity_date,
          :loan_documents_in_place,
          :security_type,
          :status,
          :notes
        )
      end

      def serialize_loan(loan, perspective: nil, include_details: false)
        data = {
          id: loan.id,
          lender_company_id: loan.lender_company_id,
          lender_company_name: loan.lender_company.name,
          borrower_company_id: loan.borrower_company_id,
          borrower_company_name: loan.borrower_company.name,
          principal_amount: loan.principal_amount,
          current_balance: loan.current_balance || loan.principal_amount,
          interest_rate: loan.interest_rate,
          interest_type: loan.interest_type,
          loan_date: loan.loan_date,
          maturity_date: loan.maturity_date,
          loan_documents_in_place: loan.loan_documents_in_place,
          security_type: loan.security_type,
          status: loan.status,
          notes: loan.notes,
          created_at: loan.created_at,
          updated_at: loan.updated_at
        }

        # Add perspective info (is this company lending or borrowing?)
        if perspective
          data[:role] = loan.lender_company_id == perspective.id ? "lender" : "borrower"
          data[:counterparty] = loan.lender_company_id == perspective.id ?
            loan.borrower_company.name :
            loan.lender_company.name
        end

        if include_details
          data[:lender_company] = {
            id: loan.lender_company.id,
            name: loan.lender_company.name,
            acn: loan.lender_company.acn
          }
          data[:borrower_company] = {
            id: loan.borrower_company.id,
            name: loan.borrower_company.name,
            acn: loan.borrower_company.acn
          }
        end

        data
      end

      def loan_summary
        {
          total_receivable: @company.total_loans_receivable,
          total_payable: @company.total_loans_payable,
          active_loans_as_lender: @company.loans_as_lender.where(status: "active").count,
          active_loans_as_borrower: @company.loans_as_borrower.where(status: "active").count
        }
      end
    end
  end
end
