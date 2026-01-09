# frozen_string_literal: true

# Monthly SaaS Billing Job
# Generates billing records and referral commissions for all active SaaS customers
#
# Runs on the 1st of each month via solid_queue recurring schedule
# See config/recurring.yml
#
class MonthlySaasBillingJob < ApplicationJob
  queue_as :default

  def perform(billing_month = nil)
    billing_month ||= Date.current.beginning_of_month

    Rails.logger.info("Starting monthly SaaS billing for #{billing_month.strftime('%B %Y')}")

    # Generate billing records and commissions
    ReferralCommissionService.generate_monthly_billing(billing_month)

    # Update network fee caches for all referrers
    update_referrer_network_fees

    # Re-evaluate pending commissions that might now be eligible
    ReferralCommissionService.process_pending_commissions

    Rails.logger.info("Monthly SaaS billing complete for #{billing_month.strftime('%B %Y')}")
  end

  private

  # Update total_network_fees cache for all referrers
  def update_referrer_network_fees
    # Find all contacts who are referrers (have customers they support)
    referrer_ids = Contact.where(is_saas_customer: true)
                          .where.not(support_contact_id: nil)
                          .distinct
                          .pluck(:support_contact_id)

    Contact.where(id: referrer_ids).find_each do |referrer|
      referrer.update_network_fee_cache!
    end
  end
end
