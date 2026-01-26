# Background job to generate PDF thumbnail for a plan revision
# Called automatically after plan upload or manually for regeneration
#
# Usage:
#   GeneratePlanThumbnailJob.perform_later(revision_id)
#
class GeneratePlanThumbnailJob < ApplicationJob
  queue_as :default

  # Don't retry too aggressively - thumbnails aren't critical
  retry_on StandardError, wait: 5.minutes, attempts: 2

  def perform(revision_id, force: false)
    revision = JobPlanRevision.find_by(id: revision_id)

    unless revision
      Rails.logger.warn "[GeneratePlanThumbnail] Revision ##{revision_id} not found, skipping"
      return
    end

    # Skip if BOTH thumbnails already exist (unless force regeneration)
    # We need both thumbnail_url (full) AND micro_thumbnail_base64 (instant preview)
    if revision.thumbnail_url.present? && revision.micro_thumbnail_base64.present? && !force
      Rails.logger.info "[GeneratePlanThumbnail] Revision ##{revision_id} already has both thumbnails, skipping"
      return
    end

    # Skip if no SharePoint file
    unless revision.storage_reference.present?
      Rails.logger.info "[GeneratePlanThumbnail] Revision ##{revision_id} has no SharePoint file, skipping"
      return
    end

    # Generate thumbnail
    PdfThumbnailService.new(revision).generate!

    Rails.logger.info "[GeneratePlanThumbnail] Successfully generated thumbnail for revision ##{revision_id}"
  rescue PdfThumbnailService::ThumbnailError => e
    Rails.logger.error "[GeneratePlanThumbnail] Failed for revision ##{revision_id}: #{e.message}"
    # Don't re-raise - let it fail gracefully
  rescue ActiveRecord::RecordNotFound => e
    Rails.logger.warn "[GeneratePlanThumbnail] Record not found: #{e.message}"
  end
end
