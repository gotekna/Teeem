# frozen_string_literal: true

# Downloads an image from a URL and creates a StorageBlob for a PricebookItem.
# Used by update_image endpoint to async create blob storage after manual URL set.
# Idempotent: skips if item already has a blob linked.
class CreatePricebookImageBlobJob < ApplicationJob
  queue_as :default

  retry_on StandardError, wait: :exponentially_longer, attempts: 3

  def perform(pricebook_item_id, image_url)
    item = PricebookItem.find_by(id: pricebook_item_id)
    return unless item

    # Idempotent: skip if blob already linked
    return if item.image_storage_blob_id.present?
    return if image_url.blank?

    response = HTTParty.get(
      image_url,
      follow_redirects: true,
      timeout: 30,
      headers: { "User-Agent" => "TEEEM/1.0" }
    )

    unless response.success?
      Rails.logger.warn "[CreatePricebookImageBlobJob] HTTP #{response.code} for item #{item.id}"
      return
    end

    content = response.body.force_encoding(Encoding::ASCII_8BIT)

    # Detect content type from response or URL extension
    content_type = response.content_type&.split(";")&.first
    ext = File.extname(URI.parse(image_url).path).downcase rescue ".jpg"
    content_type ||= case ext
    when ".jpg", ".jpeg" then "image/jpeg"
    when ".png" then "image/png"
    when ".gif" then "image/gif"
    when ".webp" then "image/webp"
    else "image/jpeg"
    end

    filename = "#{item.item_code}#{ext.presence || '.jpg'}"

    blob = StorageBlob.find_or_create_for_content!(
      content,
      filename: filename,
      content_type: content_type
    )

    item.update!(image_storage_blob_id: blob.id, image_source: "blob")

    Rails.logger.info "[CreatePricebookImageBlobJob] Linked item #{item.id} (#{item.item_code}) → blob #{blob.id}"
  rescue StandardError => e
    Rails.logger.error "[CreatePricebookImageBlobJob] Failed for item #{pricebook_item_id}: #{e.message}"
    raise e
  end
end
