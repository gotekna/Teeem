# frozen_string_literal: true

# One-time job to backfill storage_file_id for existing Xero documents
# These documents were uploaded to storage before tracking, so they exist
# but don't have their file ID tracked in the database
#
# ╔═══════════════════════════════════════════════════════════════════╗
# ║  SSoT: Uses DocumentProviderAware for storage abstraction         ║
# ║  Searches Wasabi, SharePoint, or S3 based on StorageConfiguration ║
# ╚═══════════════════════════════════════════════════════════════════╝
#
class XeroDocumentBackfillJob < ApplicationJob
  include DocumentProviderAware

  queue_as :low

  # Run with: XeroDocumentBackfillJob.perform_now(limit: 100, dry_run: true)
  def perform(limit: nil, dry_run: false)
    start_time = Time.current
    stats = {
      total_processed: 0,
      found_on_storage: 0,
      not_found: 0,
      already_has_id: 0,
      errors: 0,
      provider: nil
    }

    Rails.logger.info("[XeroDocumentBackfill] Starting backfill job (dry_run: #{dry_run}, limit: #{limit})")

    # SSoT: Setup document provider using StorageConfiguration
    begin
      setup_default_provider!
      stats[:provider] = current_provider_type.to_s
    rescue DocumentProviders::NotConnectedError => e
      Rails.logger.error("[XeroDocumentBackfill] No storage provider configured: #{e.message}")
      return stats
    end

    # Find documents that need backfilling
    scope = CorporateCompanyDocument
      .where(source: "xero")
      .where(storage_file_id: nil)
      .where.not(expected_storage_path: nil)
      .order(created_at: :desc)

    scope = scope.limit(limit) if limit.present?

    total_count = scope.count
    Rails.logger.info("[XeroDocumentBackfill] Found #{total_count} documents to process (provider: #{stats[:provider]})")

    return stats if total_count.zero?

    # SSoT: Get contacts folder path from StorageConfiguration
    base_folder_name = scope_folder_path(:contact)

    scope.find_each.with_index do |doc, index|
      stats[:total_processed] += 1

      begin
        # Try to find the file on storage by path
        file_info = find_file_on_storage(doc, base_folder_name)

        if file_info && file_info[:id]
          stats[:found_on_storage] += 1

          if dry_run
            Rails.logger.info("[XeroDocumentBackfill] [DRY RUN] Would update document #{doc.id} (#{doc.title}) with file ID: #{file_info[:id]}")
          else
            doc.update!(storage_file_id: file_info[:id])
            Rails.logger.info("[XeroDocumentBackfill] Updated document #{doc.id} (#{doc.title}) with file ID: #{file_info[:id]}")
          end
        else
          stats[:not_found] += 1
          Rails.logger.warn("[XeroDocumentBackfill] File not found on storage: #{doc.expected_storage_path}")
        end

        # Progress logging every 10 documents
        if (index + 1) % 10 == 0
          Rails.logger.info("[XeroDocumentBackfill] Progress: #{index + 1}/#{total_count} (#{stats[:found_on_storage]} found)")
        end

      rescue StandardError => e
        stats[:errors] += 1
        Rails.logger.error("[XeroDocumentBackfill] Error processing document #{doc.id}: #{e.message}")
        Rails.logger.error(e.backtrace.first(5).join("\n"))
      end
    end

    elapsed = (Time.current - start_time).round(2)

    Rails.logger.info("[XeroDocumentBackfill] Complete! Stats: #{stats.to_json}")
    Rails.logger.info("[XeroDocumentBackfill] Time elapsed: #{elapsed}s (#{(elapsed / 60).round(2)} minutes)")

    stats
  end

  private

  def find_file_on_storage(document, base_folder_name)
    # The expected_storage_path is like: "Contacts/1497 - Southern Star Windows/BILLS/1497-PO-000100.pdf"
    # We need to search for this file in storage

    # Split path into folder path + filename
    path_parts = document.expected_storage_path.split("/")
    filename = path_parts.last
    folder_path = path_parts[1..-2].join("/")  # Skip "Contacts" prefix

    # Build the full folder path
    full_folder_path = "/#{base_folder_name}/#{folder_path}"

    begin
      # List folder contents and find the file
      items = list_folder_in_provider(full_folder_path)
      file = items.find { |item| item[:name] == filename && item[:type] == :file }
      file
    rescue DocumentProviders::NotFoundError
      Rails.logger.debug("[XeroDocumentBackfill] Folder not found: #{full_folder_path}")
      nil
    rescue DocumentProviders::Error => e
      Rails.logger.warn("[XeroDocumentBackfill] Storage error for #{document.expected_storage_path}: #{e.message}")
      nil
    rescue StandardError => e
      Rails.logger.error("[XeroDocumentBackfill] Unexpected error finding file: #{e.message}")
      nil
    end
  end
end
