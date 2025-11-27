module Api
  module V1
    class BankAccountsController < ApplicationController
      before_action :set_bank_account, only: [:show, :update, :destroy]

      # GET /api/v1/bank_accounts
      def index
        @bank_accounts = BankAccount.includes(:company).all

        # Filter by company
        @bank_accounts = @bank_accounts.where(company_id: params[:company_id]) if params[:company_id].present?

        # Filter by status
        @bank_accounts = @bank_accounts.where(status: params[:status]) if params[:status].present?

        render json: {
          success: true,
          bank_accounts: @bank_accounts.as_json(
            include: { company: { only: [:id, :name] } },
            methods: [:display_name, :masked_account_number, :formatted_bsb]
          )
        }
      end

      # GET /api/v1/bank_accounts/:id
      def show
        render json: {
          success: true,
          bank_account: @bank_account.as_json(
            include: { company: { only: [:id, :name] } },
            methods: [:display_name, :formatted_bsb]
          )
        }
      end

      # POST /api/v1/bank_accounts
      def create
        @bank_account = BankAccount.new(bank_account_params)

        if @bank_account.save
          render json: {
            success: true,
            message: 'Bank account created successfully',
            bank_account: @bank_account.as_json(methods: [:display_name, :formatted_bsb])
          }, status: :created
        else
          render json: {
            success: false,
            errors: @bank_account.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/bank_accounts/:id
      def update
        if @bank_account.update(bank_account_params)
          render json: {
            success: true,
            message: 'Bank account updated successfully',
            bank_account: @bank_account.as_json(methods: [:display_name, :formatted_bsb])
          }
        else
          render json: {
            success: false,
            errors: @bank_account.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/bank_accounts/:id
      def destroy
        @bank_account.destroy
        render json: {
          success: true,
          message: 'Bank account deleted successfully'
        }
      end

      private

      def set_bank_account
        @bank_account = BankAccount.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render json: { success: false, error: 'Bank account not found' }, status: :not_found
      end

      def bank_account_params
        params.require(:bank_account).permit(
          :company_id, :institution_name, :bsb, :account_number, :account_name,
          :description, :date_opened, :date_closed, :status
        )
      end
    end
  end
end
