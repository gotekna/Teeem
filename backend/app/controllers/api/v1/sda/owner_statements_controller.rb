# frozen_string_literal: true

module Api
  module V1
    module Sda
      class OwnerStatementsController < ApplicationController
        before_action :set_owner_statement, only: [:show, :update, :destroy, :generate, :send_statement]

        # GET /api/v1/sda/owner_statements
        def index
          statements = SdaOwnerStatement.includes(:property, :owner_contact).order(created_at: :desc)
          statements = apply_filters(statements)

          render_success(statements.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            owner_contact: { only: [:id, :display_name, :email] }
          }))
        end

        # GET /api/v1/sda/owner_statements/:id
        def show
          render_success(@owner_statement.as_json(include: {
            property: { only: [:id, :name, :street_address, :suburb, :sda_category] },
            owner_contact: { only: [:id, :display_name, :email, :phone] }
          }))
        end

        # POST /api/v1/sda/owner_statements
        def create
          statement = SdaOwnerStatement.new(owner_statement_params)

          if statement.save
            render_success(statement, status: :created)
          else
            render_validation_errors(statement)
          end
        end

        # PATCH /api/v1/sda/owner_statements/:id
        def update
          if @owner_statement.update(owner_statement_params)
            render_success(@owner_statement)
          else
            render_validation_errors(@owner_statement)
          end
        end

        # DELETE /api/v1/sda/owner_statements/:id
        def destroy
          @owner_statement.destroy
          render_success
        end

        # POST /api/v1/sda/owner_statements/:id/generate
        # Populates the statement's income and expense figures from the rent ledger.
        def generate
          @owner_statement.generate_from_ledger!
          render_success(@owner_statement.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            owner_contact: { only: [:id, :display_name, :email] }
          }))
        rescue ActiveRecord::RecordInvalid => e
          render_error(e.message, status: :unprocessable_entity)
        end

        # POST /api/v1/sda/owner_statements/:id/send_statement
        # Marks the statement as sent and records the sent date.
        def send_statement
          @owner_statement.mark_sent!
          render_success(@owner_statement)
        rescue ActiveRecord::RecordInvalid => e
          render_error(e.message, status: :unprocessable_entity)
        end

        private

        def set_owner_statement
          @owner_statement = SdaOwnerStatement.find(params[:id])
        end

        def owner_statement_params
          params.require(:sda_owner_statement).permit(
            :property_id, :owner_contact_id, :statement_type, :status,
            :period_start, :period_end, :statement_blob_id,
            :gross_income, :sda_income, :participant_income, :other_income,
            :management_fees, :maintenance_costs, :insurance,
            :council_rates, :water_rates, :body_corporate, :other_expenses,
            :total_expenses, :net_income, :amount_disbursed,
            :depreciation, :interest_expense, :capital_works_deduction,
            :sent_date, :notes
          )
        end

        def apply_filters(scope)
          scope = scope.where(property_id: params[:property_id]) if params[:property_id].present?
          scope = scope.where(owner_contact_id: params[:owner_contact_id]) if params[:owner_contact_id].present?
          scope = scope.where(statement_type: params[:statement_type]) if params[:statement_type].present?
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope
        end
      end
    end
  end
end
