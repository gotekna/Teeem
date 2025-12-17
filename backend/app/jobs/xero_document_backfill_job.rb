# One-time job to backfill sharepoint_file_id for existing Xero documents
# These documents were uploaded to SharePoint before v423, so they exist on SharePoint
# but don't have their sharepoint_file_id tracked in the database
class XeroDocumentBackfillJob < ApplicationJob
  queue_as :low

  # Run with: XeroDocumentBackfillJob.perform_now(limit: 100, dry_run: true)
  def perform(limit: nil, dry_run: false)
    start_time = Time.current
    stats = {
      total_processed: 0,
      found_on_sharepoint: 0,
      not_found: 0,
      already_has_id: 0,
      errors: 0
    }

    Rails.logger.info("[XeroDocumentBackfill] Starting backfill job (dry_run: #{dry_run}, limit: #{limit})")

    # Find documents that need backfilling
    scope = CorporateCompanyDocument
      .where(source: "xero")
      .where(sharepoint_file_id: nil)
      .where.not(expected_onedrive_path: nil)
      .order(created_at: :desc)

    scope = scope.limit(limit) if limit.present?

    total_count = scope.count
    Rails.logger.info("[XeroDocumentBackfill] Found #{total_count} documents to process")

    return if total_count.zero?

    # Get SharePoint client
    credential = OrganizationOneDriveCredential.active_credential
    unless credential
      Rails.logger.error("[XeroDocumentBackfill] No active OneDrive credential found")
      return
    end

    graph_client = MicrosoftGraphClient.new(credential)

    scope.find_each.with_index do |doc, index|
      stats[:total_processed] += 1

      begin
        # Try to find the file on SharePoint by path
        file_info = find_file_on_sharepoint(graph_client, doc)

        if file_info && file_info[:id]
          stats[:found_on_sharepoint] += 1

          if dry_run
            Rails.logger.info("[XeroDocumentBackfill] [DRY RUN] Would update document #{doc.id} (#{doc.title}) with OneDrive ID: #{file_info[:id]}")
          else
            doc.update!(sharepoint_file_id: file_info[:id])
            Rails.logger.info("[XeroDocumentBackfill] Updated document #{doc.id} (#{doc.title}) with OneDrive ID: #{file_info[:id]}")
          end
        else
          stats[:not_found] += 1
          Rails.logger.warn("[XeroDocumentBackfill] File not found on SharePoint: #{doc.expected_onedrive_path}")
        end

        # Progress logging every 10 documents
        if (index + 1) % 10 == 0
          Rails.logger.info("[XeroDocumentBackfill] Progress: #{index + 1}/#{total_count} (#{stats[:found_on_sharepoint]} found)")
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

  def find_file_on_sharepoint(graph_client, document)
    # The expected_onedrive_path is like: "Contacts/1497 - Southern Star Windows/BILLS/1497-PO-000100.pdf"
    # We need to search for this file in SharePoint

    # Strategy: Use the expected path to find the file
    # Split path into folder path + filename
    path_parts = document.expected_onedrive_path.split("/")
    filename = path_parts.last
    folder_path = path_parts[0..-2].join("/")

    # Try to find the folder first
    begin
      # Navigate to the folder
      settings = CorporateCompanySetting.instance
      base_folder_name = settings.contact_documents_path || "Contacts"

      # Start from base folder
      current_folder = graph_client.find_folder_in_drive_root(base_folder_name)
      return nil unless current_folder

      # Navigate through subfolders
      path_parts[1..-2].each do |folder_name|
        items = graph_client.list_folder_contents(current_folder[:id])
        current_folder = items.find { |item| item[:name] == folder_name && item[:folder] }
        return nil unless current_folder
      end

      # Now search for the file in the current folder
      items = graph_client.list_folder_contents(current_folder[:id])
      file = items.find { |item| item[:name] == filename && !item[:folder] }

      file
    rescue MicrosoftGraphClient::APIError => e
      Rails.logger.warn("[XeroDocumentBackfill] SharePoint API error for #{document.expected_onedrive_path}: #{e.message}")
      nil
    rescue StandardError => e
      Rails.logger.error("[XeroDocumentBackfill] Unexpected error finding file: #{e.message}")
      nil
    end
  end
end
