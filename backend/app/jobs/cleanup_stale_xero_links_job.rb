class CleanupStaleXeroLinksJob < ApplicationJob
  queue_as :default

  # Remove external links marked as stale for more than 7 days
  STALE_THRESHOLD_DAYS = 7

  def perform
    Rails.logger.info("Starting cleanup of stale Xero links older than #{STALE_THRESHOLD_DAYS} days")

    stale_cutoff = STALE_THRESHOLD_DAYS.days.ago

    # Find links marked as stale (archived, deleted, not_found) for 7+ days
    stale_links = ContactExternalLink
      .stale_status
      .where("updated_at < ?", stale_cutoff)

    total_count = stale_links.count
    deleted_count = 0
    error_count = 0

    Rails.logger.info("Found #{total_count} stale links to clean up")

    stale_links.find_each do |link|
      begin
        contact = link.contact
        contact_name = contact&.display_name || "Unknown"

        Rails.logger.info(
          "Deleting stale link: Contact ##{link.contact_id} (#{contact_name}) -> " \
          "Xero #{link.external_contact_id} | Status: #{link.xero_contact_status} | " \
          "Last updated: #{link.updated_at}"
        )

        link.destroy!
        deleted_count += 1
      rescue StandardError => e
        error_count += 1
        Rails.logger.error(
          "Failed to delete stale link #{link.id}: #{e.message}\n#{e.backtrace.first(5).join("\n")}"
        )
      end
    end

    Rails.logger.info(
      "Cleanup complete: #{deleted_count}/#{total_count} deleted, #{error_count} errors"
    )

    {
      success: error_count == 0,
      total: total_count,
      deleted: deleted_count,
      errors: error_count
    }
  end
end
