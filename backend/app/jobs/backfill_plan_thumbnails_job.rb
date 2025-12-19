# Background job to generate thumbnails for all existing plan revisions
# Run via: BackfillPlanThumbnailsJob.perform_later
#
# Options:
#   force: true - Regenerate ALL thumbnails (including existing ones)
#                 Useful when adding new features like micro_thumbnail_base64
#
# This job is idempotent - it only processes revisions that don't have thumbnails yet.
# Safe to run multiple times or interrupt and resume.
#
class BackfillPlanThumbnailsJob < ApplicationJob
  queue_as :default

  def perform(batch_size: 50, delay_seconds: 2, force: false)
    Rails.logger.info "[BackfillPlanThumbnails] Starting backfill (force=#{force})..."

    # Find all revisions that need thumbnails
    # If force=true, regenerate all thumbnails (for adding micro_thumbnail_base64)
    # Otherwise, only generate for revisions without any thumbnail
    revisions = if force
      JobPlanRevision.where.not(sharepoint_file_id: nil)
    else
      JobPlanRevision
        .where("thumbnail_url IS NULL OR micro_thumbnail_base64 IS NULL")
        .where.not(sharepoint_file_id: nil)
    end

    total = revisions.count
    Rails.logger.info "[BackfillPlanThumbnails] Found #{total} revisions to process"

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
