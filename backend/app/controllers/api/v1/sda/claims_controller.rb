# frozen_string_literal: true

module Api
  module V1
    module Sda
      class ClaimsController < ApplicationController
        before_action :set_claim, only: [:show, :update, :destroy, :submit]

        # GET /api/v1/sda/claims
        def index
          claims = SdaClaim.includes(:property, :tenancy, :contact, :submitted_by_user)
                           .order(period_start: :desc)

          claims = apply_filters(claims)

          render_success(claims.as_json(include: {
            property:          { only: [:id, :name, :street_address, :property_code] },
            tenancy:           { only: [:id, :status, :tenancy_type] },
            contact:           { only: [:id, :display_name] },
            submitted_by_user: { only: [:id, :name, :email] }
          }))
        end

        # GET /api/v1/sda/claims/:id
        def show
          claim_json = @claim.as_json(include: {
            property:          { only: [:id, :name, :street_address, :property_code] },
            tenancy:           { only: [:id, :status, :tenancy_type, :start_date, :end_date] },
            contact:           { only: [:id, :display_name, :email, :phone] },
            submitted_by_user: { only: [:id, :name, :email] }
          })

          # Include line_items when the association exists on the model.
          # SdaClaimLineItem is planned but not yet persisted; this guard
          # prevents a crash and returns an empty array in the interim.
          claim_json["line_items"] = @claim.try(:sda_claim_line_items)&.as_json || []

          claim_json["variance"]          = @claim.calculate_variance
          claim_json["outstanding_amount"] = @claim.outstanding_amount

          render_success(claim_json)
        end

        # POST /api/v1/sda/claims
        def create
          claim = SdaClaim.new(claim_params)

          if claim.save
            render_success(claim, status: :created)
          else
            render_validation_errors(claim)
          end
        end

        # PATCH /api/v1/sda/claims/:id
        def update
          if @claim.update(claim_params)
            render_success(@claim)
          else
            render_validation_errors(@claim)
          end
        end

        # DELETE /api/v1/sda/claims/:id
        def destroy
          @claim.destroy
          render_success
        end

        # POST /api/v1/sda/claims/:id/submit
        # Marks a claim as submitted, recording the timestamp and acting user.
        def submit
          if @claim.status == "submitted"
            return render_error("Claim is already submitted", status: :unprocessable_entity)
          end

          if @claim.update(
            status:             "submitted",
            submitted_date:     Date.today,
            submitted_by_user:  current_user
          )
            render_success(@claim)
          else
            render_validation_errors(@claim)
          end
        end

        # GET /api/v1/sda/claims/stats
        # Returns aggregate payment figures, optionally scoped to a period.
        def stats
          scope = SdaClaim.all
          scope = scope.for_period(params[:period_start], params[:period_end]) if params[:period_start].present? && params[:period_end].present?

          total_claimed  = scope.sum(:claimed_amount).to_f.round(2)
          total_paid     = scope.where(status: "paid").sum(:paid_amount).to_f.round(2)
          total_rejected = scope.where(status: "rejected").sum(:claimed_amount).to_f.round(2)
          total_pending  = scope.pending.sum(:claimed_amount).to_f.round(2)

          by_claim_type = SdaClaim::CLAIM_TYPES.index_with do |type|
            scope.where(claim_type: type).sum(:claimed_amount).to_f.round(2)
          end

          by_status = SdaClaim::STATUSES.index_with do |status|
            scope.where(status: status).count
          end

          render_success({
            totalClaimed:   total_claimed,
            totalPaid:      total_paid,
            totalPending:   total_pending,
            totalRejected:  total_rejected,
            byClaimType:    by_claim_type,
            byStatus:       by_status
          })
        end

        private

        def set_claim
          @claim = SdaClaim.find(params[:id])
        rescue ActiveRecord::RecordNotFound
          render_error("Claim not found", status: :not_found)
        end

        def claim_params
          params.require(:sda_claim).permit(
            :property_id,
            :tenancy_id,
            :contact_id,
            :claim_type,
            :status,
            :period_type,
            :period_start,
            :period_end,
            :claimed_amount,
            :paid_amount,
            :payment_date,
            :submitted_date,
            :reference_number,
            :notes,
            :proda_service_booking_id,
            :proda_claim_reference,
            :proda_submitted_at,
            :ndia_payment_request_id
          )
        end

        def apply_filters(scope)
          scope = scope.where(property_id: params[:property_id]) if params[:property_id].present?
          scope = scope.where(status:      params[:status])      if params[:status].present?
          scope = scope.where(claim_type:  params[:claim_type])  if params[:claim_type].present?
          if params[:period_start].present? && params[:period_end].present?
            scope = scope.for_period(params[:period_start], params[:period_end])
          end
          scope
        end
      end
    end
  end
end
