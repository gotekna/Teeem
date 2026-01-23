# frozen_string_literal: true

# Backfill tenant_id on SyncedEmail records that have NULL tenant_id
# This fixes legacy emails created before multi-tenancy was properly enforced
#
# Run: rails backfill:email_tenant_ids
# Dry run: rails backfill:email_tenant_ids[dry_run]

namespace :backfill do
  desc "Backfill tenant_id on SyncedEmail records with NULL tenant_id"
  task :email_tenant_ids, [:dry_run] => :environment do |_t, args|
    dry_run = args[:dry_run] == "dry_run"
    puts dry_run ? "DRY RUN - No changes will be made" : "LIVE RUN - Changes will be applied"
    puts "=" * 60

    null_count = SyncedEmail.unscoped.where(tenant_id: nil).count
    puts "Found #{null_count} emails with NULL tenant_id"

    if null_count == 0
      puts "Nothing to backfill!"
      next
    end

    # Get default tenant for fallback
    default_tenant = Tenant.find_by(is_master_tenant: true) || Tenant.first
    puts "Default tenant for fallback: #{default_tenant&.name || 'NONE'} (ID: #{default_tenant&.id})"
    puts "=" * 60

    stats = {
      from_microsoft_credential: 0,
      from_imap_credential: 0,
      from_synced_by_user: 0,
      from_default_tenant: 0,
      errors: 0
    }

    SyncedEmail.unscoped.where(tenant_id: nil).find_each do |email|
      tenant_id = nil
      source = nil

      # Priority 1: Microsoft credential -> organization -> tenant
      if email.microsoft_credential_id.present?
        cred = MicrosoftCredential.find_by(id: email.microsoft_credential_id)
        if cred&.organization&.tenant_id
          tenant_id = cred.organization.tenant_id
          source = :from_microsoft_credential
        end
      end

      # Priority 2: IMAP credential -> user -> tenant
      if tenant_id.nil? && email.imap_credential_id.present?
        cred = ImapCredential.find_by(id: email.imap_credential_id)
        if cred&.user&.tenant_id
          tenant_id = cred.user.tenant_id
          source = :from_imap_credential
        end
      end

      # Priority 3: synced_by_user -> tenant
      if tenant_id.nil? && email.synced_by_user_id.present?
        user = User.find_by(id: email.synced_by_user_id)
        if user&.tenant_id
          tenant_id = user.tenant_id
          source = :from_synced_by_user
        end
      end

      # Fallback: default tenant
      if tenant_id.nil? && default_tenant
        tenant_id = default_tenant.id
        source = :from_default_tenant
      end

      if tenant_id
        stats[source] += 1
        unless dry_run
          email.update_column(:tenant_id, tenant_id)
        end
      else
        stats[:errors] += 1
        puts "ERROR: Could not determine tenant for email #{email.id}"
      end
    rescue => e
      stats[:errors] += 1
      puts "ERROR processing email #{email.id}: #{e.message}"
    end

    puts "=" * 60
    puts "Results:"
    puts "  From Microsoft credential: #{stats[:from_microsoft_credential]}"
    puts "  From IMAP credential:      #{stats[:from_imap_credential]}"
    puts "  From synced_by_user:       #{stats[:from_synced_by_user]}"
    puts "  From default tenant:       #{stats[:from_default_tenant]}"
    puts "  Errors:                    #{stats[:errors]}"
    puts "  Total processed:           #{stats.values.sum}"
    puts "=" * 60

    remaining = SyncedEmail.unscoped.where(tenant_id: nil).count
    puts "Remaining emails with NULL tenant_id: #{remaining}"
    puts dry_run ? "This was a DRY RUN - run without [dry_run] to apply changes" : "Backfill complete!"
  end
end
