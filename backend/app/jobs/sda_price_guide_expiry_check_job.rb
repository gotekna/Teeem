class SdaPriceGuideExpiryCheckJob < ApplicationJob
  queue_as :default

  def perform
    guide = SdaPriceGuide.current_guide
    return unless guide

    if guide.valid_to.present?
      days_until_expiry = (guide.valid_to - Date.current).to_i

      if days_until_expiry <= 0
        notify_expired(guide)
      elsif days_until_expiry <= 30
        notify_expiring_soon(guide, days_until_expiry)
      end
    end
  end

  private

  def notify_expired(guide)
    Rails.logger.warn(
      "SDA Price Guide #{guide.financial_year} v#{guide.version} has EXPIRED (#{guide.valid_to}). " \
      "Download latest from: https://www.ndis.gov.au/providers/housing-and-living-supports-and-services/specialist-disability-accommodation/sda-pricing-and-payments"
    )

    # Broadcast to admin users
    ActionCable.server.broadcast("admin_notifications", {
      type: "sda_price_guide_expired",
      message: "SDA Price Guide #{guide.financial_year} has expired. Please download and import the latest version.",
      url: "https://www.ndis.gov.au/providers/housing-and-living-supports-and-services/specialist-disability-accommodation/sda-pricing-and-payments",
      severity: "warning",
    })
  end

  def notify_expiring_soon(guide, days)
    Rails.logger.info(
      "SDA Price Guide #{guide.financial_year} v#{guide.version} expires in #{days} days (#{guide.valid_to})."
    )
  end
end
