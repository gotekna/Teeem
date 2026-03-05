# frozen_string_literal: true

module Api
  module V1
    # NDIS Claims Controller
    #
    # Manages NDIS SDA claims through their lifecycle:
    #   draft → submitted → approved → paid
    #
    # Depends on: NdisClaim model and ndis_claims migration.
    # Run `rails db:migrate` after creating the migration before using these endpoints.
    #
    # All claims are tenant-scoped via acts_as_tenant on NdisClaim.
    class NdisClaimsController < ApplicationController
      before_action :require_ndis_claim_model
      before_action :set_claim, only: [:show, :update]

      # GET /api/v1/ndis_claims
      def index
        claims = NdisClaim.includes(:property, :tenancy, :contact)
                          .order(claim_period_start: :desc)

        claims = claims.where(status: params[:status]) if params[:status].present?
        claims = claims.where("claim_period_start >= ?", params[:period_start]) if params[:period_start].present?
        claims = claims.where("claim_period_end <= ?", params[:period_end]) if params[:period_end].present?
        claims = claims.where(property_id: params[:property_id]) if params[:property_id].present?

        # Return in the format the frontend expects
        render json: {
          success: true,
          data: claims.map { |c| serialize_claim(c) }
        }
      end

      # GET /api/v1/ndis_claims/:id
      def show
        render json: {
          success: true,
          data:    @claim.as_json(
            include: {
              property: { only: [:id, :property_code, :name, :street_address, :sda_category, :sda_dwelling_id] },
              tenancy:  {
                only:    [:id, :sda_plan_number, :sda_weekly_rate, :participant_rent_contribution, :ndia_payment_amount],
                include: { sda_participant_contact: { only: [:id, :display_name] } }
              }
            }
          )
        }
      end

      # POST /api/v1/ndis_claims
      def create
        claim = NdisClaim.new(claim_params)

        if claim.save
          render json: { success: true, data: claim.as_json }, status: :created
        else
          render_validation_errors(claim)
        end
      end

      # PATCH /api/v1/ndis_claims/:id
      def update
        if @claim.update(claim_params)
          render json: { success: true, data: @claim.as_json }
        else
          render_validation_errors(@claim)
        end
      end

      # POST /api/v1/ndis_claims/generate_monthly
      # Auto-generates NDIS claims for all active SDA tenancies for current month.
      def generate_monthly
        year  = (params[:year] || Date.current.year).to_i
        month = (params[:month] || Date.current.month).to_i

        if year < 2020 || year > 2099 || month < 1 || month > 12
          return render json: { success: false, error: "Invalid year or month" }, status: :bad_request
        end

        period_start = Date.new(year, month, 1)
        period_end   = period_start.end_of_month

        active_tenancies = Tenancy.includes(:property, :sda_participant_contact)
                                  .where(tenancy_type: "sda", status: "active")

        created = []

        active_tenancies.each do |tenancy|
          next if NdisClaim.where(tenancy_id: tenancy.id, claim_period_start: period_start).exists?

          days = (period_end - period_start).to_i + 1
          daily_rate = (tenancy.sda_weekly_rate || 0).to_f / 7
          total = (daily_rate * days).round(2)
          gst = (total * 0.1).round(2)

          claim = NdisClaim.new(
            property_id: tenancy.property_id,
            tenancy_id: tenancy.id,
            contact: tenancy.sda_participant_contact,
            ndis_participant_number: tenancy.sda_plan_number,
            claim_period_start: period_start,
            claim_period_end: period_end,
            quantity: days,
            unit_price: daily_rate,
            total_amount: total,
            gst_amount: gst,
            status: "draft"
          )

          created << serialize_claim(claim) if claim.save
        end

        render json: { success: true, data: created }
      end

      # POST /api/v1/ndis_claims/bulk_submit
      def bulk_submit
        ids = Array(params[:ids])
        return render json: { success: false, error: "No claim IDs provided" }, status: :bad_request if ids.blank?

        claims = NdisClaim.includes(:property, :tenancy, :contact).where(id: ids, status: "draft")
        claims.each { |c| c.update(status: "submitted", submitted_at: Time.current) }

        render json: {
          success: true,
          data: claims.reload.map { |c| serialize_claim(c) }
        }
      end

      # GET /api/v1/ndis_claims/summary
      # Returns in the format the frontend expects: { totalClaimed, approved, pending, paid, rejected }
      def summary
        all_claims = NdisClaim.all

        render json: {
          success: true,
          data: {
            totalClaimed: all_claims.sum(:total_amount).to_f.round(2),
            approved: all_claims.where(status: "approved").sum(:total_amount).to_f.round(2),
            pending: all_claims.where(status: %w[draft submitted processing]).sum(:total_amount).to_f.round(2),
            paid: all_claims.where(status: "paid").sum(:total_amount).to_f.round(2),
            rejected: all_claims.where(status: "rejected").sum(:total_amount).to_f.round(2)
          }
        }
      end

      private

      def set_claim
        @claim = NdisClaim.find(params[:id])
      rescue ActiveRecord::RecordNotFound
        render_error("NDIS claim not found", status: :not_found)
      end

      def claim_params
        params.require(:ndis_claim).permit(
          :property_id, :tenancy_id, :contact_id,
          :claim_period_start, :claim_period_end,
          :ndis_participant_number, :service_booking_number,
          :support_item_number, :quantity, :unit_price,
          :total_amount, :gst_amount,
          :status, :ndia_reference, :rejection_reason, :rejection_code
        )
      end

      # Serialize a claim into the format the frontend expects
      def serialize_claim(claim)
        property = claim.property
        contact = claim.contact

        {
          id: claim.id,
          propertyAddress: property&.street_address || "Unknown",
          participantName: contact&.try(:display_name),
          period: "#{claim.claim_period_start&.strftime('%d/%m/%Y')} - #{claim.claim_period_end&.strftime('%d/%m/%Y')}",
          amount: claim.total_amount&.to_f || 0,
          status: claim.status,
          submittedAt: claim.submitted_at&.strftime("%d/%m/%Y"),
          approvedAt: claim.approved_at&.strftime("%d/%m/%Y"),
          paidAt: claim.paid_at&.strftime("%d/%m/%Y")
        }
      end

      # Guard: returns a friendly error if the NdisClaim model/table has not
      # been created yet. This prevents a NameError from surfacing as a 500.
      def require_ndis_claim_model
        return if Object.const_defined?("NdisClaim") && NdisClaim.table_exists?

        render json: {
          success: false,
          error:   "NdisClaim model not available. Run the ndis_claims migration first."
        }, status: :service_unavailable
      end
    end
  end
end
