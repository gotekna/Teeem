class FetchProductImageJob < ApplicationJob
  queue_as :default

  retry_on StandardError, wait: :exponentially_longer, attempts: 3

  def perform(pricebook_item_id)
    item = PricebookItem.find_by(id: pricebook_item_id)
    return unless item

    # Skip if already has image or currently fetching
    return if item.image_url.present? || item.image_fetch_status == "fetching"

    scraper = ProductImageScraper.new(item)
    result = scraper.fetch_and_upload_image

    Rails.logger.info "Image fetch for item #{item.id}: #{result[:success] ? 'SUCCESS' : 'FAILED'}"
  rescue StandardError => e
    Rails.logger.error "FetchProductImageJob failed for item #{pricebook_item_id}: #{e.message}"
    item&.update(image_fetch_status: "failed")
    raise e
  end
end
