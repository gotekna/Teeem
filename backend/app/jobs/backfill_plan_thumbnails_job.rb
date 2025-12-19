# Background job to generate thumbnails for all existing plan revisions
# Run via: BackfillPlanThumbnailsJob.perform_later
#
# This job is idempotent - it only processes revisions that don't have thumbnails yet.
# Safe to run multiple times or interrupt and resume.
#
class BackfillPlanThumbnailsJob < ApplicationJob
  queue_as :default

  def perform(batch_size: 50, delay_seconds: 2)
    Rails.logger.info "[BackfillPlanThumbnails] Starting backfill..."

    # Find all revisions that need thumbnails
    revisions = JobPlanRevision
      .where(thumbnail_url: nil)
      .where.not(sharepoint_file_id: nil)

    total = revisions.count
    Rails.logger.info "[BackfillPlanThumbnails] Found #{total} revisions without thumbnails"

    if total.zero?
      Rails.logger.info "[BackfillPlanThumbnails] Nothing to backfill, done!"
      return
    end

    # Queue thumbnail generation for each revision
    # Stagger jobs to avoid overwhelming SharePoint API
    revisions.find_each(batch_size: batch_size).with_index do |revision, index|
      delay = (index * delay_seconds).seconds
      GeneratePlanThumbnailJob.set(wait: delay).perform_later(revision.id)
    end

    Rails.logger.info "[BackfillPlanThumbnails] Queued #{total} thumbnail generation jobs"
  end
end
