# Backfill job for existing email_warehouse records
# Populates new SSoT fields: direction, ssot_owner_id, body_preview
class BackfillEmailSsotJob < ApplicationJob
  queue_as :default

  def perform(options = {})
    batch_size = options[:batch_size] || 500
    skip_if_populated = options[:skip_if_populated] != false

    processed_count = 0
    skipped_count = 0
    error_count = 0

    Rails.logger.info "[BackfillEmailSsot] Starting backfill..."

    # Process in batches to avoid memory issues
    EmailWarehouse.find_in_batches(batch_size: batch_size) do |batch|
      batch.each do |email|
        result = backfill_email(email, skip_if_populated: skip_if_populated)
        case result
        when :processed
          processed_count += 1
        when :skipped
          skipped_count += 1
        when :error
          error_count += 1
        end
      end

      Rails.logger.info "[BackfillEmailSsot] Progress: #{processed_count + skipped_count + error_count} emails processed..."
    end

    Rails.logger.info "[BackfillEmailSsot] Completed: #{processed_count} processed, #{skipped_count} skipped, #{error_count} errors"

    {
      processed: processed_count,
      skipped: skipped_count,
      errors: error_count
    }
  end

  private

  def backfill_email(email, skip_if_populated:)
    # Skip if already populated and flag is set
    has_direction = email.respond_to?(:direction) && email.direction.present?
    if skip_if_populated && has_direction && email.body_preview.present?
      return :skipped
    end

    updates = {}

    # Set direction based on folder_name (if column exists)
    if email.respond_to?(:direction) && email.direction.blank?
      updates[:direction] = determine_direction(email)
    end

    # Set SSoT owner (synced_by_user for now, will be refined later)
    if email.ssot_owner_id.blank? && email.synced_by_user_id.present?
      updates[:ssot_owner_id] = email.synced_by_user_id
    end

    # Generate body preview
    if email.body_preview.blank? && email.body_text.present?
      updates[:body_preview] = generate_preview(email.body_text)
    end

    return :skipped if updates.empty?

    email.update!(updates)
    :processed
  rescue StandardError => e
    Rails.logger.error "[BackfillEmailSsot] Error processing email #{email.id}: #{e.message}"
    :error
  end

  def determine_direction(email)
    folder_name = email.folder_name.to_s.downcase

    if folder_name.include?("sent")
      "sent"
    elsif folder_name.include?("draft")
      "sent"  # Drafts are outgoing
    else
      "received"  # Default to received for inbox, archive, etc.
    end
  end

  def generate_preview(body_text)
    return nil if body_text.blank?

    body_text.to_s
      .gsub(/\s+/, " ")  # Normalize whitespace
      .strip
      .truncate(500)
  end
end
