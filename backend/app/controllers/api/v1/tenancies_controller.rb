module Api
  module V1
    class TenanciesController < ApplicationController
      before_action :set_tenancy, only: [:show, :update, :destroy, :activate, :terminate]

      # GET /api/v1/tenancies
      def index
        tenancies = Tenancy.includes(:property, :sda_participant_contact)
                           .order(start_date: :desc)
        tenancies = tenancies.where(property_id: params[:property_id]) if params[:property_id].present?
        tenancies = tenancies.where(status: params[:status]) if params[:status].present?

        render_success(tenancies.as_json(include: {
          property: { only: [:id, :name, :street_address, :property_code] },
          sda_participant_contact: { only: [:id, :display_name] }
        }))
      end

      # GET /api/v1/tenancies/:id
      def show
        render_success(@tenancy.as_json(include: {
          property: { only: [:id, :name, :street_address, :property_code] },
          sda_participant_contact: { only: [:id, :display_name, :email, :phone] }
        }))
      end

      # POST /api/v1/tenancies
      def create
        tenancy = Tenancy.new(tenancy_params)

        if tenancy.save
          render_success(tenancy, status: :created)
        else
          render_validation_errors(tenancy)
        end
      end

      # PATCH /api/v1/tenancies/:id
      def update
        if @tenancy.update(tenancy_params)
          render_success(@tenancy)
        else
          render_validation_errors(@tenancy)
        end
      end

      # DELETE /api/v1/tenancies/:id
      def destroy
        @tenancy.destroy
        render_success
      end

      # PATCH /api/v1/tenancies/:id/activate
      def activate
        if @tenancy.update(status: "active")
          render_success(@tenancy)
        else
          render_validation_errors(@tenancy)
        end
      end

      # PATCH /api/v1/tenancies/:id/terminate
      def terminate
        if @tenancy.update(status: "terminated", end_date: params[:end_date] || Date.current)
          render_success(@tenancy)
        else
          render_validation_errors(@tenancy)
        end
      end

      private

      def set_tenancy
        @tenancy = Tenancy.find(params[:id])
      end

      def tenancy_params
        params.require(:tenancy).permit(
          :property_id, :tenancy_type, :status,
          :start_date, :end_date, :lease_term_months,
          :weekly_rent, :rent_frequency,
          :bond_amount, :bond_lodged, :bond_reference,
          :sda_participant_contact_id, :sda_plan_number,
          :sda_weekly_rate, :participant_rent_contribution, :ndia_payment_amount,
          :notes
        )
      end
    end
  end
end
