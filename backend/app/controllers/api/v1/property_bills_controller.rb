module Api
  module V1
    class PropertyBillsController < ApplicationController
      before_action :set_bill, only: [:show, :update, :destroy, :approve]

      # GET /api/v1/property_bills
      def index
        bills = PropertyBill.includes(:property, :tenancy, :supplier_contact)
                            .order(bill_date: :desc)
        bills = bills.where(property_id: params[:property_id]) if params[:property_id].present?
        bills = bills.where(status: params[:status]) if params[:status].present?
        bills = bills.where(charge_to: params[:charge_to]) if params[:charge_to].present?

        render_success(bills.as_json(include: {
          property: { only: [:id, :name, :property_code] },
          supplier_contact: { only: [:id, :display_name] }
        }))
      end

      # GET /api/v1/property_bills/:id
      def show
        render_success(@bill.as_json(include: {
          property: { only: [:id, :name, :property_code] },
          tenancy: { only: [:id, :status, :weekly_rent] },
          supplier_contact: { only: [:id, :display_name, :email] }
        }))
      end

      # POST /api/v1/property_bills
      def create
        bill = PropertyBill.new(bill_params)

        if bill.save
          render_success(bill, status: :created)
        else
          render_validation_errors(bill)
        end
      end

      # PATCH /api/v1/property_bills/:id
      def update
        if @bill.update(bill_params)
          render_success(@bill)
        else
          render_validation_errors(@bill)
        end
      end

      # DELETE /api/v1/property_bills/:id
      def destroy
        @bill.destroy
        render_success
      end

      # PATCH /api/v1/property_bills/:id/approve
      def approve
        if @bill.update(status: "approved")
          render_success(@bill)
        else
          render_validation_errors(@bill)
        end
      end

      private

      def set_bill
        @bill = PropertyBill.find(params[:id])
      end

      def bill_params
        params.require(:property_bill).permit(
          :property_id, :tenancy_id,
          :bill_type, :description, :amount, :tax_amount,
          :bill_date, :due_date, :charge_to, :status,
          :supplier_contact_id, :notes
        )
      end
    end
  end
end
