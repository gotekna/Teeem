# frozen_string_literal: true

module Api
  module V1
    module Sda
      class RentLedgerController < ApplicationController
        # GET /api/v1/sda/rent_ledger/entries
        def entries
          scope = SdaRentLedgerEntry.includes(:property, :tenancy, :contact).order(entry_date: :desc)
          scope = apply_entry_filters(scope)

          render_success(scope.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            tenancy: { only: [:id] },
            contact: { only: [:id, :display_name] }
          }))
        end

        # POST /api/v1/sda/rent_ledger/entries
        def create_entry
          entry = SdaRentLedgerEntry.new(entry_params)

          if entry.save
            render_success(entry, status: :created)
          else
            render_validation_errors(entry)
          end
        end

        # PATCH /api/v1/sda/rent_ledger/entries/:id
        def update_entry
          entry = SdaRentLedgerEntry.find(params[:id])

          if entry.update(entry_params)
            render_success(entry)
          else
            render_validation_errors(entry)
          end
        end

        # DELETE /api/v1/sda/rent_ledger/entries/:id
        def destroy_entry
          entry = SdaRentLedgerEntry.find(params[:id])
          entry.destroy
          render_success
        end

        # GET /api/v1/sda/rent_ledger/balance
        # Returns the running balance (total debits - total credits) for a property.
        def balance
          unless params[:property_id].present?
            return render_error("property_id is required", status: :unprocessable_entity)
          end

          scope = SdaRentLedgerEntry.where(property_id: params[:property_id])
          scope = scope.for_period(Date.parse(params[:start_date]), Date.parse(params[:end_date])) if params[:start_date].present? && params[:end_date].present?

          total_debits  = scope.sum("COALESCE(debit_amount, 0)")
          total_credits = scope.sum("COALESCE(credit_amount, 0)")
          balance       = total_debits - total_credits

          render_success({
            propertyId: params[:property_id].to_i,
            totalDebits: total_debits,
            totalCredits: total_credits,
            balance: balance,
            entryCount: scope.count
          })
        end

        # GET /api/v1/sda/rent_ledger/arrears
        def arrears
          scope = SdaArrears.includes(:property, :tenancy, :contact).order(created_at: :desc)
          scope = apply_arrears_filters(scope)

          render_success(scope.as_json(include: {
            property: { only: [:id, :name, :street_address] },
            tenancy: { only: [:id] },
            contact: { only: [:id, :display_name] }
          }))
        end

        # POST /api/v1/sda/rent_ledger/arrears
        def create_arrears
          arrears = SdaArrears.new(arrears_params)

          if arrears.save
            render_success(arrears, status: :created)
          else
            render_validation_errors(arrears)
          end
        end

        # PATCH /api/v1/sda/rent_ledger/arrears/:id
        def update_arrears
          arrears = SdaArrears.find(params[:id])

          if arrears.update(arrears_params)
            render_success(arrears)
          else
            render_validation_errors(arrears)
          end
        end

        # POST /api/v1/sda/rent_ledger/reconcile
        # Marks a set of ledger entries as reconciled.
        def reconcile
          entry_ids = params[:entry_ids]

          unless entry_ids.present?
            return render_error("entry_ids is required", status: :unprocessable_entity)
          end

          entries = SdaRentLedgerEntry.where(id: entry_ids)

          if entries.update_all(reconciled: true, reconciled_date: Time.current)
            render_success({
              reconciledCount: entries.count,
              entryIds: entries.pluck(:id)
            })
          else
            render_error("Failed to reconcile entries", status: :unprocessable_entity)
          end
        end

        private

        def entry_params
          params.require(:sda_rent_ledger_entry).permit(
            :property_id, :tenancy_id, :contact_id, :gl_invoice_id,
            :entry_type, :entry_date, :debit_amount, :credit_amount,
            :description, :reference, :reconciled, :reconciled_date
          )
        end

        def arrears_params
          params.require(:sda_arrears).permit(
            :property_id, :tenancy_id, :contact_id,
            :status, :resolution, :amount_overdue, :days_overdue,
            :first_missed_date, :resolved_date, :notes
          )
        end

        def apply_entry_filters(scope)
          scope = scope.where(property_id: params[:property_id]) if params[:property_id].present?
          scope = scope.where(tenancy_id: params[:tenancy_id]) if params[:tenancy_id].present?
          scope = scope.where(entry_type: params[:entry_type]) if params[:entry_type].present?
          if params[:start_date].present? && params[:end_date].present?
            scope = scope.for_period(Date.parse(params[:start_date]), Date.parse(params[:end_date]))
          end
          scope
        end

        def apply_arrears_filters(scope)
          scope = scope.where(property_id: params[:property_id]) if params[:property_id].present?
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope
        end
      end
    end
  end
end
