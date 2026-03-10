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
        ActiveRecord::Base.transaction do
          unless @bill.update(status: "approved")
            render_validation_errors(@bill) and return
          end

          invoice = generate_invoice_for_bill(@bill)
          if invoice
            @bill.update_columns(status: "invoiced", gl_invoice_id: invoice.id)
          end

          render_success(@bill.reload.as_json.merge(
            gl_invoice_id: invoice&.id
          ))
        end
      rescue => e
        Rails.logger.error("PropertyBill approve failed: #{e.message}")
        render_error("Bill approved but invoice generation failed: #{e.message}")
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

      def generate_invoice_for_bill(bill)
        return nil unless defined?(Gl::Invoice)

        contact = resolve_bill_contact(bill)
        return nil unless contact

        invoice_type = bill.charge_to == "owner" ? "bill" : "sales_invoice"

        corporate = Corporate.first
        return nil unless corporate

        Gl::Invoice.create!(
          corporate: corporate,
          invoice_type: invoice_type,
          status: "approved",
          invoice_date: bill.bill_date,
          due_date: bill.due_date || bill.bill_date + 30.days,
          contact_id: contact.id,
          description: "Property Bill: #{bill.bill_type.humanize} - #{bill.property.name || bill.property.property_code}",
          subtotal: bill.amount,
          total_tax: bill.tax_amount || 0,
          total: bill.total_with_tax,
          amount_due: bill.total_with_tax,
          created_in_teeem: true
        )
      rescue ActiveRecord::RecordInvalid => e
        Rails.logger.error("PropertyBill invoice generation failed: #{e.message}")
        nil
      end

      def resolve_bill_contact(bill)
        case bill.charge_to
        when "tenant"
          bill.tenancy&.property&.property_contacts&.find_by(role: "tenant", is_primary: true)&.contact
        when "owner"
          bill.property.owner_contact
        when "government_ndis"
          Contact.find_by(
            tenant_id: current_tenant&.id,
            display_name: ["NDIA", "National Disability Insurance Agency"]
          )
        end
      end
    end
  end
end
