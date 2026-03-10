# SDA Payment Calculator
#
# Calculates participant rent contribution and NDIA balance for
# Specialist Disability Accommodation tenancies.
#
# The Maximum Reasonable Rent Contribution (MRRC) is:
#   25% of base Disability Support Pension (DSP) + 100% of Commonwealth Rent Assistance (CRA)
#
# NDIA pays the balance up to the SDA price limit for the dwelling category.
#
# Rates are updated annually by the Australian Government.
# See: https://www.ndis.gov.au/providers/housing-and-living-supports-and-services/specialist-disability-accommodation

class SdaPaymentCalculator
  # 2026 DSP and CRA rates (update annually when government publishes new rates)
  # These are weekly amounts
  DSP_BASE_WEEKLY = BigDecimal("590.60") # Base DSP single, per fortnight / 2
  CRA_MAX_WEEKLY = BigDecimal("139.60")  # Maximum CRA weekly rate

  # MRRC = 25% DSP + 100% CRA
  MRRC_DSP_PERCENTAGE = BigDecimal("0.25")

  # SDA price limits by category and building type (weekly, 2025-26 price guide)
  # These vary by location group - using Group 1 (Major Cities) as default
  # Real implementation should look up from a config table
  SDA_PRICE_LIMITS = {
    "improved_liveability" => {
      "new_build" => BigDecimal("306.57"),
      "existing"  => BigDecimal("219.01")
    },
    "fully_accessible" => {
      "new_build" => BigDecimal("435.63"),
      "existing"  => BigDecimal("311.25")
    },
    "robust" => {
      "new_build" => BigDecimal("472.43"),
      "existing"  => BigDecimal("337.57")
    },
    "high_physical_support" => {
      "new_build" => BigDecimal("603.31"),
      "existing"  => BigDecimal("430.93")
    }
  }.freeze

  attr_reader :tenancy

  def initialize(tenancy)
    @tenancy = tenancy
  end

  # Calculate the maximum participant contribution (MRRC)
  def max_participant_contribution
    dsp_component = DSP_BASE_WEEKLY * MRRC_DSP_PERCENTAGE
    dsp_component + CRA_MAX_WEEKLY
  end

  # Calculate actual participant contribution (capped at MRRC and rent)
  def participant_contribution
    mrrc = max_participant_contribution
    weekly_rate = tenancy.sda_weekly_rate || BigDecimal("0")

    # Participant pays the lesser of MRRC or the full SDA rate
    [mrrc, weekly_rate].min
  end

  # Calculate NDIA balance payment
  def ndia_payment
    weekly_rate = tenancy.sda_weekly_rate || BigDecimal("0")
    [weekly_rate - participant_contribution, BigDecimal("0")].max
  end

  # Return full breakdown
  def calculate
    {
      sda_weekly_rate: tenancy.sda_weekly_rate,
      sda_category: tenancy.property&.sda_category,
      dsp_base_weekly: DSP_BASE_WEEKLY,
      cra_max_weekly: CRA_MAX_WEEKLY,
      max_participant_contribution: max_participant_contribution,
      participant_contribution: participant_contribution,
      ndia_payment: ndia_payment,
      annual_ndia_payment: ndia_payment * 52,
      quarterly_ndia_payment: ndia_payment * 13
    }
  end

  # Update tenancy with calculated amounts
  def apply!
    tenancy.update!(
      participant_rent_contribution: participant_contribution,
      ndia_payment_amount: ndia_payment
    )
  end

  # Class method for convenience
  def self.calculate_for(tenancy)
    new(tenancy).calculate
  end

  # Look up the SDA price limit for a given category and building type
  def self.price_limit(category, building_type = "new_build")
    SDA_PRICE_LIMITS.dig(category, building_type) || BigDecimal("0")
  end
end
