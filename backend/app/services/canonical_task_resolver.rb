# frozen_string_literal: true

# CanonicalTaskResolver - Resolves canonical sync_keys → tenant-local IDs
#
# When propagating canonical records to a tenant, FK values stored as sync_keys
# must be resolved to that tenant's local IDs. This service handles all FK
# resolution with batched lookups for performance.
#
# Usage:
#   attrs = CanonicalTaskResolver.resolve(canonical_record, tenant_id)
#   local_record.update!(attrs)
#
#   # Or resolve only specific fields:
#   attrs = CanonicalTaskResolver.resolve(canonical_record, tenant_id, only: ["duration_days", "trade"])
#
class CanonicalTaskResolver
  # Maps FK field names to the model/method used to resolve sync_keys → local IDs
  FK_MAPPINGS = {
    "trade" => { model: "SmTrade", column: :id },
    "stage" => { model: "SmStage", column: :id },
    "cost_centre" => { model: "CostCentre", column: :id },
    "checklist_id" => { model: "SupervisorChecklistTemplate", column: :id },
    "sm_task_group_id" => { model: "SmTaskGroup", column: :id },
    "spawn_scan_task_id" => { model: "SmScheduleMaster", via: :canonical_record_id },
    "start_workflow_id" => { model: "BpmnProcess", column: :id },
    "complete_workflow_id" => { model: "BpmnProcess", column: :id },
    "completion_document_type_id" => { model: "DocumentType", column: :id },
    "claim_invoice_template_id" => { model: "ClaimInvoiceTemplate", column: :id, optional: true },
    "claim_trading_name_id" => { model: "TradingName", column: :id, optional: true },
    "po_supplier_id" => { model: "Contact", column: :id },
    "assigned_role" => { model: "Role", column: :id, global: true },
    "predecessor_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :predecessor },
    "sm_template_ids" => { model: "SmScheduleMasterTemplate", column: :id, array: true },
    "sm_schedule_master_id" => { model: "SmScheduleMaster", via: :canonical_record_id },
    "document_type_id" => { model: "DocumentType", column: :id },
    # SmScheduleMasterTemplate: markup PO links and claim template link
    "claim_stage_template_id" => { model: "ClaimStageTemplate", column: :id },
    "charge_construction_insurance_sm_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "charge_qleave_sm_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "charge_overheads_sm_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "charge_qbcc_insurance_sm_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "charge_builds_contingency_sm_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "charge_project_prelims_sm_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "charge_project_management_sm_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "charge_maintenance_fee_sm_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "charge_builder_margin_sm_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "charge_escalation_sm_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "charge_pc_ps_cap_sm_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "charge_tender_markup_sm_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "charge_po_allocations" => { model: "SmScheduleMaster", via: :canonical_record_id, format: :po_allocations },
    "header_gantt" => { model: "SmScheduleMaster", via: :canonical_record_id, format: :header_gantt },
    "linked_task_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id },
    "completion_linked_task_ids" => { model: "SmScheduleMaster", via: :canonical_record_id, array: true, format: :sync_key_to_id }
  }.freeze

  def self.resolve(canonical, tenant_id, only: nil)
    new(canonical, tenant_id, only: only).resolve
  end

  def initialize(canonical, tenant_id, only: nil)
    @canonical = canonical
    @tenant_id = tenant_id
    @only = only
    @sync_key_cache = {} # model_name → { sync_key → local_id }
  end

  def resolve
    attrs = {}

    # 1. Copy simple fields from canonical.fields
    resolve_simple_fields(attrs)

    # 2. Resolve FK sync_keys → local IDs
    resolve_fk_fields(attrs)

    attrs
  end

  private

  def resolve_simple_fields(attrs)
    inheritable = SmCanonicalRecord::INHERITABLE_FIELDS[@canonical.record_type] || []
    fields_to_copy = @only ? (inheritable & @only) : inheritable

    fields_to_copy.each do |field|
      attrs[field] = @canonical.fields[field] if @canonical.fields.key?(field)
    end
  end

  def resolve_fk_fields(attrs)
    fk_fields = SmCanonicalRecord::FK_FIELDS[@canonical.record_type] || []
    fks_to_resolve = @only ? (fk_fields & @only) : fk_fields

    fks_to_resolve.each do |field|
      sync_value = @canonical.fk_sync_keys[field]
      next if sync_value.nil?

      mapping = FK_MAPPINGS[field]
      next unless mapping

      attrs[field] = resolve_single_fk(field, sync_value, mapping)
    end
  end

  def resolve_single_fk(field, sync_value, mapping)
    model_name = mapping[:model]

    # Skip if model doesn't exist (optional dependencies)
    if mapping[:optional]
      begin
        model_name.constantize
      rescue NameError
        return nil
      end
    end

    if field == "assigned_role"
      # Roles are global (no tenant_id, no sync_key); stored by name, resolved by name
      return sync_value.present? ? Role.find_by(name: sync_value)&.id : nil
    elsif mapping[:format] == :po_allocations
      # Nested JSONB { charge_type: { sync_key: pct } } → { charge_type: { local_id: pct } }
      resolve_po_allocations(sync_value)
    elsif mapping[:array] && mapping[:format] == :predecessor
      # Array of {sync_key, type, lag} → [{id, type, lag}]
      resolve_predecessor_array(sync_value, model_name, mapping)
    elsif mapping[:array] && mapping[:format] == :sync_key_to_id
      # Array of sync_keys → [local_ids] via canonical_record_id
      resolve_sync_key_to_id_array(sync_value, model_name)
    elsif mapping[:array]
      # Array of sync_keys → [local_ids]
      resolve_sync_key_array(sync_value, model_name, mapping)
    elsif mapping[:format] == :header_gantt
      # header_gantt: "Header" string passes through, canonical_record_id hash resolves
      resolve_header_gantt(sync_value, model_name)
    elsif mapping[:via] == :canonical_record_id
      # Resolve via canonical_record_id on the local model
      resolve_via_canonical_id(sync_value, model_name)
    else
      # Simple sync_key → local_id
      resolve_sync_key(sync_value, model_name, mapping)
    end
  end

  def resolve_sync_key(sync_key, model_name, mapping)
    return nil if sync_key.blank?

    local = lookup_by_sync_key(model_name, sync_key, global: mapping[:global])
    local&.id
  end

  def resolve_sync_key_array(sync_keys, model_name, mapping)
    return [] unless sync_keys.is_a?(Array)

    sync_keys.filter_map do |sk|
      local = lookup_by_sync_key(model_name, sk, global: mapping[:global])
      local&.id
    end
  end

  def resolve_predecessor_array(predecessors, model_name, _mapping)
    return [] unless predecessors.is_a?(Array)

    predecessors.filter_map do |pred|
      sk = pred["sync_key"]
      next unless sk

      canonical = SmCanonicalRecord.find_by(sync_key: sk, record_type: "SmScheduleMaster")
      next unless canonical

      local = model_name.constantize.find_by(
        canonical_record_id: canonical.id,
        tenant_id: @tenant_id
      )
      next unless local

      { "id" => local.id, "type" => pred["type"], "lag" => pred["lag"] }
    end
  end

  def resolve_via_canonical_id(sync_value, model_name)
    return nil unless sync_value.is_a?(Hash) && sync_value["canonical_record_id"]

    model_name.constantize.find_by(
      canonical_record_id: sync_value["canonical_record_id"],
      tenant_id: @tenant_id
    )&.id
  end

  # header_gantt: "Header" string passes through, canonical_record_id hash resolves to local ID
  def resolve_header_gantt(sync_value, model_name)
    return sync_value if sync_value.is_a?(String) # "Header" passes through
    return resolve_via_canonical_id(sync_value, model_name) if sync_value.is_a?(Hash)
    sync_value # Fallback: pass through as-is
  end

  # Nested JSONB { charge_type: { sync_key: pct } } → { charge_type: { local_id: pct } }
  # Used for charge_po_allocations: remaps canonical SM sync_keys back to local SmScheduleMaster IDs
  def resolve_po_allocations(sync_value)
    return {} unless sync_value.is_a?(Hash)

    sync_value.each_with_object({}) do |(charge_type, per_po), result|
      next unless per_po.is_a?(Hash)
      remapped = per_po.each_with_object({}) do |(sk, pct), out|
        canonical = SmCanonicalRecord.find_by(sync_key: sk, record_type: "SmScheduleMaster")
        next unless canonical
        local = SmScheduleMaster.find_by(canonical_record_id: canonical.id, tenant_id: @tenant_id)
        out[local.id.to_s] = pct if local
      end
      result[charge_type] = remapped unless remapped.empty?
    end
  end

  # Array of sync_keys → [local_ids] resolved via canonical_record_id
  # Used for linked_task_ids and completion_linked_task_ids
  def resolve_sync_key_to_id_array(sync_keys, model_name)
    return [] unless sync_keys.is_a?(Array)

    sync_keys.filter_map do |sk|
      canonical = SmCanonicalRecord.find_by(sync_key: sk, record_type: "SmScheduleMaster")
      next unless canonical

      model_name.constantize.find_by(
        canonical_record_id: canonical.id,
        tenant_id: @tenant_id
      )&.id
    end
  end

  # Cached lookup: find local record by sync_key within current tenant
  def lookup_by_sync_key(model_name, sync_key, global: false)
    cache_key = "#{model_name}:#{global ? 'global' : @tenant_id}"

    @sync_key_cache[cache_key] ||= begin
      model = model_name.constantize
      scope = global ? model.all : model.where(tenant_id: @tenant_id)
      scope.where.not(sync_key: nil).index_by(&:sync_key)
    end

    @sync_key_cache[cache_key][sync_key]
  end
end
