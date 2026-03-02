# frozen_string_literal: true

# SmCanonicalRecord - Single polymorphic table for all canonical SM records
#
# Stores the "master" version of SM group records (tasks, trades, stages, etc.)
# that connected tenants inherit from. Uses JSONB fields for flexible schema.
#
# Three-tier sync model:
#   - Connected group (TEEEM, Tekna, Pilgrim): Bidirectional auto-sync through canonical
#   - New SaaS tenants: One-way forced sync on provision (pull_only)
#   - Local templates: Tenant-only, unaffected by sync
#
class SmCanonicalRecord < ApplicationRecord
  # Valid record types that can be stored as canonical
  RECORD_TYPES = %w[
    SmScheduleMaster
    SmScheduleMasterTemplate
    SmTrade
    SmStage
    SmTaskGroup
    SmHoldReason
    SmResource
    SmScheduleMasterDocumentType
    BpmnProcess
  ].freeze

  # Fields that can be inherited by tenant records (per record type)
  # Used to determine what gets propagated vs what's local-only
  INHERITABLE_FIELDS = {
    "SmScheduleMaster" => %w[
      name description sequence_order duration_days po_required critical_po
      create_po_on_job_start order_time_days call_time_days spawn_order_task
      spawn_call_task has_subtasks subtask_count subtask_names allow_header
      is_active pass_fail_enabled require_photo confirm color tags
      task_code start_workflow_enabled complete_workflow_enabled
      requires_document_to_complete is_claim_task is_variation claim_percentage
      claim_sequence_number claim_invoice_pattern spawn_scan_lag_days
      plan_type_ids document_ref_type_ids
    ],
    "SmScheduleMasterTemplate" => %w[
      name description is_default is_active
      default_builder_margin_percent default_escalation_percent pc_ps_markup_cap_percent
      default_construction_insurance_percent default_overheads_percent default_qleave_rate_percent
      default_builds_contingency_percent default_project_prelims_percent
      default_project_management_percent default_maintenance_fee_percent default_tender_markup_percent
    ],
    "SmTrade" => %w[name],
    "SmStage" => %w[name],
    "SmTaskGroup" => %w[name description is_active],
    "SmHoldReason" => %w[name description color icon sequence_order is_active],
    "SmResource" => %w[
      resource_type name code description trade hourly_rate daily_rate
      unit unit_cost is_active availability_hours_per_day
    ],
    "SmScheduleMasterDocumentType" => %w[lag_days assigned_role],
    "BpmnProcess" => %w[name description version bpmn_xml canvas_data is_published svg_preview]
  }.freeze

  # FK fields stored in fk_sync_keys (per record type)
  FK_FIELDS = {
    "SmScheduleMaster" => %w[
      trade stage cost_centre checklist_id sm_task_group_id spawn_scan_task_id
      start_workflow_id complete_workflow_id completion_document_type_id
      claim_invoice_template_id claim_trading_name_id predecessor_ids
      sm_template_ids po_supplier_id assigned_role
      header_gantt linked_task_ids completion_linked_task_ids
    ],
    "SmScheduleMasterTemplate" => %w[
      claim_stage_template_id
      charge_construction_insurance_sm_ids charge_qleave_sm_ids charge_overheads_sm_ids
      charge_qbcc_insurance_sm_ids charge_builds_contingency_sm_ids charge_project_prelims_sm_ids
      charge_project_management_sm_ids charge_maintenance_fee_sm_ids
      charge_builder_margin_sm_ids charge_escalation_sm_ids charge_pc_ps_cap_sm_ids
      charge_tender_markup_sm_ids charge_po_allocations
    ],
    "SmScheduleMasterDocumentType" => %w[sm_schedule_master_id document_type_id],
    "SmResource" => %w[user_id contact_id asset_id]
  }.freeze

  # Validations
  validates :record_type, presence: true, inclusion: { in: RECORD_TYPES }
  validates :sync_key, presence: true, uniqueness: { scope: :record_type }
  validates :name, presence: true
  validates :version, numericality: { only_integer: true, greater_than: 0 }

  # Scopes
  scope :for_type, ->(type) { where(record_type: type) }
  scope :templates, -> { for_type("SmScheduleMasterTemplate") }
  scope :tasks, -> { for_type("SmScheduleMaster") }
  scope :trades, -> { for_type("SmTrade") }
  scope :stages, -> { for_type("SmStage") }
  scope :task_groups, -> { for_type("SmTaskGroup") }
  scope :hold_reasons, -> { for_type("SmHoldReason") }
  scope :resources, -> { for_type("SmResource") }
  scope :bpmn_processes, -> { for_type("BpmnProcess") }

  # Build a canonical record from a tenant's local record
  def self.create_from_local!(local_record, sync_key: nil)
    record_type = local_record.class.name
    sync_key ||= local_record.try(:sync_key) || ConfigSyncable.build_sync_key(local_record.name)

    fields = extract_fields(local_record)
    fk_sync_keys = extract_fk_sync_keys(local_record)

    # Join tables (e.g. SmScheduleMasterDocumentType) have no name column; use sync_key as fallback
    display_name = local_record.try(:name).presence || sync_key

    create!(
      record_type: record_type,
      sync_key: sync_key,
      name: display_name,
      fields: fields,
      fk_sync_keys: fk_sync_keys,
      version: 1
    )
  end

  # Update canonical from a local record's changes
  def update_from_local!(local_record, changed_fields: nil)
    inheritable = INHERITABLE_FIELDS[record_type] || []
    fields_to_sync = changed_fields ? (changed_fields & inheritable) : inheritable

    new_fields = self.fields.dup
    fields_to_sync.each do |field|
      new_fields[field] = local_record.send(field) if local_record.respond_to?(field)
    end

    # Also update FK sync keys if any FK fields changed
    fk_field_list = FK_FIELDS[record_type] || []
    changed_fks = changed_fields ? (changed_fields & fk_field_list) : fk_field_list
    new_fk_sync_keys = self.fk_sync_keys.dup
    if changed_fks.any?
      new_fk_sync_keys = self.class.extract_fk_sync_keys(local_record, only: changed_fks)
                              .merge(new_fk_sync_keys.except(*changed_fks.map(&:to_s)))
      # Actually merge the other way: new values win
      new_fk_sync_keys = self.fk_sync_keys.merge(
        self.class.extract_fk_sync_keys(local_record, only: changed_fks)
      )
    end

    self.name = local_record.name if fields_to_sync.include?("name")
    self.fields = new_fields
    self.fk_sync_keys = new_fk_sync_keys
    self.version += 1
    self.last_propagated_at = Time.current
    save!
  end

  # Get the inheritable fields for this record's type
  def inheritable_fields
    INHERITABLE_FIELDS[record_type] || []
  end

  # Get the FK fields for this record's type
  def fk_fields
    FK_FIELDS[record_type] || []
  end

  private

  # Extract simple (non-FK) field values from a local record
  def self.extract_fields(record)
    type = record.class.name
    field_names = INHERITABLE_FIELDS[type] || []

    field_names.each_with_object({}) do |field, hash|
      hash[field] = record.send(field) if record.respond_to?(field)
    end
  end

  # Extract FK references as sync_keys from a local record
  def self.extract_fk_sync_keys(record, only: nil)
    type = record.class.name
    fk_field_list = only || FK_FIELDS[type] || []

    fk_field_list.each_with_object({}) do |field, hash|
      hash[field] = resolve_fk_to_sync_key(record, field)
    end
  end

  # Resolve a single FK field to its sync_key representation
  def self.resolve_fk_to_sync_key(record, field)
    case field
    when "trade"
      trade = SmTrade.find_by(id: record.trade)
      trade&.sync_key
    when "stage"
      stage = SmStage.find_by(id: record.stage)
      stage&.sync_key
    when "cost_centre"
      cc = CostCentre.find_by(id: record.cost_centre)
      cc&.sync_key
    when "checklist_id"
      checklist = SupervisorChecklistTemplate.find_by(id: record.checklist_id)
      checklist&.sync_key
    when "sm_task_group_id"
      group = SmTaskGroup.find_by(id: record.sm_task_group_id)
      group&.sync_key
    when "spawn_scan_task_id"
      # Store as canonical_record_id of the referenced task
      ref_task = SmScheduleMaster.find_by(id: record.spawn_scan_task_id)
      ref_task&.canonical_record_id ? { "canonical_record_id" => ref_task.canonical_record_id } : nil
    when "start_workflow_id"
      wf = BpmnProcess.find_by(id: record.start_workflow_id)
      wf&.sync_key
    when "complete_workflow_id"
      wf = BpmnProcess.find_by(id: record.complete_workflow_id)
      wf&.sync_key
    when "completion_document_type_id"
      dt = DocumentType.find_by(id: record.completion_document_type_id)
      dt&.sync_key
    when "claim_invoice_template_id"
      tpl = ClaimInvoiceTemplate.find_by(id: record.claim_invoice_template_id) if defined?(ClaimInvoiceTemplate)
      tpl&.sync_key
    when "claim_trading_name_id"
      tn = TradingName.find_by(id: record.claim_trading_name_id) if defined?(TradingName)
      tn&.sync_key
    when "predecessor_ids"
      # Array of {sync_key, type, lag} instead of {id, type, lag}
      (record.predecessor_ids || []).filter_map do |pred|
        ref = SmScheduleMaster.find_by(id: pred["id"])
        next unless ref&.canonical_record_id
        canonical = SmCanonicalRecord.find_by(id: ref.canonical_record_id)
        next unless canonical
        { "sync_key" => canonical.sync_key, "type" => pred["type"], "lag" => pred["lag"] }
      end
    when "sm_template_ids"
      # Array of sync_keys for templates
      (record.sm_template_ids || []).filter_map do |tid|
        tpl = SmScheduleMasterTemplate.find_by(id: tid)
        tpl&.sync_key
      end
    when "po_supplier_id"
      supplier = Contact.find_by(id: record.po_supplier_id)
      supplier&.sync_key
    when "assigned_role"
      role = Role.find_by(id: record.assigned_role)
      role&.name # Roles are global (no sync_key); store name as stable cross-tenant identifier
    when "sm_schedule_master_id"
      ref = SmScheduleMaster.find_by(id: record.sm_schedule_master_id)
      ref&.canonical_record_id ? { "canonical_record_id" => ref.canonical_record_id } : nil
    when "document_type_id"
      dt = DocumentType.find_by(id: record.document_type_id)
      dt&.sync_key
    when "header_gantt"
      # header_gantt is dual: "Header" string = this IS a header, numeric = parent task ID
      val = record.header_gantt
      return val if val.nil? || val.to_s == "Header"
      # Numeric: resolve as task reference
      ref_task = SmScheduleMaster.find_by(id: val.to_i)
      ref_task&.canonical_record_id ? { "canonical_record_id" => ref_task.canonical_record_id } : val
    when "linked_task_ids"
      # Array of task IDs → array of canonical sync_keys
      (record.linked_task_ids || []).filter_map do |tid|
        ref = SmScheduleMaster.find_by(id: tid)
        next unless ref&.canonical_record_id
        canonical = SmCanonicalRecord.find_by(id: ref.canonical_record_id)
        canonical&.sync_key
      end
    when "completion_linked_task_ids"
      # Array of task IDs → array of canonical sync_keys
      (record.completion_linked_task_ids || []).filter_map do |tid|
        ref = SmScheduleMaster.find_by(id: tid)
        next unless ref&.canonical_record_id
        canonical = SmCanonicalRecord.find_by(id: ref.canonical_record_id)
        canonical&.sync_key
      end
    when "claim_stage_template_id"
      # SmScheduleMasterTemplate FK: link to claim stage template by sync_key
      ct = ClaimStageTemplate.find_by(id: record.claim_stage_template_id)
      ct&.sync_key
    when /\Acharge_\w+_sm_ids\z/
      # SmScheduleMasterTemplate FKs: all 12 charge_*_sm_ids fields
      # Array of SmScheduleMaster IDs → array of canonical sync_keys (via canonical_record_id)
      (record.send(field) || []).filter_map do |tid|
        ref = SmScheduleMaster.find_by(id: tid)
        next unless ref&.canonical_record_id
        canonical = SmCanonicalRecord.find_by(id: ref.canonical_record_id)
        canonical&.sync_key
      end
    when "charge_po_allocations"
      # SmScheduleMasterTemplate FK: { charge_type: { sm_id: pct } } → { charge_type: { sync_key: pct } }
      # Remaps tenant-local SmScheduleMaster IDs to canonical sync_keys so allocations survive cross-tenant sync
      (record.charge_po_allocations || {}).each_with_object({}) do |(charge_type, per_po), result|
        next unless per_po.is_a?(Hash)
        remapped = per_po.each_with_object({}) do |(id_str, pct), out|
          ref = SmScheduleMaster.find_by(id: id_str.to_i)
          next unless ref&.canonical_record_id
          canonical = SmCanonicalRecord.find_by(id: ref.canonical_record_id)
          out[canonical.sync_key] = pct if canonical
        end
        result[charge_type] = remapped unless remapped.empty?
      end
    when "user_id", "contact_id", "asset_id"
      # These are tenant-local and don't sync
      nil
    else
      nil
    end
  end
end
