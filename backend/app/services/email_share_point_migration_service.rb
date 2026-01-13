# frozen_string_literal: true

# EmailSharePointMigrationService - Migrate .eml files from SharePoint to Wasabi
#
# Handles emails that have sharepoint_email_file_id but files still in SharePoint.
# Fixes case mismatches (emails/eml vs Emails/eml) automatically.
#
# IMPORTANT: This service uses the TEEEM SharePoint site's Documents drive.
# The email files are stored at: gotekna.sharepoint.com/sites/TEEEM/Shared Documents/Emails/eml/
#
# Usage:
#   service = EmailSharePointMigrationService.new
#   result = service.migrate_emails(batch_size: 100)
#   # => { migrated: 50, skipped: 10, errors: [] }
#
class EmailSharePointMigrationService # rubocop:disable Naming/ClassAndModuleCamelCase
  # TEEEM SharePoint site ID (discovered via Graph API)
  TEEEM_SITE_ID = "gotekna.sharepoint.com,d551d458-8c0e-4e22-98b0-434ba9b0e85d,5892a9c8-67f7-4d87-92ca-b1c9a6dd327c"

  attr_reader :stats

  def initialize(progress: nil)
    @stats = { migrated: 0, skipped: 0, errors: [], total: 0 }
    @stats_mutex = Mutex.new
    @progress = progress
  end

  def migrate_emails(batch_size: nil)
    # Find emails that have SharePoint file IDs but not Wasabi paths
    # Wasabi paths start with /Emails/ (uppercase, leading slash)
    # SharePoint paths are like emails/eml/... (lowercase, no leading slash)
    emails = EmailWarehouse
      .where("sharepoint_email_file_id IS NOT NULL AND sharepoint_email_file_id != ''")
      .where("sharepoint_email_file_id NOT LIKE '/%'")  # Exclude Wasabi paths (start with /)
      .where("sharepoint_email_file_id NOT LIKE 'Emails/%'")  # Exclude Wasabi paths
      .where("storage_path IS NULL OR storage_path NOT LIKE '/Emails/%'")  # Not yet in Wasabi
      .order(:id)

    emails = emails.limit(batch_size) if batch_size.present?

    @stats[:total] = emails.count
    @progress&.set_total!(@stats[:total])

    Rails.logger.info "[SharePointMigration] Starting migration of #{@stats[:total]} emails"

    return @stats if @stats[:total] == 0

    # Get providers
    @sharepoint_provider = get_sharepoint_provider
    @wasabi_provider = get_wasabi_provider

    unless @sharepoint_provider && @wasabi_provider
      message = "Missing provider: SharePoint=#{@sharepoint_provider.present?}, Wasabi=#{@wasabi_provider.present?}"
      Rails.logger.error "[SharePointMigration] #{message}"
      return { success: false, error: message, stats: @stats }
    end

    # Process sequentially (SharePoint has rate limits)
    emails.find_each.with_index do |email, index|
      migrate_single_email(email)

      if (index + 1) % 50 == 0
        Rails.logger.info "[SharePointMigration] Progress: #{index + 1}/#{@stats[:total]}"
        @progress&.update!(processed_count: index + 1)
      end
    end

    @progress&.complete!(message: "Migrated #{@stats[:migrated]}, skipped #{@stats[:skipped]}, errors #{@stats[:errors].count}")
    Rails.logger.info "[SharePointMigration] Completed: #{@stats}"
    @stats
  rescue StandardError => e
    Rails.logger.error "[SharePointMigration] Error: #{e.message}"
    @progress&.fail!(message: e.message)
    { success: false, error: e.message, stats: @stats }
  end

  private

  def get_sharepoint_provider
    cred = MicrosoftCredential.sharepoint_credential
    return nil unless cred

    # Verify StorageConfiguration has drive_id (SSoT)
    storage_config = StorageConfiguration.instance
    unless storage_config&.drive_id.present?
      Rails.logger.error "[SharePointMigration] StorageConfiguration missing drive_id"
      return nil
    end

    provider = DocumentProviders::SharePoint.new(cred)
    Rails.logger.info "[SharePointMigration] Using drive: #{storage_config.drive_name} (#{storage_config.drive_id})"

    provider
  rescue => e
    Rails.logger.error "[SharePointMigration] Failed to get SharePoint provider: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
    nil
  end

  def get_wasabi_provider
    cred = S3CompatibleCredential.active.first
    return nil unless cred

    DocumentProviders::S3Compatible.new(cred)
  rescue => e
    Rails.logger.error "[SharePointMigration] Failed to get Wasabi provider: #{e.message}"
    nil
  end

  def migrate_single_email(email)
    # Skip if already has Wasabi path
    if email.storage_path&.start_with?("/Emails/")
      increment_skipped!
      return
    end

    # Try to download from SharePoint
    content = download_from_sharepoint(email)

    unless content
      add_error!(email_id: email.id, error: "Could not download from SharePoint")
      return
    end

    # Upload to Wasabi
    wasabi_path = upload_to_wasabi(email, content)

    unless wasabi_path
      add_error!(email_id: email.id, error: "Could not upload to Wasabi")
      return
    end

    # Update record
    email.update!(
      storage_path: wasabi_path[:path],
      storage_file_id: wasabi_path[:id]
    )

    increment_migrated!
    Rails.logger.info "[SharePointMigration] Email #{email.id} migrated to #{wasabi_path[:path]}"
  rescue StandardError => e
    add_error!(email_id: email.id, error: e.message)
    Rails.logger.error "[SharePointMigration] Error migrating email #{email.id}: #{e.message}"
  end

  def download_from_sharepoint(email)
    file_id = email.sharepoint_email_file_id
    path = email.sharepoint_email_path

    # First try by file ID if it looks like a real ID (not a path)
    if file_id.present? && !file_id.include?("/")
      begin
        content = @sharepoint_provider.download_file(file_id)
        return content if content.present?
      rescue => e
        Rails.logger.warn "[SharePointMigration] Download by ID failed for #{email.id}: #{e.message}"
      end
    end

    # Fall back to path-based download with case correction
    if path.present?
      # Try original path
      begin
        content = @sharepoint_provider.download_file(path)
        return content if content.present?
      rescue => e
        Rails.logger.debug "[SharePointMigration] Original path failed: #{path}"
      end

      # Try with case corrections
      path_variations = generate_path_variations(path)
      path_variations.each do |variation|
        begin
          content = @sharepoint_provider.download_file(variation)
          return content if content.present?
        rescue => e
          Rails.logger.debug "[SharePointMigration] Path variation failed: #{variation}"
        end
      end
    end

    nil
  end

  def generate_path_variations(path)
    variations = []

    # emails/eml/... -> Emails/eml/...
    if path.start_with?("emails/")
      variations << path.sub(/^emails/, "Emails")
    end

    # Add /Shared Documents/ prefix if missing
    unless path.start_with?("/") || path.start_with?("Shared Documents")
      variations << "Shared Documents/#{path}"
      variations << "/Shared Documents/#{path}"

      # Also try with case correction + prefix
      if path.start_with?("emails/")
        corrected = path.sub(/^emails/, "Emails")
        variations << "Shared Documents/#{corrected}"
        variations << "/Shared Documents/#{corrected}"
      end
    end

    variations.uniq
  end

  def upload_to_wasabi(email, content)
    year = email.received_at&.year || email.created_at.year
    month = (email.received_at || email.created_at).strftime("%m")
    folder_path = "Emails/eml/#{year}/#{month}"
    filename = "#{email.id}.eml"

    @wasabi_provider.upload_file(folder_path, content, filename, content_type: "message/rfc822")
  end

  def increment_migrated!
    @stats_mutex.synchronize { @stats[:migrated] += 1 }
    @progress&.increment!(success: true)
  end

  def increment_skipped!
    @stats_mutex.synchronize { @stats[:skipped] += 1 }
    @progress&.increment!(success: true)
  end

  def add_error!(error_hash)
    @stats_mutex.synchronize { @stats[:errors] << error_hash }
    @progress&.increment!(success: false, error: error_hash[:error])
  end
end
