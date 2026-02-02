# frozen_string_literal: true

# Service to synchronize configuration between tenants
#
# Primary use case: Sync Tekna (production client) → TEEEM (master templates)
#
# Usage:
#   # Sync all configuration from Tekna to TEEEM master
#   tekna = CompanyGroup.find_by(slug: 'tekna-homes')
#   teeem = CompanyGroup.find_by(slug: 'teeem')
#
#   service = TenantSyncService.new(source_tenant: tekna, target_tenant: teeem)
#   result = service.sync_all!
#
#   # Sync only schedule masters
#   result = service.sync_schedule_masters!
#
#   # Sync specific item types
#   result = service.sync!(item_types: [:job_types, :job_statuses])
#
class TenantSyncService
  attr_reader :source_tenant, :target_tenant, :last_sync_result

  def initialize(source_tenant:, target_tenant: nil)
    @source_tenant = source_tenant
    @target_tenant = target_tenant || master_tenant
    @last_sync_result = nil

    validate_tenants!
  end

  # Sync all configuration from source to target
  def sync_all!
    pack_name = generate_pack_name("Full Sync")

    Rails.logger.info "[TenantSync] Starting full sync from #{source_tenant.name} to #{target_tenant.name}"

    # Export from source
    export_service = TemplateExportService.new(source_tenant)
    pack = export_service.export_full_pack(
      name: pack_name,
      description: "Full sync from #{source_tenant.name} - #{Time.current.strftime('%Y-%m-%d %H:%M')}",
      visibility: target_tenant.is_master_tenant? ? :curated : :private_pack
    )

    # Import to target
    import_service = TemplateImportService.new(target_tenant, pack)
    @last_sync_result = import_service.import!(skip_existing: false)

    log_sync_result("Full Sync", @last_sync_result)

    @last_sync_result.merge(
      pack_id: pack.id,
      pack_name: pack.name
    )
  end

  # Sync only schedule master templates
  def sync_schedule_masters!
    pack_name = generate_pack_name("Schedule Masters")

    Rails.logger.info "[TenantSync] Syncing schedule masters from #{source_tenant.name} to #{target_tenant.name}"

    # Export from source
    export_service = TemplateExportService.new(source_tenant)
    pack = export_service.export_schedule_master_only(
      name: pack_name,
      description: "Schedule Master sync from #{source_tenant.name}"
    )

    # Import to target
    import_service = TemplateImportService.new(target_tenant, pack)
    @last_sync_result = import_service.import!(skip_existing: false)

    log_sync_result("Schedule Masters", @last_sync_result)

    @last_sync_result.merge(
      pack_id: pack.id,
      pack_name: pack.name
    )
  end

  # Sync specific item types
  def sync!(item_types:)
    pack_name = generate_pack_name("Selective Sync")

    Rails.logger.info "[TenantSync] Syncing #{item_types.join(', ')} from #{source_tenant.name} to #{target_tenant.name}"

    # Export from source
    export_service = TemplateExportService.new(source_tenant)
    pack = export_service.export_selective(
      name: pack_name,
      item_types: item_types,
      description: "Selective sync (#{item_types.join(', ')}) from #{source_tenant.name}"
    )

    # Import to target
    import_service = TemplateImportService.new(target_tenant, pack)
    @last_sync_result = import_service.import!(
      skip_existing: false,
      item_types: item_types
    )

    log_sync_result("Selective (#{item_types.join(', ')})", @last_sync_result)

    @last_sync_result.merge(
      pack_id: pack.id,
      pack_name: pack.name
    )
  end

  # Preview what would be synced (dry run)
  def preview_sync
    export_service = TemplateExportService.new(source_tenant)

    # Create a temporary pack for preview
    temp_pack = export_service.export_full_pack(
      name: "Preview - #{Time.current.to_i}",
      visibility: :private_pack
    )

    import_service = TemplateImportService.new(target_tenant, temp_pack)
    preview = import_service.validate!

    # Clean up temporary pack
    temp_pack.destroy

    preview
  end

  private

  def master_tenant
    @master_tenant ||= CompanyGroup.find_by(is_master_tenant: true) ||
                       CompanyGroup.find_by(slug: "teeem")
  end

  def validate_tenants!
    raise ArgumentError, "Source tenant cannot be nil" unless source_tenant
    raise ArgumentError, "Target tenant cannot be nil" unless target_tenant
    raise ArgumentError, "Source and target tenants must be different" if source_tenant.id == target_tenant.id
  end

  def generate_pack_name(sync_type)
    timestamp = Time.current.strftime("%Y-%m-%d %H:%M")
    "#{sync_type} - #{source_tenant.name} → #{target_tenant.name} (#{timestamp})"
  end

  def log_sync_result(sync_type, result)
    if result[:success]
      Rails.logger.info "[TenantSync] #{sync_type} completed successfully"
      Rails.logger.info "[TenantSync] Imported: #{result[:imported]}"
    else
      Rails.logger.error "[TenantSync] #{sync_type} failed with errors:"
      result[:errors].each { |e| Rails.logger.error "  - #{e}" }
    end
  end
end
