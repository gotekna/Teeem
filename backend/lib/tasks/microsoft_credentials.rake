# frozen_string_literal: true

namespace :microsoft_credentials do
  desc "Migrate data from legacy credential tables to unified MicrosoftCredential"
  task migrate: :environment do
    puts "Migrating Microsoft credentials to unified model..."
    result = MigrateMicrosoftCredentialsJob.perform_now
    puts "Done!"
    puts ""
    puts "Results:"
    result.each do |key, counts|
      puts "  #{key}: migrated=#{counts[:migrated]}, skipped=#{counts[:skipped]}, errors=#{counts[:errors]}"
    end
  end

  desc "Dry run migration (no changes made)"
  task migrate_dry_run: :environment do
    puts "DRY RUN - Migrating Microsoft credentials (no changes will be made)..."
    result = MigrateMicrosoftCredentialsJob.perform_now(dry_run: true)
    puts "Done!"
    puts ""
    puts "Would migrate:"
    result.each do |key, counts|
      puts "  #{key}: would_migrate=#{counts[:migrated]}, would_skip=#{counts[:skipped]}"
    end
  end

  desc "Show current state of all credential tables"
  task status: :environment do
    puts "Microsoft Credential Status"
    puts "=" * 60
    puts ""

    # New unified table
    puts "NEW: microsoft_credentials"
    puts "  Total: #{MicrosoftCredential.count}"
    puts "  By type:"
    puts "    app: #{MicrosoftCredential.app_credentials.count}"
    puts "    delegated: #{MicrosoftCredential.delegated_credentials.count}"
    puts "  By status:"
    MicrosoftCredential.group(:status).count.each do |status, count|
      puts "    #{status}: #{count}"
    end
    puts "  By owner_type:"
    MicrosoftCredential.group(:owner_type).count.each do |owner_type, count|
      puts "    #{owner_type || 'org-level'}: #{count}"
    end
    puts ""

    # Legacy tables
    puts "LEGACY: organization_microsoft_app_credentials"
    puts "  Total: #{OrganizationMicrosoftAppCredential.count}"
    puts "  Active: #{OrganizationMicrosoftAppCredential.active.count}"
    puts "  Connected: #{OrganizationMicrosoftAppCredential.connected.count}"
    puts ""

    puts "LEGACY: organization_one_drive_credentials"
    puts "  Total: #{OrganizationOneDriveCredential.count}"
    puts "  Active: #{OrganizationOneDriveCredential.active.count}"
    puts ""

    puts "LEGACY: organization_outlook_credentials"
    puts "  Total: #{OrganizationOutlookCredential.count}"
    puts ""

    puts "LEGACY: user_microsoft_tokens"
    puts "  Total: #{UserMicrosoftToken.count}"
    puts "  Connected: #{UserMicrosoftToken.connected.count}"
    puts "  Dead: #{UserMicrosoftToken.dead.count}"
    puts ""

    puts "LEGACY: user_outlook_credentials"
    puts "  Total: #{UserOutlookCredential.count}"
    puts ""

    puts "LEGACY: one_drive_credentials (per-job)"
    puts "  Total: #{OneDriveCredential.count}"
    puts ""
  end

  desc "List all MicrosoftCredential records"
  task list: :environment do
    puts "MicrosoftCredential records:"
    puts "=" * 80

    MicrosoftCredential.order(:credential_type, :owner_type, :name).each do |cred|
      owner = cred.owner_type ? "#{cred.owner_type}##{cred.owner_id}" : "org-level"
      name = cred.name || "(no name)"
      status_emoji = case cred.status
                     when "connected" then "✅"
                     when "error" then "⚠️"
                     when "dead" then "💀"
                     else "⏳"
                     end

      puts "#{status_emoji} [#{cred.credential_type.upcase}] #{name}"
      puts "   Owner: #{owner}"
      puts "   Status: #{cred.status}"
      puts "   Token expires: #{cred.token_expires_at&.strftime('%Y-%m-%d %H:%M')}"
      puts "   SharePoint: #{cred.sharepoint_configured? ? 'configured' : 'not configured'}"
      puts ""
    end

    puts "Total: #{MicrosoftCredential.count}"
  end
end
