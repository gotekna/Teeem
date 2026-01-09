# SaaS Pricing Service
# Calculates tiered pricing based on customer turnover
#
# Pricing Model (from CostTab.tsx):
# - First $1M: 2.2% base rate
# - Each $200k after: rate drops by 0.05% (2.15%, 2.10%, 2.05%...)
# - Floor rate: 0.2%
#
# Revenue Distribution:
# - 10% Charity (first 12 months: Joii)
# - 20% Support Line (L1 referrer)
# - 10% Upline Support (L2 referrer)
# - 60% TEEEM
#
class SaasPricingService
  BASE_RATE = 2.2
  FIRST_MILLION = 1_000_000
  BRACKET_SIZE = 200_000
  RATE_DROP = 0.05
  FLOOR_RATE = 0.2

  # Commission rates
  CHARITY_RATE = 0.10
  L1_COMMISSION_RATE = 0.20
  L2_COMMISSION_RATE = 0.10
  TEEEM_RATE = 0.60

  # Eligibility thresholds
  L1_THRESHOLD = 10_000
  L2_THRESHOLD = 50_000

  class << self
    # Calculate annual fee and effective rate for a given turnover
    # @param turnover [Numeric] Annual turnover in dollars
    # @return [Hash] { cost:, effective_rate:, tiers: [] }
    def calculate(turnover)
      turnover = turnover.to_f
      return { cost: 0, effective_rate: 0, tiers: [] } if turnover <= 0

      tiers = []

      # First $1M at base rate
      first_million_amount = [turnover, FIRST_MILLION].min
      first_million_cost = first_million_amount * (BASE_RATE / 100)
      tiers << {
        from: 0,
        to: first_million_amount,
        rate: BASE_RATE,
        amount: first_million_cost.round(2)
      }

      return { cost: first_million_cost.round(2), effective_rate: BASE_RATE, tiers: tiers } if turnover <= FIRST_MILLION

      # Calculate each bracket after $1M
      total_cost = first_million_cost
      remaining = turnover - FIRST_MILLION
      current_threshold = FIRST_MILLION
      bracket_number = 1

      while remaining > 0
        bracket_amount = [remaining, BRACKET_SIZE].min
        bracket_rate = [FLOOR_RATE, BASE_RATE - bracket_number * RATE_DROP].max
        bracket_cost = bracket_amount * (bracket_rate / 100)

        tiers << {
          from: current_threshold,
          to: current_threshold + bracket_amount,
          rate: bracket_rate.round(2),
          amount: bracket_cost.round(2)
        }

        total_cost += bracket_cost
        remaining -= bracket_amount
        current_threshold += bracket_amount
        bracket_number += 1
      end

      effective_rate = (total_cost / turnover * 100).round(4)

      {
        cost: total_cost.round(2),
        effective_rate: effective_rate,
        tiers: tiers
      }
    end

    # Calculate revenue distribution from a fee amount
    # @param fee_amount [Numeric] The calculated fee
    # @param has_l1_referrer [Boolean] Whether customer has L1 support contact
    # @param has_l2_referrer [Boolean] Whether customer has L2 upline contact
    # @return [Hash] Distribution breakdown
    def calculate_distribution(fee_amount, has_l1_referrer: false, has_l2_referrer: false)
      fee = fee_amount.to_f

      {
        charity: (fee * CHARITY_RATE).round(2),
        l1_commission: has_l1_referrer ? (fee * L1_COMMISSION_RATE).round(2) : 0,
        l2_commission: has_l2_referrer ? (fee * L2_COMMISSION_RATE).round(2) : 0,
        teeem: (fee * TEEEM_RATE).round(2),
        # If no referrers, their share goes to TEEEM
        teeem_adjusted: calculate_adjusted_teeem(fee, has_l1_referrer, has_l2_referrer)
      }
    end

    # Calculate TEEEM's share including any unclaimed referral commissions
    def calculate_adjusted_teeem(fee, has_l1_referrer, has_l2_referrer)
      base_teeem = fee * TEEEM_RATE
      base_teeem += fee * L1_COMMISSION_RATE unless has_l1_referrer
      base_teeem += fee * L2_COMMISSION_RATE unless has_l2_referrer
      base_teeem.round(2)
    end

    # Calculate monthly fee from annual turnover
    def monthly_fee(turnover)
      (calculate(turnover)[:cost] / 12).round(2)
    end

    # Get fee summary for display
    def fee_summary(turnover)
      result = calculate(turnover)
      {
        annual_turnover: turnover,
        annual_fee: result[:cost],
        monthly_fee: (result[:cost] / 12).round(2),
        effective_rate: result[:effective_rate],
        tier_count: result[:tiers].length
      }
    end

    # Check if referrer meets L1 eligibility threshold
    def l1_eligible?(total_network_fees)
      total_network_fees >= L1_THRESHOLD
    end

    # Check if referrer meets L2 eligibility threshold
    def l2_eligible?(total_network_fees)
      total_network_fees >= L2_THRESHOLD
    end
  end
end
