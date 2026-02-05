# frozen_string_literal: true

# DocsortClassificationJob - Background classification for DocSort items
#
# Runs DocumentClassificationService and optionally auto-routes high confidence items
#
class DocsortClassificationJob < ApplicationJob
  queue_as :default

  # Retry on transient errors
  retry_on StandardError, wait: :polynomially_longer, attempts: 3

  # Don't retry if record not found (deleted before processing)
  discard_on ActiveRecord::RecordNotFound

  def perform(docsort_item_id, auto_route: true)
    item = DocsortItem.find(docsort_item_id)

    # Skip if already classified or processing
    return if item.status.in?(%w[classified processing completed error])

    # Set tenant context for multi-tenancy
    ActsAsTenant.with_tenant(item.tenant) do
      # Run classification
      result = item.classify!

      Rails.logger.info "[DocsortClassificationJob] Classified #{item.id}: " \
                        "#{result[:document_type]} (#{(result[:confidence] * 100).round}%)"

      # Auto-route high confidence classifications
      if auto_route && item.can_auto_route?
        item.route!
        Rails.logger.info "[DocsortClassificationJob] Auto-routed #{item.id} to #{item.routed_to_type}"
      end
    end
  rescue StandardError => e
    Rails.logger.error "[DocsortClassificationJob] Failed for #{docsort_item_id}: #{e.message}"
    raise # Re-raise for retry logic
  end
end
