# frozen_string_literal: true

module Api
  module V1
    # Referrers Controller
    # Manages referrer network, commissions, and eligibility
    #
    # A referrer is a Contact that refers SaaS customers and earns commissions:
    # - L1 (20%): Direct referrals (customers have this contact as support_contact)
    # - L2 (10%): Indirect referrals (customers have this contact as upline_contact)
    #
    # Eligibility requirements:
    # - Training completed (and not expired)
    # - L1: $10,000 total network fees
    # - L2: $50,000 total network fees
    #
    # Endpoints:
    # - GET    /api/v1/referrers              - List all referrers
    # - GET    /api/v1/referrers/:id          - Show referrer details
    # - PATCH  /api/v1/referrers/:id          - Update referrer
    # - GET    /api/v1/referrers/:id/network  - Get referrer's network tree
    # - GET    /api/v1/referrers/:id/commissions - Get referrer's commissions
    # - POST   /api/v1/referrers/:id/complete_training - Mark training complete
    # - POST   /api/v1/referrers/:id/recalculate - Recalculate network fees
    #
    class ReferrersController < ApplicationController
      before_action :set_referrer, only: [:show, :update, :network, :commissions, :complete_training, :recalculate]

      # GET /api/v1/referrers
      def index
        referrers = Contact.where.not(referrer_status: nil)
          .or(Contact.where("total_network_fees > 0"))
          .includes(:l1_referrals, :l2_referrals)
          .order(:name)

        # Filter by status
        referrers = referrers.where(referrer_status: params[:status]) if params[:status].present?

        # Filter by eligibility
        case params[:eligibility]
        when "l1_eligible"
          referrers = referrers.where("total_network_fees >= ?", ReferralCommissionService::L1_THRESHOLD)
            .where.not(referrer_training_completed_at: nil)
        when "l2_eligible"
          referrers = referrers.where("total_network_fees >= ?", ReferralCommissionService::L2_THRESHOLD)
            .where.not(referrer_training_completed_at: nil)
        end

        render json: {
          success: true,
          data: referrers.map { |r| referrer_json(r) }
        }
      end

      # GET /api/v1/referrers/:id
      def show
        render json: {
          success: true,
          data: referrer_json(@referrer, full: true)
        }
      end

      # PATCH /api/v1/referrers/:id
      def update
        if @referrer.update(referrer_params)
          render json: { success: true, data: referrer_json(@referrer, full: true) }
        else
          render json: { success: false, error: @referrer.errors.full_messages.join(", ") }, status: :unprocessable_entity
        end
      end

      # GET /api/v1/referrers/:id/network
      # Returns the referrer's network tree (who they referred, and who those referred)
      def network
        render json: {
          success: true,
          data: {
            referrer: {
              id: @referrer.id,
              name: @referrer.display_name
            },
            l1_referrals: @referrer.l1_referrals.saas_customers.map do |c|
              {
                id: c.id,
                name: c.display_name,
                annual_turnover: c.annual_turnover,
                saas_status: c.saas_status,
                saas_started_at: c.saas_started_at,
                monthly_fee: c.calculate_saas_fee[:cost]&./(12.0)&.round(2)
              }
            end,
            l2_referrals: @referrer.l2_referrals.saas_customers.map do |c|
              {
                id: c.id,
                name: c.display_name,
                referred_by: c.support_contact&.display_name,
                annual_turnover: c.annual_turnover,
                saas_status: c.saas_status,
                monthly_fee: c.calculate_saas_fee[:cost]&./(12.0)&.round(2)
              }
            end,
            network_stats: {
              total_l1: @referrer.l1_referrals.saas_customers.count,
              total_l2: @referrer.l2_referrals.saas_customers.count,
              total_network_fees: @referrer.total_network_fees,
              l1_threshold: ReferralCommissionService::L1_THRESHOLD,
              l2_threshold: ReferralCommissionService::L2_THRESHOLD
            }
          }
        }
      end

      # GET /api/v1/referrers/:id/commissions
      def commissions
        records = @referrer.referral_commissions
          .includes(:customer_contact, :saas_billing_record)
          .order(created_at: :desc)

        # Filter by status
        records = records.where(status: params[:status]) if params[:status].present?

        # Filter by level
        records = records.where(commission_level: params[:level]) if params[:level].present?

        # Date range
        if params[:start_date].present? && params[:end_date].present?
          records = records.where(created_at: params[:start_date].to_date..params[:end_date].to_date)
        end

        render json: {
          success: true,
          data: records.map { |c| commission_json(c) },
          summary: {
            total_earned: @referrer.total_commissions_earned,
            total_paid: @referrer.total_commissions_paid,
            pending: ReferralCommissionService.pending_total(@referrer),
            eligible: ReferralCommissionService.eligible_total(@referrer)
          }
        }
      end

      # POST /api/v1/referrers/:id/complete_training
      # Marks training as complete (admin action)
      def complete_training
        training_type = params[:training_type] || "standard"
        validity_years = params[:validity_years]&.to_i || 2

        @referrer.update!(
          referrer_training_completed_at: Time.current,
          referrer_training_expires_at: Time.current + validity_years.years,
          referrer_status: "training"
        )

        # Re-evaluate eligibility
        @referrer.check_and_update_eligibility!

        # Re-evaluate pending commissions
        ReferralCommissionService.reevaluate_pending_commissions(@referrer)

        render json: {
          success: true,
          data: referrer_json(@referrer, full: true),
          message: "Training completed. #{validity_years} year validity."
        }
      end

      # POST /api/v1/referrers/:id/recalculate
      # Recalculates network fees and eligibility
      def recalculate
        @referrer.update_network_fee_cache!
        ReferralCommissionService.reevaluate_pending_commissions(@referrer)

        render json: {
          success: true,
          data: referrer_json(@referrer, full: true),
          message: "Network fees recalculated"
        }
      end

      # GET /api/v1/referrers/dashboard
      def dashboard
        render json: {
          success: true,
          data: {
            total_referrers: Contact.where.not(referrer_status: nil).count,
            l1_eligible: Contact.where("total_network_fees >= ?", ReferralCommissionService::L1_THRESHOLD)
              .where.not(referrer_training_completed_at: nil).count,
            l2_eligible: Contact.where("total_network_fees >= ?", ReferralCommissionService::L2_THRESHOLD)
              .where.not(referrer_training_completed_at: nil).count,
            pending_commissions: ReferralCommission.pending.sum(:commission_amount),
            eligible_commissions: ReferralCommission.eligible.sum(:commission_amount),
            paid_this_month: ReferralCommission.paid
              .where("paid_at >= ?", Date.current.beginning_of_month)
              .sum(:commission_amount),
            training_expiring_soon: Contact
              .where("referrer_training_expires_at BETWEEN ? AND ?", Date.current, 30.days.from_now)
              .count,
            top_referrers: Contact
              .where("total_network_fees > 0")
              .order(total_network_fees: :desc)
              .limit(10)
              .map { |r| { id: r.id, name: r.display_name, network_fees: r.total_network_fees } }
          }
        }
      end

      # POST /api/v1/referrers/process_pending
      # Process all pending commissions (admin action)
      def process_pending
        ReferralCommissionService.process_pending_commissions

        render json: {
          success: true,
          message: "Pending commissions processed"
        }
      end

      private

      def set_referrer
        @referrer = Contact.find(params[:id])
      end

      def referrer_params
        params.permit(
          :referrer_status,
          :referrer_training_completed_at,
          :referrer_training_expires_at
        )
      end

      def referrer_json(referrer, full: false)
        data = {
          id: referrer.id,
          name: referrer.display_name,
          referrer_status: referrer.referrer_status,
          total_network_fees: referrer.total_network_fees,
          total_commissions_earned: referrer.total_commissions_earned,
          total_commissions_paid: referrer.total_commissions_paid,
          l1_eligible: referrer.referrer_eligible_for_l1?,
          l2_eligible: referrer.referrer_eligible_for_l2?,
          training_completed: referrer.referrer_training_completed_at.present?,
          training_expires_at: referrer.referrer_training_expires_at,
          l1_referrals_count: referrer.l1_referrals.saas_customers.count,
          l2_referrals_count: referrer.l2_referrals.saas_customers.count
        }

        if full
          data[:l1_eligible_at] = referrer.l1_eligible_at
          data[:l2_eligible_at] = referrer.l2_eligible_at
          data[:training_completed_at] = referrer.referrer_training_completed_at
          data[:pending_commissions] = ReferralCommissionService.pending_total(referrer)
          data[:eligible_commissions] = ReferralCommissionService.eligible_total(referrer)
          data[:thresholds] = {
            l1: ReferralCommissionService::L1_THRESHOLD,
            l2: ReferralCommissionService::L2_THRESHOLD,
            l1_progress: (referrer.total_network_fees / ReferralCommissionService::L1_THRESHOLD * 100).round(1).clamp(0, 100),
            l2_progress: (referrer.total_network_fees / ReferralCommissionService::L2_THRESHOLD * 100).round(1).clamp(0, 100)
          }
        end

        data
      end

      def commission_json(commission)
        {
          id: commission.id,
          level: commission.commission_level,
          level_display: commission.level_display,
          customer: {
            id: commission.customer_contact.id,
            name: commission.customer_contact.display_name
          },
          customer_fee: commission.customer_fee,
          commission_rate: commission.commission_rate,
          commission_amount: commission.commission_amount,
          status: commission.status,
          status_display: commission.status_display,
          ineligible_reason: commission.ineligible_reason,
          billing_period: commission.saas_billing_record&.billing_period_start,
          paid_at: commission.paid_at,
          created_at: commission.created_at
        }
      end
    end
  end
end
