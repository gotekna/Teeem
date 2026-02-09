# frozen_string_literal: true

# EmailMigrationService - Orchestrates email migration from O365 to PolarisMail
#
# Coordinates the full migration process:
# 1. Discover O365 mailboxes via Microsoft Graph
# 2. Create matching mailboxes in PolarisMail
# 3. Initiate content migration (emails, calendar, contacts)
# 4. Track progress and handle errors
#
# Usage:
#   service = EmailMigrationService.new(email_subscription)
#   service.discover_source_mailboxes  # Get list from O365
#   service.start_migration(mailbox)   # Migrate a specific mailbox
#
class EmailMigrationService
  class MigrationError < StandardError; end

  attr_reader :subscription, :polaris_service

  def initialize(email_subscription)
    @subscription = email_subscription
    @polaris_service = PolarisMailService.new
    @microsoft_credential = find_microsoft_credential
  end

  # ====================
  # DISCOVERY
  # ====================

  # Discover mailboxes from O365 tenant
  # @return [Array<Hash>] List of mailboxes with details
  def discover_source_mailboxes
    raise MigrationError, "Microsoft 365 not connected" unless @microsoft_credential

    client = MicrosoftAppGraphClient.for_credential(@microsoft_credential)
    mailboxes = []

    # Get all users with mailboxes
    users = client.list_users
    users.each do |user|
      next unless user["mail"].present?

      mailboxes << {
        email: user["mail"],
        display_name: user["displayName"],
        type: "user",
        user_principal_name: user["userPrincipalName"],
        id: user["id"]
      }
    end

    # Get shared mailboxes
    shared = client.list_shared_mailboxes rescue []
    shared.each do |mb|
      mailboxes << {
        email: mb["mail"],
        display_name: mb["displayName"],
        type: "shared",
        id: mb["id"]
      }
    end

    # Get resource mailboxes (rooms, equipment)
    resources = client.list_rooms rescue []
    resources.each do |room|
      mailboxes << {
        email: room["emailAddress"],
        display_name: room["displayName"],
        type: "resource",
        id: room["id"]
      }
    end

    mailboxes
  rescue StandardError => e
    Rails.logger.error "[EmailMigrationService] Discovery failed: #{e.message}"
    raise MigrationError, "Failed to discover mailboxes: #{e.message}"
  end

  # Get mailbox statistics from O365
  # @param email [String] Email address
  # @return [Hash] Statistics (message count, size, etc.)
  def get_source_mailbox_stats(email)
    raise MigrationError, "Microsoft 365 not connected" unless @microsoft_credential

    client = MicrosoftAppGraphClient.for_credential(@microsoft_credential)
    stats = client.get_mailbox_statistics(email)

    {
      message_count: stats["itemCount"] || 0,
      size_bytes: stats["storageUsedInBytes"] || 0,
      size_gb: ((stats["storageUsedInBytes"] || 0) / 1_073_741_824.0).round(2),
      folder_count: stats["folderCount"] || 0
    }
  rescue StandardError => e
    Rails.logger.warn "[EmailMigrationService] Stats failed for #{email}: #{e.message}"
    { message_count: 0, size_bytes: 0, size_gb: 0, folder_count: 0 }
  end

  # ====================
  # MIGRATION EXECUTION
  # ====================

  # Start migration for a mailbox
  # @param email_mailbox [EmailMailbox] The mailbox to migrate
  # @param options [Hash] Migration options
  # @return [EmailMigration] The migration job record
  def start_migration(email_mailbox, options: {})
    # Ensure mailbox is provisioned in PolarisMail
    unless email_mailbox.polaris_mailbox_id.present?
      raise MigrationError, "Mailbox not provisioned in PolarisMail"
    end

    # Create migration record
    migration = EmailMigration.create!(
      email_subscription: subscription,
      email_mailbox: email_mailbox,
      microsoft_credential: @microsoft_credential,
      migration_type: options[:type] || "full_mailbox",
      source_email: email_mailbox.source_email || email_mailbox.email_address,
      is_self_service: options[:self_service] || false,
      initiated_by: options[:initiated_by],
      metadata: {
        options: options,
        started_at: Time.current.iso8601
      }
    )

    # Estimate items to migrate
    stats = get_source_mailbox_stats(migration.source_email)
    migration.update!(
      total_items: stats[:message_count],
      total_bytes: stats[:size_bytes]
    )

    # Start the migration
    migration.start!

    migration
  end

  # Execute migration (called by background job)
  # @param migration [EmailMigration] The migration to execute
  def execute_migration(migration)
    migration.log_progress("Starting migration", {
      source: migration.source_email,
      type: migration.migration_type
    })

    begin
      # Start PolarisMail migration
      result = @polaris_service.start_migration(
        mailbox_id: migration.email_mailbox.polaris_mailbox_id,
        source_type: "office365",
        source_credentials: build_source_credentials(migration),
        options: migration.metadata["options"] || {}
      )

      migration.update!(
        polaris_migration_id: result["id"],
        metadata: migration.metadata.merge("polaris_job_id" => result["id"])
      )

      migration.log_progress("Migration started in PolarisMail", {
        polaris_job_id: result["id"]
      })

      # Poll for completion
      poll_migration_status(migration)

    rescue PolarisMailService::ApiError => e
      migration.fail!("PolarisMail API error: #{e.message}")
    rescue StandardError => e
      migration.fail!("Migration error: #{e.message}")
      raise
    end
  end

  # Poll migration status until complete
  # @param migration [EmailMigration]
  def poll_migration_status(migration)
    return unless migration.polaris_migration_id

    loop do
      status = @polaris_service.get_migration_status(migration.polaris_migration_id)

      migration.update!(
        processed_items: status["processed_items"] || 0,
        failed_items: status["failed_items"] || 0,
        processed_bytes: status["processed_bytes"] || 0
      )

      case status["status"]
      when "completed"
        migration.complete!
        break
      when "failed"
        migration.fail!(status["error"] || "Migration failed in PolarisMail")
        break
      when "cancelled"
        migration.cancel!
        break
      else
        # Still in progress, wait and poll again
        sleep(30)
      end

      # Safety: don't poll forever
      if migration.duration_minutes && migration.duration_minutes > 1440 # 24 hours
        migration.fail!("Migration timed out after 24 hours")
        break
      end
    end
  end

  # ====================
  # BATCH OPERATIONS
  # ====================

  # Queue migrations for all mailboxes in subscription
  # @param options [Hash] Migration options
  # @return [Array<EmailMigration>] Created migration jobs
  def queue_all_migrations(options: {})
    migrations = []

    subscription.email_mailboxes.active.each do |mailbox|
      next if mailbox.email_migrations.active.exists?

      migration = EmailMigration.create!(
        email_subscription: subscription,
        email_mailbox: mailbox,
        microsoft_credential: @microsoft_credential,
        migration_type: options[:type] || "full_mailbox",
        source_email: mailbox.source_email || mailbox.email_address,
        is_self_service: options[:self_service] || false,
        initiated_by: options[:initiated_by]
      )
      migration.queue!
      migrations << migration
    end

    migrations
  end

  # Get overall migration status for subscription
  # @return [Hash] Status summary
  def migration_summary
    migrations = subscription.email_migrations

    {
      total: migrations.count,
      pending: migrations.where(status: "pending").count,
      queued: migrations.where(status: "queued").count,
      in_progress: migrations.where(status: "in_progress").count,
      completed: migrations.completed.count,
      failed: migrations.failed.count,
      overall_progress: calculate_overall_progress(migrations)
    }
  end

  private

  def find_microsoft_credential
    # Try to find credential linked to subscription's organization
    return subscription.microsoft_credential if subscription.microsoft_credential

    # Fall back to contact's organization
    org = subscription.contact&.organization
    return nil unless org

    MicrosoftCredential.active_for_org(org)
  end

  def build_source_credentials(migration)
    raise MigrationError, "No Microsoft credential available" unless @microsoft_credential

    # Build OAuth credentials for PolarisMail to use
    # Note: PolarisMail may need its own OAuth flow or admin consent
    {
      type: "oauth2",
      tenant_id: @microsoft_credential.azure_tenant_id,
      client_id: @microsoft_credential.app_id,
      # Don't send actual secrets - PolarisMail should use delegated auth
      user_email: migration.source_email
    }
  end

  def calculate_overall_progress(migrations)
    return 0 if migrations.empty?

    total_items = migrations.sum(:total_items)
    return 0 if total_items.zero?

    processed_items = migrations.sum(:processed_items)
    (processed_items.to_f / total_items * 100).round(1)
  end
end
