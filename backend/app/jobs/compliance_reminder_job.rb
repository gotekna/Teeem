class ComplianceReminderJob < ApplicationJob
  queue_as :default

  # ⚠️ FRC (Feb 2026): Must iterate over tenants
  # Root cause: ComplianceReminderService queries CorporateComplianceItem which has
  # acts_as_tenant. Without tenant context, sends cross-tenant compliance reminders.
  def perform
    Rails.logger.info("Starting daily compliance reminder check...")

    total_sent = 0

    Tenant.find_each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        service = ComplianceReminderService.new
        result = service.send_reminders

        if result[:success]
          total_sent += (result[:reminders_sent] || 0)
        else
          Rails.logger.error("Compliance reminders failed for #{tenant.name}: #{result[:error]}")
        end
      end
    end

    Rails.logger.info("Compliance reminders completed: #{total_sent} reminders sent")
  rescue StandardError => e
    Rails.logger.error("Compliance reminder job failed: #{e.message}")
    raise
  end
end
