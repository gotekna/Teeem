# Referral Commission Service
# Calculates and creates commission records for referrers
#
# Commission Levels:
# - L1 (20%): Direct referrer (support_contact) - requires $10k threshold + training
# - L2 (10%): Upline referrer (upline_contact) - requires $50k threshold + training
#
class ReferralCommissionService
  L1_RATE = 0.20
  L2_RATE = 0.10
  L1_THRESHOLD = 10_000
  L2_THRESHOLD = 50_000

  class << self
    # Calculate and create commissions for a billing record
    # @param billing_record [SaasBillingRecord] The billing record to process
    # @return [Array<ReferralCommission>] Created commission records
    def calculate_for_billing_record(billing_record)
      customer = billing_record.contact
      fee = billing_record.fee_calculated
      commissions = []

      # L1 Commission (20%) - to customer's direct support
      if customer.support_contact.present?
        commissions << create_commission(
          referrer: customer.support_contact,
          customer: customer,
          billing_record: billing_record,
          level: "l1",
          rate: L1_RATE,
          amount: fee * L1_RATE
        )
      end

      # L2 Commission (10%) - to customer's upline (support's support)
      if customer.upline_contact.present?
        commissions << create_commission(
          referrer: customer.upline_contact,
          customer: customer,
          billing_record: billing_record,
          level: "l2",
          rate: L2_RATE,
          amount: fee * L2_RATE
        )
      end

      # Notify referrers of new commissions
      commissions.each { |c| notify_referrer(c) }

      commissions
    end

    # Create a single commission record
    def create_commission(referrer:, customer:, billing_record:, level:, rate:, amount:)
      status, reason = determine_eligibility(referrer, level)

      ReferralCommission.create!(
        referrer_contact: referrer,
        customer_contact: customer,
        saas_billing_record: billing_record,
        commission_level: level,
        customer_fee: billing_record.fee_calculated,
        commission_rate: rate,
        commission_amount: amount.round(2),
        status: status,
        ineligible_reason: reason
      )
    end

    # Determine if a referrer is eligible for a commission level
    # @param referrer [Contact] The referrer contact
    # @param level [String] 'l1' or 'l2'
    # @return [Array] [status, ineligible_reason]
    def determine_eligibility(referrer, level)
      # Check training status
      if referrer.referrer_training_completed_at.blank?
        return [ "pending", "training_incomplete" ]
      end

      if referrer.referrer_training_expires_at.present? && referrer.referrer_training_expires_at < Time.current
        return [ "pending", "training_expired" ]
      end

      # Check threshold based on level
      threshold = level == "l1" ? L1_THRESHOLD : L2_THRESHOLD
      if referrer.total_network_fees < threshold
        return [ "pending", "threshold_not_met" ]
      end

      # All checks passed - eligible for payment
      [ "eligible", nil ]
    end

    # Re-evaluate all pending commissions for a referrer
    # Called when referrer's training or threshold changes
    def reevaluate_pending_commissions(referrer)
      referrer.referral_commissions.pending.find_each do |commission|
        status, reason = determine_eligibility(referrer, commission.commission_level)
        commission.update!(status: status, ineligible_reason: reason)
      end
    end

    # Process all pending commissions and update eligibility
    def process_pending_commissions
      ReferralCommission.pending.includes(:referrer_contact).find_each do |commission|
        commission.reevaluate_eligibility!
      end
    end

    # Calculate total pending commissions for a referrer
    def pending_total(referrer)
      referrer.referral_commissions.pending.sum(:commission_amount)
    end

    # Calculate total eligible (payable) commissions for a referrer
    def eligible_total(referrer)
      referrer.referral_commissions.eligible.sum(:commission_amount)
    end

    # Notify referrer about new commission (to be implemented with notification system)
    def notify_referrer(commission)
      # TODO: Integrate with notification system
      # ReferrerNotificationJob.perform_later(commission.id)
      Rails.logger.info("Commission created for referrer ##{commission.referrer_contact_id}: " \
                        "#{commission.level_display} - $#{commission.commission_amount}")
    end

    # Generate monthly billing records and commissions for all active SaaS customers
    def generate_monthly_billing(billing_month = Date.current.beginning_of_month)
      period_start = billing_month.beginning_of_month
      period_end = billing_month.end_of_month

      Contact.active_saas.find_each do |customer|
        # Skip if already billed for this period
        next if customer.saas_billing_records.exists?(
          billing_period_start: period_start,
          billing_period_end: period_end
        )

        # Create billing record
        billing_record = SaasBillingRecord.create!(
          contact: customer,
          billing_period_start: period_start,
          billing_period_end: period_end
        )

        # Create referral commissions
        calculate_for_billing_record(billing_record)

        Rails.logger.info("Created billing record for #{customer.display_name}: $#{billing_record.fee_calculated}")
      end
    end
  end
end
