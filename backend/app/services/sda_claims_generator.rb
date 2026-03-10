class SdaClaimsGenerator
  def self.call(tenant:, period_start:, period_end:)
    new(tenant).generate_monthly(period_start: period_start, period_end: period_end)
  end

  def initialize(tenant)
    @tenant = tenant
  end

  # Generate draft NDIS claims for all active SDA tenancies in the given period.
  # Idempotent: skips any (property, tenancy, period) combination that already has a claim.
  #
  # Returns the array of newly created NdisClaim records.
  def generate_monthly(period_start:, period_end:)
    claims = []

    active_sda_tenancies.each do |tenancy|
      property = tenancy.property
      next unless property.sda_enrolled?

      # Skip if claim already exists for this period
      next if NdisClaim.exists?(
        tenant_id: @tenant.id,
        property_id: property.id,
        tenancy_id: tenancy.id,
        claim_period_start: period_start,
        claim_period_end: period_end
      )

      # Prefer price guide rate; fall back to tenancy weekly rate converted to daily
      price_guide = NdisPriceGuide.rate_for(
        design_category: property.sda_category,
        resident_count: property.sda_max_residents || 1,
        date: period_start
      )

      daily_rate = price_guide&.daily_rate || (tenancy.sda_weekly_rate.to_f / 7)
      days = (period_end - period_start).to_i + 1
      total = (daily_rate * days).round(2)
      gst = (total * 0.1).round(2)

      claim = NdisClaim.create!(
        tenant_id: @tenant.id,
        property: property,
        tenancy: tenancy,
        contact: tenancy.sda_participant_contact,
        ndis_participant_number: tenancy.sda_plan_number,
        claim_period_start: period_start,
        claim_period_end: period_end,
        support_item_number: price_guide&.support_item_number,
        quantity: days,
        unit_price: daily_rate,
        total_amount: total,
        gst_amount: gst,
        status: "draft"
      )

      claims << claim
    end

    claims
  end

  private

  def active_sda_tenancies
    Tenancy
      .where(tenant_id: @tenant.id, tenancy_type: "sda", status: "active")
      .includes(:property, :sda_participant_contact)
  end
end
