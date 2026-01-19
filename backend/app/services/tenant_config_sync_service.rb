# frozen_string_literal: true

# Service for per-record configuration sync between tenants
#
# This service enables granular config record sync between tenants:
# - TEEEM (master tenant) can IMPORT from any tenant
# - Customer tenants can PULL from TEEEM
# - Per-record selection (not bulk type sync)
# - Name-based matching for identifying "same" records across tenants
#
# Usage:
#   # TEEEM importing from Tekna
#   service = TenantConfigSyncService.new(teeem_tenant)
#   records = service.browse_tenant_config(tekna, :document_types)
#   service.import_from_tenant(source: tekna, table: :document_types, record_ids: [1, 2, 3])
#
#   # Tenant pulling from TEEEM
#   service = TenantConfigSyncService.new(pilgrim_tenant)
#   diff = service.diff_with_master(:document_types)
#   service.pull_from_master(table: :document_types, record_ids: [1, 2], mode: :add_new)
#
class TenantConfigSyncService
  # SSoT: Configuration tables available for sync
  CONFIG_TABLES = {
    document_types: {
      model: "DocumentType",
      name_field: :name,
      match_fields: [:name, :scope],
      sync_fields: [:name, :scope, :file_name, :display_name, :abbreviation, :category,
                    :folder, :primary_tab, :aliases, :requires_filing, :supports_versioning,
                    :generates_certificate, :certificate_template, :form_number_mapping,
                    :description, :active],
      description: "Document type definitions and naming templates"
    },
    job_types: {
      model: "JobType",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :color, :icon, :description, :is_active, :position,
                    :sm_schedule_master_template_id],
      description: "Job type classifications"
    },
    job_statuses: {
      model: "JobStatus",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :color, :icon, :description, :is_active, :position,
                    :is_complete, :is_default, :order_index, :status_category],
      description: "Job status workflow states"
    },
    job_stages: {
      model: "JobStage",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :color, :icon, :description, :is_active, :position,
                    :stage_order, :is_milestone],
      description: "Job stage progression"
    },
    contact_types: {
      model: "ContactType",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :display_name, :tab_label, :description, :active, :position],
      description: "Contact type classifications"
    },
    pricebook_categories: {
      model: "PricebookCategory",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :parent_id, :position, :icon, :color],
      description: "Pricebook organization categories"
    },
    public_holidays: {
      model: "PublicHoliday",
      name_field: :name,
      match_fields: [:name, :date],
      sync_fields: [:name, :date, :region, :description, :recurring],
      description: "Regional public holidays"
    },
    entity_tabs: {
      model: "EntityTab",
      name_field: :display_name,
      match_fields: [:display_name, :entity_type],
      sync_fields: [:display_name, :entity_type, :icon, :position, :description,
                    :is_default, :is_system],
      description: "Entity folder/tab organization"
    },
    sm_schedule_master_templates: {
      model: "SmScheduleMasterTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :is_default, :is_active],
      description: "Schedule Master templates"
    },
    sm_trades: {
      model: "SmTrade",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name],
      description: "Schedule Master trades"
    },
    document_templates: {
      model: "DocumentTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :category, :output_format, :output_naming_pattern,
                    :data_schema, :is_active, :sort_order, :template_type, :layout,
                    :is_legal_format, :legal_source, :local_template_path],
      description: "Document generation templates"
    },
    meeting_types: {
      model: "MeetingType",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :category, :icon, :color, :default_duration_minutes,
                    :required_participant_types, :optional_participant_types,
                    :minimum_participants, :maximum_participants, :default_agenda_items,
                    :required_fields, :optional_fields, :custom_fields, :required_documents,
                    :notification_settings, :is_active, :is_system_default],
      description: "Meeting type definitions"
    },
    pricebook_items: {
      model: "PricebookItem",
      name_field: :item_name,
      match_fields: [:item_code],
      sync_fields: [:item_code, :item_name, :category, :unit_of_measure, :current_price,
                    :brand, :notes, :is_active, :supplier_price, :colour, :colour_code,
                    :colour_brand, :lead_time_days, :call_time_days, :gst_code,
                    :requires_photo, :requires_spec],
      description: "Pricebook products and pricing"
    },
    sm_schedule_masters: {
      model: "SmScheduleMaster",
      name_field: :name,
      match_fields: [:task_number],
      sync_fields: [:task_number, :name, :description, :sequence_order, :duration_days,
                    :trade, :stage, :pass_fail_enabled, :order_time_days, :call_time_days,
                    :require_photo, :confirm, :po_required, :critical_po, :has_subtasks,
                    :subtask_count, :subtask_names, :tags, :color, :is_active, :cost_centre,
                    :supplier_confirm, :header_gantt, :hold, :assigned_role, :is_claim_task,
                    :claim_percentage, :is_variation],
      description: "Schedule Master task templates"
    }
  }.freeze

  attr_reader :tenant, :errors

  def initialize(tenant)
    @tenant = tenant
    @errors = []
  end

  # ============================================================================
  # Browse & Compare Operations
  # ============================================================================

  # List all available config tables with counts
  def available_tables
    CONFIG_TABLES.map do |key, config|
      {
        key: key.to_s,
        model: config[:model],
        description: config[:description],
        name_field: config[:name_field].to_s
      }
    end
  end

  # Get record counts per table for both master and tenant
  def table_counts
    master = master_tenant
    counts = {}

    CONFIG_TABLES.each do |key, config|
      model = config[:model].constantize

      master_count = if master
        ActsAsTenant.with_tenant(master) { model.count }
      else
        0
      end

      tenant_count = ActsAsTenant.with_tenant(tenant) { model.count }

      counts[key.to_s] = {
        master: master_count,
        tenant: tenant_count
      }
    end

    counts
  end

  # Get record counts per table for ALL tenants (for admin overview)
  def all_tenant_counts
    tenants = CorporateGroup.order(:name)
    counts = {}

    CONFIG_TABLES.each do |key, config|
      model = config[:model].constantize
      counts[key.to_s] = {}

      tenants.each do |t|
        count = ActsAsTenant.with_tenant(t) { model.count }
        counts[key.to_s][t.slug] = count
      end

      # Also count NULL tenant records
      counts[key.to_s]["null"] = model.where(company_group_id: nil).count
    end

    {
      tenants: tenants.map { |t| { id: t.id, name: t.name, slug: t.slug, is_master: t.is_master_tenant? } },
      counts: counts
    }
  end

  # Browse config records from a source tenant (for TEEEM admin)
  def browse_tenant_config(source_tenant, table)
    validate_table!(table)
    config = CONFIG_TABLES[table.to_sym]
    model = config[:model].constantize

    # Temporarily switch tenant context to read from source
    ActsAsTenant.with_tenant(source_tenant) do
      model.all.order(config[:name_field]).map do |record|
        record_to_json(record, config)
      end
    end
  end

  # Get diff between tenant's config and master tenant (for customer admins)
  def diff_with_master(table)
    validate_table!(table)
    master = master_tenant
    return { error: "No master tenant found" } unless master

    config = CONFIG_TABLES[table.to_sym]
    model = config[:model].constantize
    match_fields = config[:match_fields]

    # Get master records
    master_records = ActsAsTenant.with_tenant(master) do
      model.all.index_by { |r| match_key(r, match_fields) }
    end

    # Get tenant records
    tenant_records = ActsAsTenant.with_tenant(tenant) do
      model.all.index_by { |r| match_key(r, match_fields) }
    end

    result = {
      new_records: [],      # In master but not in tenant
      modified_records: [], # In both but different
      deleted_records: [],  # In tenant but not in master
      unchanged_records: [] # Same in both
    }

    # Find new and modified
    master_records.each do |key, master_record|
      if tenant_records[key]
        tenant_record = tenant_records[key]
        if records_differ?(master_record, tenant_record, config[:sync_fields])
          result[:modified_records] << {
            master: record_to_json(master_record, config),
            tenant: record_to_json(tenant_record, config),
            changes: compute_changes(master_record, tenant_record, config[:sync_fields])
          }
        else
          result[:unchanged_records] << record_to_json(tenant_record, config)
        end
      else
        result[:new_records] << record_to_json(master_record, config)
      end
    end

    # Find deleted (in tenant but not in master)
    tenant_records.each_key do |key|
      unless master_records[key]
        result[:deleted_records] << record_to_json(tenant_records[key], config)
      end
    end

    {
      table: table.to_s,
      master_tenant: { id: master.id, name: master.name },
      tenant: { id: tenant.id, name: tenant.name },
      summary: {
        new: result[:new_records].length,
        modified: result[:modified_records].length,
        deleted: result[:deleted_records].length,
        unchanged: result[:unchanged_records].length
      },
      **result
    }
  end

  # ============================================================================
  # Import Operations (TEEEM importing from tenant)
  # ============================================================================

  # Import selected records from a source tenant into TEEEM
  def import_from_tenant(source_tenant:, table:, record_ids:)
    validate_table!(table)
    @errors = []

    unless tenant.is_master_tenant?
      @errors << "Only master tenant can import from other tenants"
      return { success: false, errors: @errors }
    end

    config = CONFIG_TABLES[table.to_sym]
    model = config[:model].constantize
    imported = []
    skipped = []

    # Get source records
    source_records = ActsAsTenant.with_tenant(source_tenant) do
      model.where(id: record_ids)
    end

    # Import each record
    source_records.each do |source_record|
      begin
        result = import_single_record(source_record, config, model)
        if result[:imported]
          imported << result[:record]
        else
          skipped << { name: source_record.send(config[:name_field]), reason: result[:reason] }
        end
      rescue => e
        @errors << "Failed to import #{source_record.send(config[:name_field])}: #{e.message}"
      end
    end

    {
      success: @errors.empty?,
      imported: imported.map { |r| record_to_json(r, config) },
      skipped: skipped,
      errors: @errors
    }
  end

  # ============================================================================
  # Pull Operations (Tenant pulling from TEEEM)
  # ============================================================================

  # Pull selected records from master tenant
  # mode: :add_new - only add records that don't exist
  #       :replace_existing - update existing records with master values
  #       :skip_existing - skip if exists, only add new
  def pull_from_master(table:, record_ids:, mode: :add_new)
    validate_table!(table)
    @errors = []
    master = master_tenant

    unless master
      @errors << "No master tenant found"
      return { success: false, errors: @errors }
    end

    config = CONFIG_TABLES[table.to_sym]
    model = config[:model].constantize
    imported = []
    updated = []
    skipped = []

    # Get master records
    master_records = ActsAsTenant.with_tenant(master) do
      model.where(id: record_ids)
    end

    # Get existing tenant records for matching
    existing_records = ActsAsTenant.with_tenant(tenant) do
      model.all.index_by { |r| match_key(r, config[:match_fields]) }
    end

    # Process each master record
    master_records.each do |master_record|
      begin
        match_key_value = match_key(master_record, config[:match_fields])
        existing = existing_records[match_key_value]

        if existing
          case mode.to_sym
          when :replace_existing
            result = update_existing_record(existing, master_record, config)
            if result[:updated]
              updated << result[:record]
            else
              skipped << { name: master_record.send(config[:name_field]), reason: result[:reason] }
            end
          when :add_new, :skip_existing
            skipped << { name: master_record.send(config[:name_field]), reason: "Already exists" }
          end
        else
          result = create_new_record(master_record, config, model)
          if result[:created]
            imported << result[:record]
          else
            skipped << { name: master_record.send(config[:name_field]), reason: result[:reason] }
          end
        end
      rescue => e
        @errors << "Failed to process #{master_record.send(config[:name_field])}: #{e.message}"
      end
    end

    {
      success: @errors.empty?,
      imported: imported.map { |r| record_to_json(r, config) },
      updated: updated.map { |r| record_to_json(r, config) },
      skipped: skipped,
      errors: @errors
    }
  end

  private

  # ============================================================================
  # Helper Methods
  # ============================================================================

  def master_tenant
    CorporateGroup.find_by(is_master_tenant: true) || CorporateGroup.find_by(slug: "teeem")
  end

  def validate_table!(table)
    unless CONFIG_TABLES.key?(table.to_sym)
      raise ArgumentError, "Unknown config table: #{table}. Valid tables: #{CONFIG_TABLES.keys.join(', ')}"
    end
  end

  def match_key(record, match_fields)
    match_fields.map { |f| record.send(f).to_s.downcase.strip }.join("|")
  end

  def records_differ?(record1, record2, sync_fields)
    sync_fields.any? do |field|
      next false unless record1.respond_to?(field) && record2.respond_to?(field)
      normalize_value(record1.send(field)) != normalize_value(record2.send(field))
    end
  end

  def normalize_value(value)
    case value
    when String
      value.strip
    when Array, Hash
      value.to_json
    else
      value
    end
  end

  def compute_changes(master_record, tenant_record, sync_fields)
    changes = {}
    sync_fields.each do |field|
      next unless master_record.respond_to?(field) && tenant_record.respond_to?(field)
      master_val = normalize_value(master_record.send(field))
      tenant_val = normalize_value(tenant_record.send(field))
      if master_val != tenant_val
        changes[field] = { master: master_val, tenant: tenant_val }
      end
    end
    changes
  end

  def record_to_json(record, config)
    json = {
      id: record.id,
      name: record.send(config[:name_field]),
      created_at: record.created_at,
      updated_at: record.updated_at
    }

    # Add all sync fields
    config[:sync_fields].each do |field|
      json[field] = record.send(field) if record.respond_to?(field)
    end

    json
  end

  def import_single_record(source_record, config, model)
    # Check if already exists in tenant (master)
    match_key_value = match_key(source_record, config[:match_fields])

    existing = ActsAsTenant.with_tenant(tenant) do
      model.all.find { |r| match_key(r, config[:match_fields]) == match_key_value }
    end

    if existing
      # Update existing
      ActsAsTenant.with_tenant(tenant) do
        attrs = config[:sync_fields].each_with_object({}) do |field, hash|
          hash[field] = source_record.send(field) if source_record.respond_to?(field)
        end
        existing.update!(attrs)
      end
      { imported: true, record: existing }
    else
      # Create new
      ActsAsTenant.with_tenant(tenant) do
        new_record = model.new
        config[:sync_fields].each do |field|
          new_record.send("#{field}=", source_record.send(field)) if source_record.respond_to?(field)
        end
        new_record.save!
        { imported: true, record: new_record }
      end
    end
  rescue => e
    { imported: false, reason: e.message }
  end

  def create_new_record(source_record, config, model)
    ActsAsTenant.with_tenant(tenant) do
      new_record = model.new
      config[:sync_fields].each do |field|
        new_record.send("#{field}=", source_record.send(field)) if source_record.respond_to?(field)
      end
      new_record.save!
      { created: true, record: new_record }
    end
  rescue => e
    { created: false, reason: e.message }
  end

  def update_existing_record(existing, source_record, config)
    ActsAsTenant.with_tenant(tenant) do
      attrs = config[:sync_fields].each_with_object({}) do |field, hash|
        hash[field] = source_record.send(field) if source_record.respond_to?(field)
      end
      existing.update!(attrs)
      { updated: true, record: existing }
    end
  rescue => e
    { updated: false, reason: e.message }
  end
end
