# frozen_string_literal: true

# MigrateMicrosoftCredentialsJob - Migrates data from 6 legacy credential tables
# to the unified MicrosoftCredential model
#
# Run with: MigrateMicrosoftCredentialsJob.perform_now
#
# This is a ONE-TIME migration job. Safe to run multiple times (idempotent).
#
class MigrateMicrosoftCredentialsJob < ApplicationJob
  queue_as :default

  def perform(dry_run: false)
    @dry_run = dry_run
    @stats = {
      app_credentials: { migrated: 0, skipped: 0, errors: 0 },
      org_onedrive: { migrated: 0, skipped: 0, errors: 0 },
      user_microsoft_tokens: { migrated: 0, skipped: 0, errors: 0 },
      per_job_onedrive: { migrated: 0, skipped: 0, errors: 0 }
    }
    # NOTE: OrganizationOutlookCredential and UserOutlookCredential models
    # were deleted in Dec 2024 cleanup. Their tables can be dropped.

    Rails.logger.info "[MigrateMicrosoftCredentials] Starting migration (dry_run: #{@dry_run})..."

    migrate_organization_microsoft_app_credentials
    migrate_organization_onedrive_credentials
    # NOTE: migrate_organization_outlook_credentials removed - model deleted
    migrate_user_microsoft_tokens
    # NOTE: migrate_user_outlook_credentials removed - model deleted
    migrate_per_job_onedrive_credentials

    log_summary
    @stats
  end

  private

  # 1. OrganizationMicrosoftAppCredential → type: 'app', owner: nil
  def migrate_organization_microsoft_app_credentials
    Rails.logger.info "[MigrateMicrosoftCredentials] Migrating OrganizationMicrosoftAppCredential..."

    OrganizationMicrosoftAppCredential.find_each do |old|
      # Check if already migrated (by name)
      if MicrosoftCredential.exists?(name: old.name, credential_type: "app")
        @stats[:app_credentials][:skipped] += 1
        next
      end

      # Note: sharepoint_* columns removed from MicrosoftCredential in Phase 5
      # SSoT: SharePoint config now lives in StorageConfiguration
      attrs = {
        credential_type: "app",
        name: old.name,
        owner_type: nil,
        owner_id: nil,
        client_id: old.client_id,
        client_secret: old.client_secret,
        tenant_id: old.tenant_id,
        access_token: old.access_token,
        token_expires_at: old.token_expires_at,
        status: map_status(old.status),
        error_message: old.last_error,
        admin_consent_granted_at: old.admin_consent_granted_at,
        admin_consent_granted_by: old.admin_consent_granted_by,
        sync_config: old.sync_config || {},
        bulk_sync_progress: old.bulk_sync_progress || {},
        last_sync_at: old.last_sync_at,
        setup_by_id: old.setup_by_id,
        is_active: old.is_active
      }

      create_or_log(attrs, :app_credentials, "OrganizationMicrosoftAppCredential##{old.id}")
    end
  rescue => e
    Rails.logger.error "[MigrateMicrosoftCredentials] Error migrating app credentials: #{e.message}"
  end

  # 2. OrganizationSharePointCredential → type: 'delegated', owner: nil
  def migrate_organization_onedrive_credentials
    Rails.logger.info "[MigrateMicrosoftCredentials] Migrating OrganizationSharePointCredential..."

    OrganizationSharePointCredential.find_each do |old|
      # Use name + 'onedrive' to distinguish from outlook credentials
      lookup_name = old.name.present? ? "#{old.name}_onedrive" : "org_onedrive_#{old.id}"

      if MicrosoftCredential.exists?(name: lookup_name, credential_type: "delegated")
        @stats[:org_onedrive][:skipped] += 1
        next
      end

      attrs = {
        credential_type: "delegated",
        name: lookup_name,
        owner_type: nil,
        owner_id: nil,
        access_token: old.access_token,
        refresh_token: old.refresh_token,
        token_expires_at: old.token_expires_at,
        status: old.is_active && old.access_token.present? ? "connected" : "disconnected",
        drive_id: old.drive_id,
        drive_name: old.drive_name,
        root_folder_id: old.root_folder_id,
        root_folder_path: old.root_folder_path,
        metadata: old.metadata || {},
        last_sync_at: old.last_synced_at,
        connected_by_id: old.connected_by_id,
        is_active: old.is_active
      }

      create_or_log(attrs, :org_onedrive, "OrganizationSharePointCredential##{old.id}")
    end
  rescue => e
    Rails.logger.error "[MigrateMicrosoftCredentials] Error migrating org OneDrive credentials: #{e.message}"
  end

  # 3. OrganizationOutlookCredential - REMOVED (model deleted Dec 2024)
  # Data should have been migrated before model deletion.

  # 4. UserMicrosoftToken → type: 'delegated', owner: User
  def migrate_user_microsoft_tokens
    Rails.logger.info "[MigrateMicrosoftCredentials] Migrating UserMicrosoftToken..."

    UserMicrosoftToken.find_each do |old|
      # Check if already migrated for this user
      if MicrosoftCredential.exists?(owner_type: "User", owner_id: old.user_id, credential_type: "delegated")
        @stats[:user_microsoft_tokens][:skipped] += 1
        next
      end

      attrs = {
        credential_type: "delegated",
        name: nil, # User tokens don't need names
        owner_type: "User",
        owner_id: old.user_id,
        access_token: old.access_token,
        refresh_token: old.refresh_token,
        token_expires_at: old.token_expires_at,
        scopes: old.scopes,
        email: old.email,
        status: map_status(old.status),
        error_message: old.sync_error,
        refresh_token_dead: old.refresh_token_dead || false,
        consecutive_failures: old.consecutive_failures || 0,
        last_refresh_attempt_at: old.last_refresh_attempt_at,
        last_sync_at: old.last_sync_at,
        connected_by_id: old.user_id,
        is_active: true
      }

      create_or_log(attrs, :user_microsoft_tokens, "UserMicrosoftToken##{old.id} (user: #{old.user_id})")
    end
  rescue => e
    Rails.logger.error "[MigrateMicrosoftCredentials] Error migrating user Microsoft tokens: #{e.message}"
  end

  # 5. UserOutlookCredential - REMOVED (model deleted Dec 2024)
  # Data should have been migrated before model deletion.

  # 6. OneDriveCredential - REMOVED (model and table deleted Jan 2026)
  # Data was 0 records in production - nothing to migrate.
  def migrate_per_job_onedrive_credentials
    Rails.logger.info "[MigrateMicrosoftCredentials] Skipping OneDriveCredential - legacy system removed Jan 2026"
  end

  def create_or_log(attrs, stat_key, source_desc)
    if @dry_run
      Rails.logger.info "[MigrateMicrosoftCredentials] DRY RUN - Would create from #{source_desc}"
      @stats[stat_key][:migrated] += 1
    else
      MicrosoftCredential.create!(attrs)
      Rails.logger.info "[MigrateMicrosoftCredentials] Migrated #{source_desc}"
      @stats[stat_key][:migrated] += 1
    end
  rescue ActiveRecord::RecordInvalid => e
    Rails.logger.error "[MigrateMicrosoftCredentials] Failed to migrate #{source_desc}: #{e.message}"
    @stats[stat_key][:errors] += 1
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.error "[MigrateMicrosoftCredentials] Decryption error for #{source_desc}: #{e.message}"
    @stats[stat_key][:errors] += 1
  end

  def map_status(old_status)
    case old_status
    when "connected" then "connected"
    when "pending" then "pending"
    when "error" then "error"
    when "disconnected" then "disconnected"
    else "pending"
    end
  end

  def log_summary
    Rails.logger.info "[MigrateMicrosoftCredentials] Migration complete!"
    Rails.logger.info "[MigrateMicrosoftCredentials] Summary:"

    total_migrated = 0
    total_skipped = 0
    total_errors = 0

    @stats.each do |key, counts|
      Rails.logger.info "  #{key}: migrated=#{counts[:migrated]}, skipped=#{counts[:skipped]}, errors=#{counts[:errors]}"
      total_migrated += counts[:migrated]
      total_skipped += counts[:skipped]
      total_errors += counts[:errors]
    end

    Rails.logger.info "  TOTAL: migrated=#{total_migrated}, skipped=#{total_skipped}, errors=#{total_errors}"
  end
end
