# frozen_string_literal: true

# SSoT (Feb 2026): Storage Credential Consolidation
#
# Architecture: 2 global credentials shared by ALL tenants
#   - Credential 1: Wasabi primary (THE ONE for all storage)
#   - Credential 2: Backblaze B2 backup (THE ONE for all backups)
#
# Each tenant's WarehouseProvider stores:
#   connection_config.credential_id       → points to THE ONE Wasabi credential
#   connection_config.backup_credential_id → points to THE ONE Backblaze credential
#   connection_config.bucket              → tenant's primary bucket (e.g., "teeem-teeem")
#   connection_config.backup_bucket       → tenant's backup bucket (e.g., "teeem-teeem-backup")
#
# Small tenants share buckets (e.g., "teeem-shared"), large tenants get dedicated buckets.

namespace :storage do
  desc "Audit all S3 credentials and WarehouseProvider configs"
  task audit: :environment do
    puts "=" * 70
    puts "STORAGE AUDIT - S3 Credentials & WarehouseProvider Config"
    puts "=" * 70

    puts "\n--- S3 Compatible Credentials ---"
    S3CompatibleCredential.order(:id).each do |cred|
      tenant_name = cred.tenant&.name || "(no tenant)"
      org_name = cred.organization&.name || "(no org)"
      decryptable = begin; cred.decryptable?; rescue; false; end
      puts "  ##{cred.id}: #{cred.name}"
      puts "    Provider: #{cred.provider_type} | Status: #{cred.status} | Active: #{cred.is_active?} | Decryptable: #{decryptable}"
      puts "    Tenant: #{tenant_name} (#{cred.tenant_id}) | Org: #{org_name} (#{cred.organization_id})"
      puts "    Endpoint: #{cred.endpoint}"
      puts "    Region: #{cred.region}"
      puts ""
    end

    puts "\n--- WarehouseProvider Configs ---"
    WarehouseProvider.order(:id).each do |wp|
      tenant_name = wp.tenant&.name || "(no tenant)"
      config = wp.connection_config || {}
      puts "  ##{wp.id}: Tenant #{tenant_name} (#{wp.tenant_id})"
      puts "    Provider: #{wp.provider_type} | Status: #{wp.status}"
      puts "    Bucket: #{config['bucket'] || '(not set)'}"
      puts "    Endpoint: #{config['endpoint'] || '(not set)'}"
      puts "    Region: #{config['region'] || '(not set)'}"
      puts "    Credential ID: #{config['credential_id'] || '(not set)'}"
      puts "    Backup Credential ID: #{config['backup_credential_id'] || '(not set)'}"
      puts "    Backup Bucket: #{config['backup_bucket'] || '(not set)'}"
      puts ""
    end

    puts "\n--- Credential Selection Test ---"
    Tenant.all.each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        cred = DocumentProviders::S3Compatible.find_credential_for_tenant(tenant)
        wp = WarehouseProvider.for_tenant(tenant)
        puts "  #{tenant.name}: Would use credential ##{cred&.id || 'NONE'} (#{cred&.name || 'N/A'}) → bucket: #{wp&.bucket || 'NONE'}"
      end
    end

    puts "\n" + "=" * 70
    puts "DONE"
    puts "=" * 70
  end

  desc "Consolidate to 2 global credentials (Wasabi primary + Backblaze backup)"
  task :consolidate, [:wasabi_cred_id, :backblaze_cred_id] => :environment do |_, args|
    wasabi_id = args[:wasabi_cred_id]&.to_i
    backblaze_id = args[:backblaze_cred_id]&.to_i

    unless wasabi_id && wasabi_id > 0
      puts "Usage: rails storage:consolidate[wasabi_cred_id,backblaze_cred_id]"
      puts ""
      puts "First run 'rails storage:audit' to see all credentials."
      puts "Then pick THE ONE Wasabi credential and THE ONE Backblaze credential."
      puts ""
      puts "Example: rails storage:consolidate[1,40]"
      exit 1
    end

    wasabi_cred = S3CompatibleCredential.find_by(id: wasabi_id)
    backblaze_cred = backblaze_id && backblaze_id > 0 ? S3CompatibleCredential.find_by(id: backblaze_id) : nil

    unless wasabi_cred
      puts "ERROR: Wasabi credential ##{wasabi_id} not found"
      exit 1
    end

    puts "=" * 70
    puts "STORAGE CONSOLIDATION"
    puts "=" * 70
    puts ""
    puts "Primary (Wasabi):  ##{wasabi_cred.id} - #{wasabi_cred.name}"
    puts "  Endpoint: #{wasabi_cred.endpoint}"
    puts "  Region: #{wasabi_cred.region}"
    if backblaze_cred
      puts "Backup (Backblaze): ##{backblaze_cred.id} - #{backblaze_cred.name}"
      puts "  Endpoint: #{backblaze_cred.endpoint}"
      puts "  Region: #{backblaze_cred.region}"
    else
      puts "Backup: (none)"
    end

    puts ""
    puts "--- Updating WarehouseProvider records ---"

    WarehouseProvider.all.each do |wp|
      tenant_name = wp.tenant&.name || "Unknown"
      config = wp.connection_config || {}
      old_cred_id = config["credential_id"]

      updates = {
        "credential_id" => wasabi_cred.id,
        "endpoint" => wasabi_cred.endpoint,
        "region" => wasabi_cred.region
      }

      if backblaze_cred
        updates["backup_credential_id"] = backblaze_cred.id
        # Auto-generate backup bucket name if not set
        if config["backup_bucket"].blank? && config["bucket"].present?
          updates["backup_bucket"] = "#{config['bucket']}-backup"
        end
      end

      new_config = config.merge(updates).compact
      wp.update!(connection_config: new_config, status: "connected")

      puts "  #{tenant_name} (WP ##{wp.id}):"
      puts "    credential_id: #{old_cred_id || 'none'} → #{wasabi_cred.id}"
      puts "    bucket: #{new_config['bucket']}"
      if backblaze_cred
        puts "    backup_credential_id: #{new_config['backup_credential_id']}"
        puts "    backup_bucket: #{new_config['backup_bucket']}"
      end
    end

    # Make the global credentials accessible to all tenants
    # Remove tenant/org restrictions so any tenant can use them
    puts ""
    puts "--- Making credentials global (removing tenant/org restrictions) ---"

    if wasabi_cred.tenant_id.present? || wasabi_cred.organization_id.present?
      puts "  Wasabi ##{wasabi_cred.id}: Removing tenant_id=#{wasabi_cred.tenant_id}, org_id=#{wasabi_cred.organization_id}"
      wasabi_cred.update!(tenant_id: nil, organization_id: nil)
    else
      puts "  Wasabi ##{wasabi_cred.id}: Already global"
    end

    if backblaze_cred
      if backblaze_cred.tenant_id.present? || backblaze_cred.organization_id.present?
        puts "  Backblaze ##{backblaze_cred.id}: Removing tenant_id=#{backblaze_cred.tenant_id}, org_id=#{backblaze_cred.organization_id}"
        backblaze_cred.update!(tenant_id: nil, organization_id: nil)
      else
        puts "  Backblaze ##{backblaze_cred.id}: Already global"
      end
    end

    # Deactivate redundant credentials
    puts ""
    puts "--- Deactivating redundant credentials ---"
    keep_ids = [wasabi_id, backblaze_id].compact
    redundant = S3CompatibleCredential.where.not(id: keep_ids)
    redundant.each do |cred|
      puts "  Deactivating ##{cred.id}: #{cred.name} (#{cred.provider_type})"
      cred.update!(is_active: false, status: "disconnected")
    end

    puts ""
    puts "=" * 70
    puts "CONSOLIDATION COMPLETE"
    puts ""
    puts "Verify with: rails storage:audit"
    puts "=" * 70
  end

  desc "Set bucket for a specific tenant's WarehouseProvider"
  task :set_bucket, [:tenant_id, :bucket_name, :backup_bucket_name] => :environment do |_, args|
    tenant_id = args[:tenant_id]&.to_i
    bucket = args[:bucket_name]
    backup_bucket = args[:backup_bucket_name]

    unless tenant_id && bucket
      puts "Usage: rails storage:set_bucket[tenant_id,bucket_name,backup_bucket_name]"
      puts "Example: rails storage:set_bucket[1,teeem-teeem,teeem-teeem-backup]"
      exit 1
    end

    tenant = Tenant.find(tenant_id)
    wp = WarehouseProvider.for_tenant(tenant)
    config = wp.connection_config || {}

    updates = { "bucket" => bucket }
    updates["backup_bucket"] = backup_bucket if backup_bucket.present?

    wp.update!(connection_config: config.merge(updates))
    puts "Updated #{tenant.name} (WP ##{wp.id}):"
    puts "  bucket: #{bucket}"
    puts "  backup_bucket: #{backup_bucket}" if backup_bucket.present?
  end

  desc "Test S3 connection for all tenants"
  task test_connections: :environment do
    puts "Testing S3 connections for all tenants..."
    puts ""

    Tenant.all.each do |tenant|
      ActsAsTenant.with_tenant(tenant) do
        wp = WarehouseProvider.for_tenant(tenant)
        next unless wp.s3_compatible?

        cred = DocumentProviders::S3Compatible.find_credential_for_tenant(tenant)
        bucket = wp.bucket

        unless cred
          puts "  #{tenant.name}: NO CREDENTIAL FOUND"
          next
        end

        unless bucket
          puts "  #{tenant.name}: NO BUCKET CONFIGURED"
          next
        end

        begin
          client = cred.build_client
          client.head_bucket(bucket: bucket)
          puts "  #{tenant.name}: OK (cred ##{cred.id} → #{bucket})"
        rescue Aws::S3::Errors::NotFound, Aws::S3::Errors::NoSuchBucket
          puts "  #{tenant.name}: BUCKET NOT FOUND '#{bucket}' via cred ##{cred.id} (#{cred.name})"
        rescue Aws::S3::Errors::Forbidden
          puts "  #{tenant.name}: ACCESS DENIED to '#{bucket}' via cred ##{cred.id} (#{cred.name})"
        rescue StandardError => e
          puts "  #{tenant.name}: ERROR - #{e.class}: #{e.message}"
        end
      end
    end
  end
end
