# World-Class Asset Register - Insurance Expiry Check Job
# Checks for expiring and expired insurance policies and creates notifications
class AssetInsuranceExpiryJob < ApplicationJob
  queue_as :low

  # Alert thresholds in days
  EXPIRING_SOON_DAYS = 30
  EXPIRING_VERY_SOON_DAYS = 7

  def perform
    Rails.logger.info "[AssetInsuranceExpiryJob] Starting insurance expiry check"

    results = { expired: 0, expiring_very_soon: 0, expiring_soon: 0 }

    # Find expired insurance
    expired_insurances = AssetInsurance.joins(:asset)
                                        .where("renewal_date < ?", Date.current)
                                        .where(assets: { status: "active" })

    expired_insurances.each do |insurance|
      create_expiry_notification(insurance, :expired)
      results[:expired] += 1
    end

    # Find insurance expiring within 7 days
    expiring_very_soon = AssetInsurance.joins(:asset)
                                        .where(renewal_date: Date.current..(Date.current + EXPIRING_VERY_SOON_DAYS.days))
                                        .where(assets: { status: "active" })

    expiring_very_soon.each do |insurance|
      create_expiry_notification(insurance, :expiring_very_soon)
      results[:expiring_very_soon] += 1
    end

    # Find insurance expiring within 30 days (but not within 7 days)
    expiring_soon = AssetInsurance.joins(:asset)
                                   .where(renewal_date: (Date.current + EXPIRING_VERY_SOON_DAYS.days + 1.day)..(Date.current + EXPIRING_SOON_DAYS.days))
                                   .where(assets: { status: "active" })

    # Only notify weekly for 30-day warnings (to avoid spam)
    if Date.current.wday == 1 # Monday
      expiring_soon.each do |insurance|
        create_expiry_notification(insurance, :expiring_soon)
        results[:expiring_soon] += 1
      end
    end

    Rails.logger.info "[AssetInsuranceExpiryJob] Completed: #{results.inspect}"
    results
  end

  private

  def create_expiry_notification(insurance, severity)
    asset = insurance.asset
    company = asset.corporate_company

    title, message = case severity
    when :expired
      [
        "Insurance Expired: #{asset.display_name}",
        "The insurance policy for #{asset.display_name} (#{insurance.policy_number}) expired on #{insurance.renewal_date.strftime('%d %b %Y')}. Please renew immediately."
      ]
    when :expiring_very_soon
      days = (insurance.renewal_date - Date.current).to_i
      [
        "Insurance Expiring Soon: #{asset.display_name}",
        "The insurance policy for #{asset.display_name} (#{insurance.policy_number}) expires in #{days} days on #{insurance.renewal_date.strftime('%d %b %Y')}."
      ]
    when :expiring_soon
      days = (insurance.renewal_date - Date.current).to_i
      [
        "Insurance Renewal Reminder: #{asset.display_name}",
        "The insurance policy for #{asset.display_name} (#{insurance.policy_number}) expires in #{days} days on #{insurance.renewal_date.strftime('%d %b %Y')}."
      ]
    end

    # Create notification for company admins
    # SSoT: Use user_roles join table to find admins/managers
    if defined?(Notification)
      company.users.joins(:roles).where(roles: { name: %w[admin manager] }).distinct.each do |user|
        Notification.create(
          user: user,
          notification_type: "asset_insurance_expiry",
          title: title,
          message: message,
          data: {
            asset_id: asset.id,
            insurance_id: insurance.id,
            severity: severity,
            renewal_date: insurance.renewal_date
          }
        )
      end
    end

    Rails.logger.info "[AssetInsuranceExpiryJob] #{severity}: #{asset.display_name} (#{insurance.policy_number})"
  rescue => e
    Rails.logger.error "[AssetInsuranceExpiryJob] Failed to create notification: #{e.message}"
  end
end
