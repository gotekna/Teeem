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
  # Groups for UI organization: jobs, documents, contacts, schedule, operations
  CONFIG_TABLES = {
    # ============================================================================
    # Jobs Group
    # ============================================================================
    job_types: {
      model: "JobType",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :color, :icon, :description, :is_active, :position,
                    :sm_schedule_master_template_id],
      description: "Job type classifications",
      group: "jobs"
    },
    job_statuses: {
      model: "JobStatus",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :color, :icon, :description, :is_active, :position,
                    :is_complete, :is_default, :order_index, :status_category],
      description: "Job status workflow states",
      group: "jobs"
    },
    job_stages: {
      model: "JobStage",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :color, :icon, :description, :is_active, :position,
                    :stage_order, :is_milestone],
      description: "Job stage progression",
      group: "jobs"
    },
    job_type_statuses: {
      model: "JobTypeStatus",
      name_field: :id,
      match_fields: [:job_type_id, :job_status_id],
      sync_fields: [:job_type_id, :job_status_id, :position],
      description: "Job type to status mappings",
      group: "jobs"
    },
    job_status_stages: {
      model: "JobStatusStage",
      name_field: :id,
      match_fields: [:job_type_id, :job_status_id, :job_stage_id],
      sync_fields: [:job_type_id, :job_status_id, :job_stage_id, :position, :is_required],
      description: "Job status to stage mappings",
      group: "jobs"
    },

    # ============================================================================
    # Documents Group
    # ============================================================================
    document_types: {
      model: "DocumentType",
      name_field: :name,
      match_fields: [:name, :scope],
      sync_fields: [:name, :scope, :file_name, :display_name, :abbreviation, :category,
                    :folder, :primary_tab, :aliases, :requires_filing, :supports_versioning,
                    :generates_certificate, :certificate_template, :form_number_mapping,
                    :description, :active],
      description: "Document type definitions and naming templates",
      group: "documents"
    },
    document_templates: {
      model: "DocumentTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :category, :output_format, :output_naming_pattern,
                    :data_schema, :is_active, :sort_order, :template_type, :layout,
                    :is_legal_format, :legal_source, :local_template_path],
      description: "Document generation templates",
      group: "documents"
    },

    # ============================================================================
    # Contacts Group
    # ============================================================================
    contact_types: {
      model: "ContactType",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :display_name, :tab_label, :description, :active, :position],
      description: "Contact type classifications",
      group: "contacts"
    },
    contacts: {
      model: "Contact",
      name_field: :display_name,
      match_fields: [:display_name],
      sync_fields: [:display_name, :company_name_or_trust, :first_name, :last_name,
                    :abn, :acn, :website, :email_domains, :address, :city, :state, :postcode,
                    :bank_bsb, :bank_account_number, :bank_account_name,
                    :default_purchase_account, :default_sales_account, :payment_terms,
                    :is_active, :entity_type, :notes, :contact_code],
      description: "Contacts (suppliers, customers)",
      group: "contacts",
      # Auto-include related price_histories when syncing price_only contacts
      auto_include_related: :price_histories
    },
    price_histories: {
      model: "PriceHistory",
      name_field: :id,
      match_fields: [:pricebook_item_id, :supplier_id, :new_price],
      sync_fields: [:pricebook_item_id, :supplier_id, :old_price, :new_price, :change_reason,
                    :quote_reference, :lga, :date_effective, :user_name],
      description: "Supplier price history records",
      group: "contacts",
      # FK remapping needed during sync
      remap_fks: {
        supplier_id: { model: "Contact", match_field: :display_name },
        pricebook_item_id: { model: "PricebookItem", match_field: :item_code }
      }
    },

    # ============================================================================
    # Schedule Master Group
    # ============================================================================
    sm_schedule_master_templates: {
      model: "SmScheduleMasterTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :is_default, :is_active],
      description: "Schedule Master templates",
      group: "schedule"
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
      description: "Schedule Master task templates",
      group: "schedule"
    },
    sm_trades: {
      model: "SmTrade",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name],
      description: "Schedule Master trades",
      group: "schedule"
    },

    # ============================================================================
    # Operations Group
    # ============================================================================
    meeting_types: {
      model: "MeetingType",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :category, :icon, :color, :default_duration_minutes,
                    :required_participant_types, :optional_participant_types,
                    :minimum_participants, :maximum_participants, :default_agenda_items,
                    :required_fields, :optional_fields, :custom_fields, :required_documents,
                    :notification_settings, :is_active, :is_system_default],
      description: "Meeting type definitions",
      group: "operations"
    },
    pricebook_categories: {
      model: "PricebookCategory",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :parent_id, :position, :icon, :color],
      description: "Pricebook organization categories",
      group: "operations"
    },
    pricebook_items: {
      model: "PricebookItem",
      name_field: :item_name,
      match_fields: [:item_code],
      sync_fields: [:item_code, :item_name, :category, :unit_of_measure, :current_price,
                    :brand, :notes, :is_active, :supplier_price, :colour, :colour_code,
                    :colour_brand, :lead_time_days, :call_time_days, :gst_code,
                    :requires_photo, :requires_spec],
      description: "Pricebook products and pricing",
      group: "operations"
    },
    public_holidays: {
      model: "PublicHoliday",
      name_field: :name,
      match_fields: [:name, :date],
      sync_fields: [:name, :date, :region, :description, :recurring],
      description: "Regional public holidays",
      group: "operations"
    },

    # ============================================================================
    # Warehouse Group
    # ============================================================================
    warehouse_folders: {
      model: "WarehouseFolder",
      name_field: :display_name,
      match_fields: [:warehouse_type, :tab_key],
      sync_fields: [:warehouse_type, :tab_key, :display_name, :description, :tab_group,
                    :parent_id, :entity_filters, :order_position, :enabled, :icon_name,
                    :component_name, :is_system_tab, :warehouse_enabled, :display_code,
                    :uses_custom_path, :warehouse_type_override, :is_photo_category,
                    :display_mode, :hidden_by_default, :is_cad_category, :xero_scope,
                    :visibility_rule, :download_name, :folder_path, :ui_name, :warehouse_folder],
      description: "Warehouse folder tabs and structure",
      group: "warehouse"
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

  # Group display names for UI
  GROUP_LABELS = {
    "jobs" => "Jobs",
    "documents" => "Documents",
    "contacts" => "Contacts",
    "schedule" => "Schedule Master",
    "operations" => "Operations",
    "warehouse" => "Warehouse"
  }.freeze

  # List all available config tables with counts
  def available_tables
    CONFIG_TABLES.map do |key, config|
      {
        key: key.to_s,
        model: config[:model],
        description: config[:description],
        name_field: config[:name_field].to_s,
        group: config[:group]
      }
    end
  end

  # Get group definitions for UI
  def self.groups
    GROUP_LABELS.map { |key, label| { key: key, label: label } }
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
    # Use Tenant model (new multi-tenancy) instead of CorporateGroup
    # Order by ID (1, 2, 3) for consistent display
    tenants = Tenant.order(:id)
    counts = {}

    CONFIG_TABLES.each do |key, config|
      model = config[:model].constantize
      counts[key.to_s] = {}

      tenants.each do |t|
        count = ActsAsTenant.with_tenant(t) { model.count }
        counts[key.to_s][t.slug || t.id.to_s] = count
      end

      # Also count NULL tenant records (unscoped)
      counts[key.to_s]["null"] = model.unscoped.where(tenant_id: nil).count
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
  # Options:
  #   replace_existing_prices: boolean - For price_histories, delete existing prices for
  #                                       the same supplier+item before importing
  def import_from_tenant(source_tenant:, table:, record_ids:, replace_existing_prices: false)
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
    deleted_count = 0

    # Get source records
    source_records = ActsAsTenant.with_tenant(source_tenant) do
      model.where(id: record_ids)
    end

    # For price_histories with replace mode, delete existing prices for the same supplier+item
    if table.to_sym == :price_histories && replace_existing_prices
      deleted_count = delete_existing_price_histories(source_tenant, source_records)
      Rails.logger.info "[ConfigSync] Deleted #{deleted_count} existing price histories before import"
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

    # Auto-sync related price histories for contacts
    price_history_result = nil
    if table.to_sym == :contacts && config[:auto_include_related] == :price_histories
      imported_contact_ids = imported.map(&:id)
      # Get the source contact IDs that were just imported
      source_contact_ids = source_records.select { |r| imported.any? { |i| i.display_name == r.display_name } }.map(&:id)
      price_history_result = sync_related_price_histories(source_tenant, source_contact_ids)
      @errors.concat(price_history_result[:errors]) if price_history_result[:errors].any?
    end

    result = {
      success: @errors.empty?,
      imported: imported.map { |r| record_to_json(r, config) },
      skipped: skipped,
      errors: @errors,
      deleted_count: deleted_count
    }

    # Include price history sync results if applicable
    if price_history_result
      result[:price_histories] = {
        imported: price_history_result[:imported].length,
        skipped: price_history_result[:skipped].length
      }
    end

    result
  end

  # Delete existing price histories in TEEEM that match the supplier+item combinations being imported
  def delete_existing_price_histories(source_tenant, source_records)
    return 0 if source_records.empty?

    # Build a map of supplier_id -> display_name from source tenant
    source_supplier_ids = source_records.map { |r| r.supplier_id }.compact.uniq
    source_supplier_names = ActsAsTenant.with_tenant(source_tenant) do
      Contact.where(id: source_supplier_ids).pluck(:id, :display_name).to_h
    end

    # Build a map of pricebook_item_id -> item_code from source tenant
    source_item_ids = source_records.map { |r| r.pricebook_item_id }.compact.uniq
    source_item_codes = ActsAsTenant.with_tenant(source_tenant) do
      PricebookItem.where(id: source_item_ids).pluck(:id, :item_code).to_h
    end

    # Find matching TEEEM contacts and items
    ActsAsTenant.with_tenant(tenant) do
      teeem_contacts = Contact.where(display_name: source_supplier_names.values).pluck(:display_name, :id).to_h
      teeem_items = PricebookItem.where(item_code: source_item_codes.values).pluck(:item_code, :id).to_h

      # Build list of TEEEM supplier_id + pricebook_item_id combinations to delete
      delete_conditions = []
      source_records.each do |record|
        supplier_name = source_supplier_names[record.supplier_id]
        item_code = source_item_codes[record.pricebook_item_id]

        teeem_supplier_id = teeem_contacts[supplier_name]
        teeem_item_id = teeem_items[item_code]

        if teeem_supplier_id && teeem_item_id
          delete_conditions << { supplier_id: teeem_supplier_id, pricebook_item_id: teeem_item_id }
        end
      end

      # Delete existing price histories for these combinations
      deleted = 0
      delete_conditions.uniq.each do |condition|
        deleted += PriceHistory.where(condition).delete_all
      end
      deleted
    end
  end

  # ============================================================================
  # Pull Operations (Tenant pulling from TEEEM)
  # ============================================================================

  # Pull selected records from master tenant
  # mode: :add_new - only add records that don't exist
  #       :replace_existing - update existing records with master values
  #       :skip_existing - skip if exists, only add new
  # price_markup_percent: Optional markup percentage to apply to prices (for pricebook sync)
  def pull_from_master(table:, record_ids:, mode: :add_new, price_markup_percent: 0)
    validate_table!(table)
    @errors = []
    @price_markup_percent = price_markup_percent.to_f
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

    # Auto-sync related price histories for contacts pulled from TEEEM
    price_history_result = nil
    if table.to_sym == :contacts && config[:auto_include_related] == :price_histories
      # Get the master contact IDs that were just imported/updated
      synced_records = imported + updated
      master_contact_ids = master_records.select { |r| synced_records.any? { |s| s.display_name == r.display_name } }.map(&:id)
      price_history_result = sync_related_price_histories(master, master_contact_ids)
      @errors.concat(price_history_result[:errors]) if price_history_result[:errors].any?
    end

    result = {
      success: @errors.empty?,
      imported: imported.map { |r| record_to_json(r, config) },
      updated: updated.map { |r| record_to_json(r, config) },
      skipped: skipped,
      errors: @errors,
      price_markup_applied: @price_markup_percent > 0 ? @price_markup_percent : nil
    }

    # Include price history sync results if applicable
    if price_history_result
      result[:price_histories] = {
        imported: price_history_result[:imported].length,
        skipped: price_history_result[:skipped].length
      }
    end

    result
  end

  # ============================================================================
  # Compulsory Sync (for new tenant provisioning)
  # ============================================================================

  # Sync all compulsory records to a new tenant
  # Called during tenant provisioning to auto-sync records marked as compulsory
  #
  # Returns hash with results per table:
  #   { job_types: { imported: 5, skipped: 2 }, document_types: { imported: 10, skipped: 0 }, ... }
  def sync_compulsory_records
    results = {}
    master = master_tenant

    unless master
      Rails.logger.warn "[ConfigSync] No master tenant found, skipping compulsory sync"
      return { success: false, error: "No master tenant found" }
    end

    # Get all compulsory preferences grouped by type
    compulsory_prefs = TenantSyncPreference.compulsory.where(tenant: master)

    # Group by configurable_type
    by_type = compulsory_prefs.group_by(&:configurable_type)

    by_type.each do |model_name, prefs|
      # Find the table key for this model
      table_key = CONFIG_TABLES.find { |_k, v| v[:model] == model_name }&.first
      next unless table_key

      record_ids = prefs.map(&:configurable_id)
      next if record_ids.empty?

      Rails.logger.info "[ConfigSync] Syncing #{record_ids.length} compulsory #{model_name} records to #{tenant.name}"

      begin
        result = pull_from_master(table: table_key, record_ids: record_ids, mode: :add_new)
        results[table_key] = {
          imported: result[:imported]&.length || 0,
          skipped: result[:skipped]&.length || 0,
          errors: result[:errors]
        }
      rescue StandardError => e
        Rails.logger.error "[ConfigSync] Error syncing #{model_name}: #{e.message}"
        results[table_key] = { error: e.message }
      end
    end

    Rails.logger.info "[ConfigSync] Compulsory sync complete for #{tenant.name}: #{results.inspect}"
    { success: true, results: results }
  end

  # Get list of choice records available for new tenant
  # Returns hash: { table_key => [{ id: 1, name: "...", description: "..." }, ...] }
  def available_choice_records
    choices = {}
    master = master_tenant
    return choices unless master

    choice_prefs = TenantSyncPreference.choice.where(tenant: master)
    by_type = choice_prefs.group_by(&:configurable_type)

    by_type.each do |model_name, prefs|
      table_key = CONFIG_TABLES.find { |_k, v| v[:model] == model_name }&.first
      next unless table_key

      config = CONFIG_TABLES[table_key]
      model = model_name.constantize
      record_ids = prefs.map(&:configurable_id)

      records = ActsAsTenant.with_tenant(master) do
        model.where(id: record_ids)
      end

      choices[table_key] = records.map do |r|
        {
          id: r.id,
          name: r.send(config[:name_field]),
          description: config[:description]
        }
      end
    end

    choices
  end

  private

  # ============================================================================
  # Helper Methods
  # ============================================================================

  def master_tenant
    # Use Tenant model (new multi-tenancy) instead of CorporateGroup
    Tenant.find_by(is_master_tenant: true) || Tenant.find_by(slug: "teeem")
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
      attrs = build_sync_attrs(source_record, config)
      attrs.each do |field, value|
        new_record.send("#{field}=", value) if new_record.respond_to?("#{field}=")
      end
      new_record.save!
      { created: true, record: new_record }
    end
  rescue => e
    { created: false, reason: e.message }
  end

  def update_existing_record(existing, source_record, config)
    ActsAsTenant.with_tenant(tenant) do
      attrs = build_sync_attrs(source_record, config)
      existing.update!(attrs)
      { updated: true, record: existing }
    end
  rescue => e
    { updated: false, reason: e.message }
  end

  # Build attributes for sync, including FK remapping if needed
  def build_sync_attrs(source_record, config)
    attrs = {}

    config[:sync_fields].each do |field|
      next unless source_record.respond_to?(field)
      value = source_record.send(field)

      # Check if this field needs FK remapping
      if config[:remap_fks]&.key?(field) && value.present?
        value = remap_foreign_key(field, value, config[:remap_fks][field])
      end

      attrs[field] = value
    end

    # Apply price markup for pricebook-related tables
    model_name = source_record.class.name
    if @price_markup_percent && @price_markup_percent > 0 && model_name.in?(%w[PricebookItem PriceHistory])
      attrs = apply_price_markup(attrs, @price_markup_percent, model_name)
    end

    attrs
  end

  # Apply percentage markup to price fields
  # PricebookItem: current_price, supplier_price
  # PriceHistory: old_price, new_price
  def apply_price_markup(attrs, markup_percent, model_name)
    multiplier = 1 + (markup_percent / 100.0)

    case model_name
    when "PricebookItem"
      attrs[:current_price] = (attrs[:current_price].to_f * multiplier).round(2) if attrs[:current_price].present?
      attrs[:supplier_price] = (attrs[:supplier_price].to_f * multiplier).round(2) if attrs[:supplier_price].present?
    when "PriceHistory"
      attrs[:old_price] = (attrs[:old_price].to_f * multiplier).round(2) if attrs[:old_price].present?
      attrs[:new_price] = (attrs[:new_price].to_f * multiplier).round(2) if attrs[:new_price].present?
    end

    attrs
  end

  # Remap a foreign key from source tenant to target tenant
  def remap_foreign_key(field, source_id, remap_config)
    source_model = remap_config[:model].constantize
    match_field = remap_config[:match_field]

    # Find the source record to get the match value
    source_record = source_model.unscoped.find_by(id: source_id)
    return nil unless source_record

    match_value = source_record.send(match_field)

    # Find the target record in the current tenant
    target_record = ActsAsTenant.with_tenant(tenant) do
      source_model.find_by(match_field => match_value)
    end

    if target_record
      target_record.id
    else
      Rails.logger.warn "[ConfigSync] Could not remap #{field}=#{source_id}: no matching #{source_model} found with #{match_field}=#{match_value}"
      nil
    end
  end

  # Get related price histories for contacts being synced
  # Returns hash: { contact_id => [price_history_ids] }
  def get_related_price_histories(source_tenant, contact_ids)
    return {} if contact_ids.empty?

    ActsAsTenant.with_tenant(source_tenant) do
      PriceHistory
        .where(supplier_id: contact_ids)
        .group_by(&:supplier_id)
        .transform_values { |records| records.map(&:id) }
    end
  end

  # Sync price histories for a list of contacts
  # Called automatically when syncing price_only contacts
  def sync_related_price_histories(source_tenant, contact_ids)
    return { imported: [], skipped: [], errors: [] } if contact_ids.empty?

    config = CONFIG_TABLES[:price_histories]
    model = config[:model].constantize
    imported = []
    skipped = []
    errors = []

    # Get all price histories for these contacts from source tenant
    source_records = ActsAsTenant.with_tenant(source_tenant) do
      PriceHistory.where(supplier_id: contact_ids)
    end

    source_records.each do |source_record|
      begin
        result = create_new_record_with_remap(source_record, config, model)
        if result[:created]
          imported << result[:record]
        else
          skipped << { id: source_record.id, reason: result[:reason] }
        end
      rescue => e
        errors << "Failed to sync price history #{source_record.id}: #{e.message}"
      end
    end

    { imported: imported, skipped: skipped, errors: errors }
  end

  # Create new record with FK remapping
  def create_new_record_with_remap(source_record, config, model)
    ActsAsTenant.with_tenant(tenant) do
      new_record = model.new
      attrs = build_sync_attrs(source_record, config)
      attrs.each do |field, value|
        new_record.send("#{field}=", value) if new_record.respond_to?("#{field}=")
      end
      new_record.save!
      { created: true, record: new_record }
    end
  rescue => e
    { created: false, reason: e.message }
  end
end
