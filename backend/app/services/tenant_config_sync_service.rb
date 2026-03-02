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
  # Groups for UI organization: jobs, documents, contacts, schedule, pricebook, operations, po_templates
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
      group: "jobs",
      remap_fks: {
        sm_schedule_master_template_id: { model: "SmScheduleMasterTemplate", match_field: :name }
      }
    },
    job_statuses: {
      model: "JobStatus",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :color, :is_active, :position],
      description: "Job status workflow states",
      group: "jobs"
    },
    job_stages: {
      model: "JobStage",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :color, :is_active, :position],
      description: "Job stage progression",
      group: "jobs"
    },
    job_type_statuses: {
      model: "JobTypeStatus",
      name_field: :id,
      match_fields: [:job_type_id, :job_status_id],
      sync_fields: [:job_type_id, :job_status_id, :position],
      description: "Job type to status mappings",
      group: "jobs",
      remap_fks: {
        job_type_id: { model: "JobType", match_field: :name },
        job_status_id: { model: "JobStatus", match_field: :name }
      }
    },
    job_status_stages: {
      model: "JobStatusStage",
      name_field: :id,
      match_fields: [:job_type_id, :job_status_id, :job_stage_id],
      sync_fields: [:job_type_id, :job_status_id, :job_stage_id, :position, :is_required],
      description: "Job status to stage mappings",
      group: "jobs",
      remap_fks: {
        job_type_id: { model: "JobType", match_field: :name },
        job_status_id: { model: "JobStatus", match_field: :name },
        job_stage_id: { model: "JobStage", match_field: :name }
      }
    },
    job_tabs: {
      model: "JobTab",
      name_field: :name,
      match_fields: [:slug],
      sync_fields: [:name, :slug, :icon, :position, :is_active],
      description: "Job navigation tabs",
      group: "jobs"
    },

    # ============================================================================
    # Documents Group
    # ============================================================================
    document_types: {
      model: "DocumentType",
      name_field: :name,
      match_fields: [:name, :scope],
      sync_fields: [:name, :scope, :download_name, :ui_name, :abbreviation,
                    :folder, :target_folder, :aliases, :requires_filing, :tracks_signing_status,
                    :generates_certificate, :certificate_template, :form_number_mapping,
                    :description, :active, :file_extensions, :skip_rename,
                    :filename_patterns, :signature_field_config, :retention_years],
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
    folder_templates: {
      model: "FolderTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :template_type, :is_system_default, :is_active],
      description: "Folder structure templates",
      group: "documents"
    },
    claim_invoice_templates: {
      model: "ClaimInvoiceTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :style_key, :is_default, :is_active, :primary_color,
                    :secondary_color, :font_family, :show_logo, :show_company_details,
                    :show_bank_details, :show_payment_terms, :logo_position, :header_style,
                    :header_text, :footer_text, :payment_instructions],
      description: "Claim invoice PDF templates",
      group: "documents"
    },
    invoice_templates: {
      model: "InvoiceTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :sections, :primary_color, :accent_color, :font_family,
                    :paper_size, :orientation, :margins, :output_naming_pattern, :is_active,
                    :is_default, :default_terms, :default_notes, :footer_text, :bank_name,
                    :bank_bsb, :bank_account_number, :bank_account_name],
      description: "Invoice PDF templates",
      group: "documents"
    },
    specification_templates: {
      model: "SpecificationTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :sections, :is_default, :is_active],
      description: "Specification document templates",
      group: "documents"
    },
    colour_selection_templates: {
      model: "ColourSelectionTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :categories, :is_default, :is_active],
      description: "Colour selection sheet templates",
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
      match_fields: [:contact_code],
      sync_fields: [:display_name, :company_name_or_trust, :first_name, :last_name,
                    :abn, :acn, :website, :email_domains, :address, :city, :state, :postcode,
                    :bank_bsb, :bank_account_number, :bank_account_name,
                    :default_purchase_account, :default_sales_account, :payment_terms,
                    :is_active, :entity_type, :notes],
      # FRC: contact_code deliberately excluded from sync_fields — each tenant
      # auto-generates unique codes (C{id}). Syncing master's codes causes collisions
      # with existing contacts. sync_key (display_name) handles cross-tenant matching.
      scope: -> { where(entity_type: "price_only") },  # SSoT: Only sync price_only supplier stubs
      description: "Contacts (price_only suppliers for pricebook)",
      group: "contacts"
    },
    # NOTE: price_histories moved to after pricebook_items (depends on both contacts + pricebook_items existing)

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
    sm_task_groups: {
      model: "SmTaskGroup",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :is_active],
      description: "Schedule Master task groups (PO visibility inheritance)",
      group: "schedule"
    },
    bpmn_processes: {
      model: "BpmnProcess",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :bpmn_xml, :canvas_data, :is_published, :version],
      description: "Workflow process definitions (BPMN)",
      group: "schedule"
    },
    sm_schedule_masters: {
      model: "SmScheduleMaster",
      name_field: :name,
      match_fields: [:name],
      # NOTE: hold, confirm, supplier_confirm EXCLUDED - job-reality flags that
      # should never be true on templates (they represent actual job commitments)
      # NOTE: task_number EXCLUDED from sync_fields - each tenant auto-generates
      # its own sequential task_numbers. Syncing would overwrite local numbering.
      sync_fields: [:name, :description, :sequence_order, :duration_days,
                    :trade, :stage, :pass_fail_enabled, :order_time_days, :call_time_days,
                    :require_photo, :po_required, :critical_po, :has_subtasks,
                    :subtask_count, :subtask_names, :tags, :color, :is_active, :cost_centre,
                    :header_gantt, :assigned_role, :is_claim_task,
                    :claim_percentage, :is_variation, :sm_template_ids, :predecessor_ids,
                    :checklist_id, :spawn_scan_task_id, :start_workflow_id,
                    :complete_workflow_id, :completion_document_type_id, :sm_task_group_id],
      description: "Schedule Master task templates",
      group: "schedule",
      remap_fks: {
        sm_template_ids: { model: "SmScheduleMasterTemplate", match_field: :name, array: true },
        predecessor_ids: { model: "SmScheduleMaster", match_field: :sync_key, array: true },
        trade: { model: "SmTrade", match_field: :name },
        stage: { model: "SmStage", match_field: :name },
        checklist_id: { model: "SupervisorChecklistTemplate", match_field: :sync_key },
        completion_document_type_id: { model: "DocumentType", match_field: :sync_key },
        spawn_scan_task_id: { model: "SmScheduleMaster", match_field: :sync_key },
        start_workflow_id: { model: "BpmnProcess", match_field: :sync_key },
        complete_workflow_id: { model: "BpmnProcess", match_field: :sync_key },
        sm_task_group_id: { model: "SmTaskGroup", match_field: :sync_key }
      }
    },
    sm_trades: {
      model: "SmTrade",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name],
      description: "Schedule Master trades",
      group: "schedule"
    },
    sm_stages: {
      model: "SmStage",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name],
      description: "Schedule Master stages",
      group: "schedule"
    },
    sm_hold_reasons: {
      model: "SmHoldReason",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :color, :icon, :sequence_order, :is_active],
      description: "Schedule Master hold reasons",
      group: "schedule"
    },
    sm_resources: {
      model: "SmResource",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:resource_type, :name, :code, :description, :trade, :hourly_rate,
                    :daily_rate, :unit, :unit_cost, :is_active, :availability_hours_per_day],
      description: "Schedule Master resources",
      group: "schedule",
      remap_fks: {
        trade: { model: "SmTrade", match_field: :name }
      }
    },
    sm_schedule_master_document_types: {
      model: "SmScheduleMasterDocumentType",
      name_field: :id,
      match_fields: [:sm_schedule_master_id, :document_type_id],
      sync_fields: [:sm_schedule_master_id, :document_type_id, :lag_days],
      description: "Schedule Master document type assignments",
      group: "schedule",
      remap_fks: {
        sm_schedule_master_id: { model: "SmScheduleMaster", match_field: :sync_key },
        document_type_id: { model: "DocumentType", match_field: :name }
      }
    },
    sm_schedule_master_related_pos: {
      model: "SmScheduleMasterRelatedPo",
      name_field: :id,
      match_fields: [:sm_schedule_master_id, :related_sm_schedule_master_id],
      sync_fields: [:sm_schedule_master_id, :related_sm_schedule_master_id, :position],
      description: "Schedule Master related PO task links",
      group: "schedule",
      remap_fks: {
        sm_schedule_master_id: { model: "SmScheduleMaster", match_field: :sync_key },
        related_sm_schedule_master_id: { model: "SmScheduleMaster", match_field: :sync_key }
      }
    },

    # ============================================================================
    # Pricebook Group
    # ============================================================================
    pricebook_categories: {
      model: "PricebookCategory",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :display_name, :position, :icon, :color, :is_active],
      description: "Pricebook organization categories",
      group: "pricebook"
    },
    pricebook_brands: {
      model: "PricebookBrand",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :display_name, :color, :icon, :position, :is_active],
      description: "Pricebook brand classifications",
      group: "pricebook"
    },
    pricebook_ranges: {
      model: "PricebookRange",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :display_name, :color, :icon, :position, :is_active],
      description: "Pricebook product ranges",
      group: "pricebook"
    },
    units_of_measure: {
      model: "UnitOfMeasure",
      name_field: :name,
      match_fields: [:code],
      sync_fields: [:code, :name, :description, :sort_order, :is_active],
      description: "Units of measure (global lookup)",
      group: "pricebook"
    },
    gst_codes: {
      model: "GstCode",
      name_field: :name,
      match_fields: [:code],
      sync_fields: [:code, :name, :rate, :xero_tax_types, :active, :position],
      description: "GST/tax code definitions",
      group: "pricebook"
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
      group: "pricebook"
    },
    # price_histories MUST come after contacts + pricebook_items (FK dependencies)
    price_histories: {
      model: "PriceHistory",
      name_field: :id,
      match_fields: [:pricebook_item_id, :supplier_id],
      sync_fields: [:pricebook_item_id, :supplier_id, :old_price, :new_price, :change_reason,
                    :quote_reference, :lga, :date_effective, :user_name],
      scope: -> { where(supplier_id: Contact.where(entity_type: "price_only").select(:id)) },  # SSoT: Only sync prices from price_only suppliers
      description: "Price histories (price_only suppliers only)",
      group: "pricebook",
      remap_fks: {
        supplier_id: { model: "Contact", match_field: :display_name },
        pricebook_item_id: { model: "PricebookItem", match_field: :item_code }
      }
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
    public_holidays: {
      model: "PublicHoliday",
      name_field: :name,
      match_fields: [:name, :date],
      sync_fields: [:name, :date, :region],
      description: "Regional public holidays",
      group: "operations"
    },
    cost_centres: {
      model: "CostCentre",
      name_field: :name,
      match_fields: [:code],
      sync_fields: [:code, :name, :description, :centre_type, :parent_id,
                    :overhead_allocation_percent, :budget_amount, :active, :metadata],
      description: "Cost centre definitions",
      group: "operations",
      remap_fks: {
        parent_id: { model: "CostCentre", match_field: :code }
      }
    },
    tender_headers: {
      model: "TenderHeader",
      name_field: :name,
      match_fields: [:code],
      sync_fields: [:code, :name, :description, :sort_order, :active, :metadata],
      description: "Tender header groupings (top-level containers for tender sections)",
      group: "operations"
    },
    tenders: {
      model: "Tender",
      name_field: :name,
      match_fields: [:code],
      sync_fields: [:code, :name, :description, :section_type, :sort_order, :show_line_items,
                    :section_notes, :active, :default_note, :tender_header_id, :metadata,
                    :attached_document_types],
      description: "Tender section definitions (grouped under tender headers)",
      group: "operations",
      remap_fks: {
        tender_header_id: { model: "TenderHeader", match_field: :code }
      }
    },
    supervisor_checklist_templates: {
      model: "SupervisorChecklistTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :category, :sequence_order, :is_active, :response_type],
      description: "Supervisor checklist item templates",
      group: "operations"
    },
    po_template_packs: {
      model: "PoTemplatePack",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :is_active, :position, :sm_schedule_master_template_id],
      description: "PO template pack definitions",
      group: "po_templates",
      remap_fks: {
        sm_schedule_master_template_id: { model: "SmScheduleMasterTemplate", match_field: :name }
      }
    },
    po_template_items: {
      model: "PoTemplateItem",
      name_field: :name,
      match_fields: [:po_template_pack_id, :name],
      sync_fields: [:po_template_pack_id, :name, :sm_schedule_master_id, :supplier_sync_key,
                    :position, :budget, :notes, :status_on_create, :profit_centre_id],
      description: "PO template pack items (individual PO definitions)",
      group: "po_templates",
      remap_fks: {
        po_template_pack_id: { model: "PoTemplatePack", match_field: :name },
        sm_schedule_master_id: { model: "SmScheduleMaster", match_field: :sync_key },
        profit_centre_id: { model: "ProfitCentre", match_field: :code }
      }
    },
    po_template_line_items: {
      model: "PoTemplateLineItem",
      name_field: :description,
      match_fields: [:po_template_item_id, :line_number],
      sync_fields: [:po_template_item_id, :pricebook_item_id, :pricebook_item_code, :description, :quantity,
                    :unit_price, :gst_code, :line_number],
      description: "PO template line item details",
      group: "po_templates",
      remap_fks: {
        po_template_item_id: { model: "PoTemplateItem", match_field: :sync_key },
        pricebook_item_id: { model: "PricebookItem", match_field: :item_code }
      }
    },

    # ============================================================================
    # Estimating Group
    # ============================================================================
    takeoff_templates: {
      model: "TakeoffTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :description, :category, :is_system, :is_active, :configuration,
                    :usage_count],
      description: "Measurement/takeoff templates for estimating",
      group: "estimating"
    },
    recipe_categories: {
      model: "RecipeCategory",
      name_field: :name,
      match_fields: [:code],
      sync_fields: [:code, :name, :description, :parent_id, :position, :is_active],
      description: "Recipe/assembly categories",
      group: "estimating"
    },
    recipes: {
      model: "Recipe",
      name_field: :name,
      match_fields: [:code],
      sync_fields: [:code, :name, :description, :recipe_type, :status, :recipe_category_id,
                    :cached_total, :version_number, :notes, :metadata],
      description: "Recipe/assembly definitions",
      group: "estimating"
    },
    quantity_variables: {
      model: "QuantityVariable",
      name_field: :display_name,
      match_fields: [:variable_name],
      sync_fields: [:variable_name, :display_name, :category, :data_type, :unit_label,
                    :min_value, :max_value, :default_value, :select_options, :formula,
                    :is_computed, :required_for_po_generation, :is_system_variable,
                    :position, :description],
      description: "Quantity variables for recipe calculations",
      group: "estimating"
    },

    # ============================================================================
    # Finance Group
    # ============================================================================
    xero_chart_of_accounts: {
      model: "XeroChartOfAccount",
      name_field: :account_name,
      match_fields: [:account_code],
      sync_fields: [:account_code, :account_name, :account_type, :tax_type, :description,
                    :active],
      description: "Chart of accounts for Xero mapping",
      group: "finance"
    },

    # ============================================================================
    # Warehouse Group
    # ============================================================================
    warehouse_types: {
      model: "WarehouseType",
      name_field: :display_name,
      match_fields: [:code],
      sync_fields: [:code, :display_name, :description, :icon_name, :folder_path_template,
                    :is_system, :enabled, :order_position, :source_model, :token_config,
                    :records_config],
      description: "Warehouse type definitions (job, contact, corporate, etc.)",
      group: "warehouse"
    },
    warehouse_folders: {
      model: "WarehouseFolder",
      name_field: :display_name,
      match_fields: [:warehouse_type_code, :tab_key],
      sync_fields: [:warehouse_type_id, :tab_key, :name, :display_name, :description, :tab_group,
                    :folder_segment, :parent_id, :entity_filters, :order_position, :enabled,
                    :icon_name, :component_name, :is_system, :warehouse_enabled, :display_code,
                    :uses_custom_path, :warehouse_type_override, :is_photo_category,
                    :display_mode, :hidden_by_default, :is_cad_category, :xero_scope,
                    :visibility_rule, :ui_name_template, :download_name_template,
                    :tab_type, :is_mailbox],
      description: "Warehouse folder tabs and structure",
      group: "warehouse",
      remap_fks: {
        warehouse_type_id: { model: "WarehouseType", match_field: :code },
        parent_id: { model: "WarehouseFolder", match_field: :sync_key }
      }
    },
    warehouse_folder_document_types: {
      model: "WarehouseFolderDocumentType",
      name_field: :id,
      match_fields: [:warehouse_folder_id, :document_type_id],
      sync_fields: [:warehouse_folder_id, :document_type_id, :is_primary,
                    :ui_name_template, :download_name_template],
      description: "Warehouse folder to document type mappings",
      remap_fks: {
        warehouse_folder_id: { model: "WarehouseFolder", match_field: :sync_key },
        document_type_id: { model: "DocumentType", match_field: :name }
      },
      group: "warehouse"
    },

    # ============================================================================
    # WHS Group
    # ============================================================================
    whs_induction_templates: {
      model: "WHSInductionTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :induction_type, :description, :active, :version,
                    :content_sections, :expiry_months, :requires_renewal, :has_quiz,
                    :min_passing_score, :acknowledgment_statement, :metadata],
      description: "WHS induction templates",
      group: "whs"
    },
    whs_inspection_templates: {
      model: "WHSInspectionTemplate",
      name_field: :name,
      match_fields: [:name],
      sync_fields: [:name, :inspection_type, :category, :description,
                    :pass_threshold_percentage, :active, :checklist_items, :metadata],
      description: "WHS inspection templates",
      group: "whs"
    },

    # ============================================================================
    # Email Group
    # ============================================================================
    email_templates: {
      model: "EmailTemplate",
      name_field: :name,
      match_fields: [:name, :category],
      sync_fields: [:name, :subject, :body_html, :body_text, :variables, :category,
                    :is_shared, :position],
      description: "Email templates for notifications and outreach",
      group: "email"
    },

    # ============================================================================
    # Plans Group
    # ============================================================================
    plan_types: {
      model: "PlanType",
      name_field: :name,
      match_fields: [:code],
      sync_fields: [:name, :code, :allows_variants, :notes, :sequence_order, :is_active,
                    :short_name_template, :long_name_template],
      description: "Plan/drawing type definitions",
      group: "plans"
    },
    plan_categories: {
      model: "PlanCategory",
      name_field: :name,
      match_fields: [:code],
      sync_fields: [:name, :code, :is_active, :sequence_order],
      description: "Plan category groupings",
      group: "plans"
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
    "pricebook" => "Pricebook",
    "operations" => "Operations",
    "po_templates" => "PO Templates",
    "estimating" => "Estimating",
    "finance" => "Finance",
    "warehouse" => "Warehouse",
    "whs" => "WHS",
    "email" => "Email",
    "plans" => "Plans"
  }.freeze

  # Derive table dependencies from remap_fks configuration.
  # Returns { "po_template_line_items" => ["po_template_items", "pricebook_items"], ... }
  # This tells the UI which tables must be synced BEFORE a given table.
  def self.table_dependencies
    # Build model → table_key lookup (e.g. "PricebookItem" => "pricebook_items")
    model_to_table = {}
    CONFIG_TABLES.each { |key, config| model_to_table[config[:model]] = key.to_s }

    deps = {}
    CONFIG_TABLES.each do |key, config|
      next unless config[:remap_fks].present?

      table_deps = config[:remap_fks].values.filter_map do |fk_config|
        dep_table = model_to_table[fk_config[:model]]
        # Skip self-referential dependencies (e.g. cost_centres parent_id → CostCentre)
        dep_table if dep_table && dep_table != key.to_s
      end.uniq

      deps[key.to_s] = table_deps if table_deps.any?
    end
    deps
  end

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
      has_tenant = model.column_names.include?("tenant_id")

      master_count = if !has_tenant
        scoped_query(model, config).count
      elsif master
        ActsAsTenant.with_tenant(master) { scoped_query(model, config).count }
      else
        0
      end

      tenant_count = if has_tenant
        ActsAsTenant.with_tenant(tenant) { scoped_query(model, config).count }
      else
        scoped_query(model, config).count
      end

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
      has_tenant = model.column_names.include?("tenant_id")
      counts[key.to_s] = {}

      if has_tenant
        tenants.each do |t|
          count = ActsAsTenant.with_tenant(t) { scoped_query(model, config).count }
          counts[key.to_s][t.slug || t.id.to_s] = count
        end

        # Also count NULL tenant records (unscoped)
        counts[key.to_s]["null"] = model.unscoped.where(tenant_id: nil).count
      else
        # Global lookup table (no tenant_id) - same count for all tenants
        global_count = scoped_query(model, config).count
        tenants.each do |t|
          counts[key.to_s][t.slug || t.id.to_s] = global_count
        end
        counts[key.to_s]["null"] = 0
      end
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
      scoped_query(model, config).order(config[:name_field]).map do |record|
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

    # Get all records from both tenants (respecting scope filters)
    master_all = ActsAsTenant.with_tenant(master) { scoped_query(model, config).to_a }
    tenant_all = ActsAsTenant.with_tenant(tenant) { scoped_query(model, config).to_a }

    # Build indexes (sync_key primary, legacy match_key fallback)
    remap_fks = config[:remap_fks]
    master_index = build_record_index(master_all, match_fields, remap_fks)
    tenant_index = build_record_index(tenant_all, match_fields, remap_fks)

    result = {
      new_records: [],      # In master but not in tenant
      modified_records: [], # In both but different
      deleted_records: [],  # In tenant but not in master
      unchanged_records: [] # Same in both
    }

    matched_tenant_keys = Set.new

    # Find new and modified
    master_all.each do |master_record|
      tenant_record = find_match(master_record, tenant_index, match_fields, remap_fks)

      if tenant_record
        key = record_sync_key(tenant_record) || legacy_match_key(tenant_record, match_fields, remap_fks)
        matched_tenant_keys << key

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
    tenant_all.each do |tenant_record|
      key = record_sync_key(tenant_record) || legacy_match_key(tenant_record, match_fields, remap_fks)
      unless matched_tenant_keys.include?(key)
        result[:deleted_records] << record_to_json(tenant_record, config)
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

  # Compare one table across ALL tenants side-by-side (master tenant only).
  # Returns records grouped by match_key with per-tenant values and changed fields.
  def diff_all_tenants(table)
    validate_table!(table)
    unless tenant.is_master_tenant?
      return { error: "Only master tenant can compare all tenants" }
    end

    config = CONFIG_TABLES[table.to_sym]
    model = config[:model].constantize
    match_fields = config[:match_fields]
    remap_fks = config[:remap_fks]

    # Load all tenants
    all_tenants = Tenant.where(id: Tenant.pluck(:id)).order(:id).to_a
    tenant_infos = all_tenants.map { |t| { id: t.id, name: t.name, slug: t.slug } }

    # Load records from each tenant
    tenant_records = {} # slug => [records]
    tenant_indexes = {} # slug => { key => record }
    all_tenants.each do |t|
      records = ActsAsTenant.with_tenant(t) { scoped_query(model, config).to_a }
      tenant_records[t.slug] = records
      tenant_indexes[t.slug] = build_record_index(records, match_fields, remap_fks)
    end

    # Collect ALL unique match keys across all tenants
    all_keys = Set.new
    key_to_name = {} # match_key => display name for UI
    tenant_records.each do |slug, records|
      records.each do |r|
        key = record_sync_key(r) || legacy_match_key(r, match_fields, remap_fks)
        all_keys << key
        key_to_name[key] ||= r.send(config[:name_field])
      end
    end

    # Build comparison for each key
    result_records = []
    identical_count = 0
    different_count = 0
    partial_count = 0

    all_keys.each do |key|
      # Find record in each tenant
      values = {}
      present_slugs = []
      all_tenants.each do |t|
        record = tenant_indexes[t.slug][key]
        if record
          values[t.slug] = record_to_json(record, config)
          present_slugs << t.slug
        end
      end

      next if present_slugs.empty?

      # Determine status
      if present_slugs.length < all_tenants.length
        # Not in all tenants
        status = "partial"
        partial_count += 1
        changed_fields = []
      else
        # In all tenants — check if they differ
        reference = tenant_records[present_slugs.first].find { |r|
          (record_sync_key(r) || legacy_match_key(r, match_fields, remap_fks)) == key
        }
        has_diff = false
        changed_fields = []

        config[:sync_fields].each do |field|
          field_values = present_slugs.map { |slug|
            rec = tenant_records[slug].find { |r|
              (record_sync_key(r) || legacy_match_key(r, match_fields, remap_fks)) == key
            }
            rec ? normalize_value(rec.send(field)) : nil
          }
          unless field_values.uniq.length <= 1
            has_diff = true
            changed_fields << field.to_s
          end
        end

        if has_diff
          status = "different"
          different_count += 1
        else
          status = "identical"
          identical_count += 1
        end
      end

      result_records << {
        match_key: key,
        name: key_to_name[key],
        status: status,
        values: values,
        changed_fields: changed_fields,
        present_in: present_slugs
      }
    end

    # Sort: different first, then partial, then identical
    order = { "different" => 0, "partial" => 1, "identical" => 2 }
    result_records.sort_by! { |r| [order[r[:status]] || 99, r[:name].to_s] }

    {
      table: table.to_s,
      tenants: tenant_infos,
      records: result_records,
      summary: { identical: identical_count, different: different_count, partial: partial_count }
    }
  end

  # Apply winner selections: for each record, push the winning tenant's version to all other tenants.
  # selections: [{ match_key: "...", winner_slug: "tekna" }]
  def apply_winners(table, selections)
    validate_table!(table)
    unless tenant.is_master_tenant?
      return { error: "Only master tenant can apply winners" }
    end

    config = CONFIG_TABLES[table.to_sym]
    model = config[:model].constantize
    match_fields = config[:match_fields]
    remap_fks = config[:remap_fks]

    all_tenants = Tenant.where(id: Tenant.pluck(:id)).order(:id).to_a
    slug_to_tenant = all_tenants.index_by(&:slug)

    applied = []
    errors = []

    selections.each do |sel|
      match_key = sel[:match_key] || sel["match_key"]
      winner_slug = sel[:winner_slug] || sel["winner_slug"]
      winner_tenant = slug_to_tenant[winner_slug]

      unless winner_tenant
        errors << "Unknown tenant slug: #{winner_slug}"
        next
      end

      # Load the winning record
      winner_record = ActsAsTenant.with_tenant(winner_tenant) do
        scoped_query(model, config).to_a.find { |r|
          (record_sync_key(r) || legacy_match_key(r, match_fields, remap_fks)) == match_key
        }
      end

      unless winner_record
        errors << "Record not found for key '#{match_key}' in #{winner_slug}"
        next
      end

      # Push to every OTHER tenant
      other_tenants = all_tenants.reject { |t| t.slug == winner_slug }
      other_tenants.each do |target_t|
        begin
          # Build target-relative service and push
          target_service = TenantConfigSyncService.new(target_t)
          target_service.upsert_record_from_source(winner_record, config, model, winner_tenant)
        rescue => e
          errors << "Failed to push '#{match_key}' to #{target_t.name}: #{e.message}"
        end
      end

      applied << { match_key: match_key, winner: winner_slug }
    end

    { success: errors.empty?, applied: applied, errors: errors }
  end

  # Upsert a single source record into this service's tenant.
  # Used by apply_winners to push a winning record into each target tenant.
  def upsert_record_from_source(source_record, config, model, source_tenant)
    match_fields = config[:match_fields]
    remap_fks = config[:remap_fks]

    # Build index for the target tenant
    existing_records = ActsAsTenant.with_tenant(tenant) { model.all.to_a }
    existing_index = build_record_index(existing_records, match_fields, remap_fks)

    existing = find_match(source_record, existing_index, match_fields, remap_fks)

    # We need to temporarily set the FK resolve context to source tenant
    # so build_sync_attrs can resolve FKs from source → target
    @fk_resolve_cache = {} # Clear cache for fresh resolution

    attrs = build_sync_attrs(source_record, config)

    ActsAsTenant.with_tenant(tenant) do
      if existing
        existing.update!(attrs)
      else
        new_record = model.new
        attrs.each do |field, value|
          new_record.send("#{field}=", value) if new_record.respond_to?("#{field}=")
        end
        if source_record.respond_to?(:sync_key) && new_record.respond_to?(:sync_key=)
          new_record.sync_key = source_record.sync_key.presence
        end
        new_record.save!
      end
    end
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

    # Get source records (enforce scope filter to prevent importing out-of-scope records)
    source_records = ActsAsTenant.with_tenant(source_tenant) do
      scoped_query(model, config).where(id: record_ids)
    end

    # For price_histories with replace mode, delete existing prices for the same supplier+item
    if table.to_sym == :price_histories && replace_existing_prices
      deleted_count = delete_existing_price_histories(source_tenant, source_records)
      Rails.logger.info "[ConfigSync] Deleted #{deleted_count} existing price histories before import"
    end

    # FRC (Feb 2026): Build record index ONCE before loop, not per-record.
    # Previously import_single_record called model.all.to_a + build_record_index
    # on every iteration — loading the entire table N times (5,163x for price histories).
    existing_records = ActsAsTenant.with_tenant(tenant) { model.all.to_a }
    existing_index = build_record_index(existing_records, config[:match_fields], config[:remap_fks])

    # FRC (Feb 2026): Fix historical contact_code duplicates before importing
    if table.to_sym == :contacts
      fix_duplicate_contact_codes(tenant)
    end

    # FRC (Feb 2026): For self-referential FKs (e.g. warehouse_folders.parent_id),
    # use two-pass import: first import all records WITHOUT the self-ref FK so all
    # warehouse_type_ids are correct, then set parent_id in a second pass.
    self_ref_fks = (config[:remap_fks] || {}).select { |_f, c| c[:model] == config[:model] }
    deferred_parents = {} # record_id => { field => value } for second pass

    # Import each record
    source_records.each do |source_record|
      begin
        # For self-referential FKs: defer parent_id to second pass
        result = import_single_record(source_record, config, model, existing_index,
                                       defer_fields: self_ref_fks.keys)
        if result[:imported]
          imported << result[:record]
          # Store deferred parent values for second pass
          if self_ref_fks.any? && result[:deferred].present?
            deferred_parents[result[:record].id] = result[:deferred]
          end
          # Update index with newly imported record so subsequent matches work
          key = record_sync_key(result[:record]) || legacy_match_key(result[:record], config[:match_fields], config[:remap_fks])
          existing_index[key] = result[:record] if key.present?
        else
          skipped << { name: source_record.send(config[:name_field]), reason: result[:reason] }
        end
      rescue => e
        @errors << "Failed to import #{source_record.send(config[:name_field])}: #{e.message}"
      end
    end

    # Second pass: set deferred self-referential FKs (parent_id) now that all
    # records have correct warehouse_type_ids.
    # ⚠️ Uses update_column to bypass parent_same_warehouse_type validation
    # which fails due to Rails association cache returning stale parent data.
    # Safe because pass 1 already set correct warehouse_type_ids on all records.
    if deferred_parents.any?
      ActsAsTenant.with_tenant(tenant) do
        deferred_parents.each do |record_id, deferred_attrs|
          record = model.find_by(id: record_id)
          next unless record
          begin
            deferred_attrs.each do |field, value|
              # FRC (Feb 2026): If the remap returned nil during pass 1 (parent processed
              # after child), re-compute now that all records exist in the target tenant.
              if value.nil? && self_ref_fks.key?(field)
                source_record = source_records.find { |sr| sr.send(config[:name_field]) == record.send(config[:name_field]) }
                if source_record && source_record.send(field).present?
                  value = remap_foreign_key(field, source_record.send(field), self_ref_fks[field])
                end
              end
              record.update_column(field, value) if value.present?
            end
          rescue => e
            @errors << "Failed to set parent for #{record.send(config[:name_field])}: #{e.message}"
          end
        end
      end
    end

    # Post-import hook: BpmnProcess — rebuild nodes/edges/triggers from bpmn_xml
    if table.to_sym == :bpmn_processes && imported.any?
      ActsAsTenant.with_tenant(tenant) do
        imported.each do |process|
          begin
            process.sync_nodes_from_xml! if process.bpmn_xml.present?
          rescue => e
            @errors << "Failed to sync nodes for workflow '#{process.name}': #{e.message}"
          end
        end
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

      # FRC (Feb 2026): Batch delete instead of one-by-one for performance.
      # Group by supplier_id to reduce number of queries.
      unique_conditions = delete_conditions.uniq
      return 0 if unique_conditions.empty?

      deleted = 0
      unique_conditions.group_by { |c| c[:supplier_id] }.each do |supplier_id, conditions|
        item_ids = conditions.map { |c| c[:pricebook_item_id] }
        deleted += PriceHistory.where(supplier_id: supplier_id, pricebook_item_id: item_ids).delete_all
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

    # Get master records (enforce scope filter to prevent importing out-of-scope records)
    master_records = ActsAsTenant.with_tenant(master) do
      scoped_query(model, config).where(id: record_ids)
    end

    # Get existing tenant records for matching (sync_key primary, legacy fallback)
    tenant_all = ActsAsTenant.with_tenant(tenant) { model.all.to_a }
    existing_index = build_record_index(tenant_all, config[:match_fields], config[:remap_fks])

    # FRC (Feb 2026): Fix historical contact_code duplicates created by previous syncs
    # that copied master codes to tenant (now removed from sync_fields).
    # Regenerate codes as C{id} for any duplicates so update! validations pass.
    if table.to_sym == :contacts
      fix_duplicate_contact_codes(tenant)
    end

    # FRC (Feb 2026): For self-referential FKs (e.g. warehouse_folders.parent_id),
    # use two-pass: first pass without self-ref FK, second pass sets parent_id.
    self_ref_fks = (config[:remap_fks] || {}).select { |_f, c| c[:model] == config[:model] }
    deferred_parents = {} # record_id => { field => value } for second pass

    # Process each master record
    master_records.each do |master_record|
      begin
        existing = find_match(master_record, existing_index, config[:match_fields], config[:remap_fks])

        # Build attrs with FK remapping, deferring self-referential FKs
        attrs = build_sync_attrs(master_record, config)

        # Skip orphaned records where a required FK couldn't be remapped to target tenant.
        # Prevents importing child records whose parent doesn't exist in the target.
        if config[:remap_fks].present?
          orphaned = false
          config[:remap_fks].each do |field, _rc|
            next unless config[:sync_fields].include?(field)
            next unless attrs.key?(field) && attrs[field].nil? && master_record.send(field).present?
            skipped << { name: master_record.send(config[:name_field]), reason: "FK remap failed: #{field}" }
            orphaned = true
            break
          end
          next if orphaned
        end

        deferred = {}
        if self_ref_fks.any?
          self_ref_fks.each_key do |field|
            deferred[field] = attrs.delete(field) if attrs.key?(field)
            attrs[field] = nil  # Clear stale parent_id to avoid validation on existing records
          end
        end

        if existing
          case mode.to_sym
          when :replace_existing
            begin
              ActsAsTenant.with_tenant(tenant) { existing.update!(attrs) }
              updated << existing
              deferred_parents[existing.id] = deferred if deferred.any?
            rescue => e
              skipped << { name: master_record.send(config[:name_field]), reason: e.message }
            end
          when :add_new, :skip_existing
            skipped << { name: master_record.send(config[:name_field]), reason: "Already exists" }
          end
        else
          begin
            ActsAsTenant.with_tenant(tenant) do
              new_record = model.new
              attrs.each do |field, value|
                new_record.send("#{field}=", value) if new_record.respond_to?("#{field}=")
              end
              if master_record.respond_to?(:sync_key) && new_record.respond_to?(:sync_key=)
                new_record.sync_key = master_record.sync_key.presence || master_record.class.build_sync_key(
                  *Array(master_record.class&.sync_key_source || :name).map { |f| master_record.send(f).to_s }
                )
              end
              new_record.save!
              imported << new_record
              deferred_parents[new_record.id] = deferred if deferred.any?
            end
          rescue ActiveRecord::RecordInvalid => e
            # FRC (Feb 2026): Uniqueness collision — find_match didn't find the record
            # but it exists (sync_key diverged). Fall back to finding the colliding record
            # using the sync attrs (actual DB columns), then update it instead.
            if e.message.include?("already been taken") || e.message.include?("has already been") || e.message.include?("already exists")
              fallback = find_uniqueness_collision(model, attrs, config[:match_fields], master_record)

              if fallback
                begin
                  ActsAsTenant.with_tenant(tenant) { fallback.update!(attrs) }
                  updated << fallback
                  deferred_parents[fallback.id] = deferred if deferred.any?
                rescue => update_err
                  skipped << { name: master_record.send(config[:name_field]), reason: update_err.message }
                end
              else
                skipped << { name: master_record.send(config[:name_field]), reason: e.message }
              end
            else
              skipped << { name: master_record.send(config[:name_field]), reason: e.message }
            end
          rescue => e
            skipped << { name: master_record.send(config[:name_field]), reason: e.message }
          end
        end
      rescue => e
        @errors << "Failed to process #{master_record.send(config[:name_field])}: #{e.message}"
      end
    end

    # Second pass: set deferred self-referential FKs (parent_id) now that all
    # records have correct warehouse_type_ids.
    # ⚠️ Uses update_column to bypass parent_same_warehouse_type validation
    # which fails due to Rails association cache returning stale parent data.
    # Safe because pass 1 already set correct warehouse_type_ids on all records.
    if deferred_parents.any?
      ActsAsTenant.with_tenant(tenant) do
        deferred_parents.each do |record_id, deferred_attrs|
          record = model.find_by(id: record_id)
          next unless record
          begin
            deferred_attrs.each do |field, value|
              # FRC (Feb 2026): If the remap returned nil during pass 1 (parent processed
              # after child), re-compute now that all records exist in the target tenant.
              if value.nil? && self_ref_fks.key?(field)
                master_record = master_records.find { |mr| mr.send(config[:name_field]) == record.send(config[:name_field]) }
                if master_record && master_record.send(field).present?
                  value = remap_foreign_key(field, master_record.send(field), self_ref_fks[field])
                end
              end
              record.update_column(field, value) if value.present?
            end
          rescue => e
            @errors << "Failed to set parent for #{record.send(config[:name_field])}: #{e.message}"
          end
        end
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

  # FRC (Feb 2026): Previous config syncs copied master contact_codes to tenant contacts,
  # creating duplicates (e.g. master's "C42" overwrote tenant contact, but tenant already
  # had its own contact with auto-generated "C42"). This blocks ALL updates to those
  # contacts because the uniqueness validation fires on: :update.
  # Fix: regenerate codes to C{id} for the second (and beyond) duplicate.
  def fix_duplicate_contact_codes(target_tenant)
    ActsAsTenant.with_tenant(target_tenant) do
      dup_codes = Contact.where(is_active: true)
                         .group(:contact_code)
                         .having("COUNT(*) > 1")
                         .pluck(:contact_code)

      return if dup_codes.empty?

      fixed = 0
      dup_codes.each do |code|
        # Keep the first (lowest ID), regenerate the rest
        dupes = Contact.where(contact_code: code, is_active: true).order(:id).to_a
        dupes.drop(1).each do |contact|
          new_code = "C#{contact.id}"
          contact.update_column(:contact_code, new_code)
          fixed += 1
        end
      end

      Rails.logger.info "[ConfigSync] Fixed #{fixed} duplicate contact_codes across #{dup_codes.length} codes in tenant #{target_tenant.name}"
    end
  end

  def master_tenant
    # Use Tenant model (new multi-tenancy) instead of CorporateGroup
    Tenant.find_by(is_master_tenant: true) || Tenant.find_by(slug: "teeem")
  end

  def validate_table!(table)
    unless CONFIG_TABLES.key?(table.to_sym)
      raise ArgumentError, "Unknown config table: #{table}. Valid tables: #{CONFIG_TABLES.keys.join(', ')}"
    end
  end

  # Sort records so parents are processed before children for self-referential FKs.
  # Without this, a child's parent might not yet be updated when the child's validation
  # checks parent.warehouse_type_id (warehouse_folders parent_same_warehouse_type).
  def sort_parents_first(records, config)
    self_ref_fks = (config[:remap_fks] || {}).select { |_field, cfg| cfg[:model] == config[:model] }
    return records if self_ref_fks.empty?

    fk_field = self_ref_fks.keys.first # e.g. :parent_id
    records_arr = records.respond_to?(:to_a) ? records.to_a : records

    # Topological sort: nil parent first, then by parent chain depth
    id_set = Set.new(records_arr.map(&:id))
    records_arr.sort_by do |r|
      depth = 0
      current = r
      seen = Set.new
      while current.respond_to?(fk_field) && (pid = current.send(fk_field)).present? && id_set.include?(pid) && !seen.include?(pid)
        seen << pid
        depth += 1
        current = records_arr.find { |rec| rec.id == pid }
        break unless current
      end
      depth
    end
  end

  # Apply config[:scope] lambda if present, otherwise return model.all
  def scoped_query(model, config)
    if config[:scope]
      model.instance_exec(&config[:scope])
    else
      model.all
    end
  end

  # FRC (Feb 2026): Find the record causing a uniqueness collision during sync.
  # Uses two strategies:
  # 1. Try match_fields as DB columns (works for simple fields like contact_code)
  # 2. Try sync attrs from build_sync_attrs (works for scoped uniqueness like
  #    warehouse_folders where name + warehouse_type_id + parent_id must be unique)
  def find_uniqueness_collision(model, attrs, match_fields, source_record)
    ActsAsTenant.with_tenant(tenant) do
      # Strategy 1: match_fields as DB columns (fast, covers most cases)
      db_columns = model.column_names
      match_fields.each do |field|
        next unless db_columns.include?(field.to_s)
        value = source_record.send(field)
        next if value.blank?
        found = model.find_by(field => value) ||
                model.where("LOWER(#{model.connection.quote_column_name(field)}) = ?",
                            value.to_s.downcase.strip).first
        return found if found
      end

      # Strategy 2: Use the remapped sync attrs (actual DB column values)
      # Extract unique-looking column combinations from attrs
      # Try name-based lookups since most uniqueness validations include name
      if attrs[:name].present?
        # Build progressively narrower queries using available FK columns
        query = model.where(name: attrs[:name])
        query = query.where(warehouse_type_id: attrs[:warehouse_type_id]) if attrs.key?(:warehouse_type_id)
        query = query.where(parent_id: attrs[:parent_id]) if attrs.key?(:parent_id)
        found = query.first
        return found if found
      end

      nil
    end
  end

  # Primary matching: use sync_key (immutable, survives renames).
  # Fallback: legacy match_key from match_fields (for records without sync_key yet).
  def record_sync_key(record)
    record.respond_to?(:sync_key) ? record.sync_key.presence : nil
  end

  # Build index of records keyed by BOTH sync_key AND legacy match_key.
  # Returns hash: { key => record }
  #
  # ⚠️ DO NOT SIMPLIFY - Index must contain BOTH keys per record (Feb 2026)
  # ════════════════════════════════════════════════════════════════════════
  # Why: find_match() tries sync_key first, then falls back to legacy_match_key.
  #      If we only index by sync_key (when present), the legacy fallback can
  #      never find the record — causing duplicates when sync_keys diverge
  #      (e.g., source tenant renumbers task_numbers → new sync_keys).
  # ❌ WRONG: key = sync_key || legacy_key (only one key per record)
  # ✅ CORRECT: Index by both keys so fallback matching works
  # ════════════════════════════════════════════════════════════════════════
  def build_record_index(records, match_fields, remap_fks = nil)
    index = {}
    records.each do |r|
      sk = record_sync_key(r)
      lk = legacy_match_key(r, match_fields, remap_fks)
      index[sk] = r if sk.present?
      index[lk] = r if lk.present?
    end
    index
  end

  # Find matching record: sync_key first, then legacy match_key.
  def find_match(record, target_index, match_fields, remap_fks = nil)
    # Try sync_key first
    sk = record_sync_key(record)
    return target_index[sk] if sk && target_index[sk]

    # Legacy match_key (resolves FK IDs to names for cross-tenant matching)
    lk = legacy_match_key(record, match_fields, remap_fks)
    target_index[lk]
  end

  # Build a match key from a record's match_fields.
  # When remap_fks is provided and a match_field is an FK, resolve it to the
  # FK target's match_field value (e.g., job_type_id → "Residential" instead of "45").
  # This makes the key tenant-independent, so records from different tenants can match.
  def legacy_match_key(record, match_fields, remap_fks = nil)
    match_fields.map { |f|
      value = record.send(f)
      # If this field is an FK with remap config, resolve to the target's match value
      if remap_fks&.key?(f) && value.present?
        resolved = resolve_fk_to_match_value(value, remap_fks[f])
        resolved.to_s.downcase.strip
      else
        value.to_s.downcase.strip
      end
    }.join("|")
  end

  # Resolve an FK ID to its target record's match_field value.
  # Uses without_tenant to find the record regardless of which tenant owns it.
  # Cached per (model, id) to avoid N+1 queries when building indexes.
  def resolve_fk_to_match_value(fk_id, remap_config)
    @fk_resolve_cache ||= {}
    cache_key = "#{remap_config[:model]}:#{fk_id}"
    return @fk_resolve_cache[cache_key] if @fk_resolve_cache.key?(cache_key)

    target_model = remap_config[:model].constantize
    match_field = remap_config[:match_field]
    record = ActsAsTenant.without_tenant { target_model.find_by(id: fk_id) }
    @fk_resolve_cache[cache_key] = record&.send(match_field)
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
      sync_key: (record.sync_key if record.respond_to?(:sync_key)),
      created_at: record.created_at,
      updated_at: record.updated_at
    }

    # Add all sync fields
    config[:sync_fields].each do |field|
      json[field] = record.send(field) if record.respond_to?(field)
    end

    json
  end

  def import_single_record(source_record, config, model, existing_index = nil, defer_fields: [])
    # Check if already exists in tenant (master) - sync_key primary, legacy fallback
    # FRC (Feb 2026): Accept pre-built index to avoid N+1 (loading entire table per record).
    # Callers in import_from_tenant build the index once before the loop.
    unless existing_index
      tenant_all = ActsAsTenant.with_tenant(tenant) { model.all.to_a }
      existing_index = build_record_index(tenant_all, config[:match_fields], config[:remap_fks])
    end
    existing = find_match(source_record, existing_index, config[:match_fields], config[:remap_fks])

    # FRC (Feb 2026): Use build_sync_attrs for FK remapping (was missing - raw FK IDs
    # from source tenant were copied directly, causing constraint violations)
    attrs = build_sync_attrs(source_record, config)

    # FRC (Feb 2026): Skip orphaned records where a required FK couldn't be remapped.
    # Without this, reverse sync (tenant → master) imports orphaned child records
    # whose parent doesn't exist in the target, creating duplicates.
    # e.g. PO template line items whose parent item was deleted — remap returns nil.
    if config[:remap_fks].present?
      config[:remap_fks].each do |field, _remap_config|
        next unless config[:sync_fields].include?(field)
        next unless attrs.key?(field) && attrs[field].nil? && source_record.send(field).present?
        # Source had a value but remap returned nil → parent doesn't exist in target
        return { imported: false, reason: "FK remap failed: #{field} (orphaned record)" }
      end
    end

    # FRC (Feb 2026): For self-referential FKs (e.g. warehouse_folders.parent_id),
    # defer those fields to a second pass. First pass sets all other fields (including
    # warehouse_type_id) so the parent validation can pass in the second pass.
    # ⚠️ MUST also nil-out the field on existing records — otherwise the old parent_id
    # remains and validation fires because parent.warehouse_type_id no longer matches
    # the newly-remapped warehouse_type_id.
    deferred = {}
    if defer_fields.any?
      defer_fields.each do |field|
        deferred[field] = attrs.delete(field) if attrs.key?(field)
        attrs[field] = nil  # Clear stale parent_id to avoid validation on existing records
      end
    end

    result = if existing
      # Update existing
      ActsAsTenant.with_tenant(tenant) do
        existing.update!(attrs)
      end
      { imported: true, record: existing }
    else
      # Create new - copy sync_key to establish link
      ActsAsTenant.with_tenant(tenant) do
        new_record = model.new
        attrs.each do |field, value|
          new_record.send("#{field}=", value) if new_record.respond_to?("#{field}=")
        end
        if source_record.respond_to?(:sync_key) && new_record.respond_to?(:sync_key=)
          new_record.sync_key = source_record.sync_key.presence || source_record.class.build_sync_key(
            *Array(source_record.class&.sync_key_source || :name).map { |f| source_record.send(f).to_s }
          )
        end
        new_record.save!
        { imported: true, record: new_record }
      end
    end

    # Attach deferred fields to result for second pass
    result[:deferred] = deferred if deferred.any?
    result
  rescue ActiveRecord::RecordInvalid => e
    # FRC (Feb 2026): Uniqueness collision — match didn't find the record but it exists.
    # This happens when sync_key diverged and match_fields differ slightly.
    # Fallback: find the colliding record using sync attrs (actual DB columns) and update it.
    if e.message.include?("already been taken") || e.message.include?("has already been") || e.message.include?("already exists")
      fallback = find_uniqueness_collision(model, attrs, config[:match_fields], source_record)

      if fallback
        ActsAsTenant.with_tenant(tenant) { fallback.update!(attrs) }
        return { imported: true, record: fallback }
      end
    end
    { imported: false, reason: e.message }
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
      # Copy sync_key from source so the link is established
      if source_record.respond_to?(:sync_key) && new_record.respond_to?(:sync_key=)
        new_record.sync_key = source_record.sync_key.presence || source_record.class.build_sync_key(
          *Array(source_record.class&.sync_key_source || :name).map { |f| source_record.send(f).to_s }
        )
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
        remap_config = config[:remap_fks][field]
        if remap_config[:array] && value.is_a?(Array)
          # JSONB array of FKs (e.g., sm_template_ids) - remap each element
          value = value.filter_map { |id| remap_foreign_key(field, id, remap_config) }
        else
          value = remap_foreign_key(field, value, remap_config)
        end
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
  #
  # FRC (Feb 2026): Uses case-insensitive matching to align with filter_ids_by_existing_fks
  # in the controller. Without this, records could pass the FK filter but fail during remap
  # if there's a case mismatch between source and target values.
  def remap_foreign_key(field, source_id, remap_config)
    source_model = remap_config[:model].constantize
    match_field = remap_config[:match_field]

    # Find the source record to get the match value
    # Use without_tenant to bypass acts_as_tenant scoping completely
    source_record = ActsAsTenant.without_tenant do
      source_model.find_by(id: source_id)
    end

    unless source_record
      Rails.logger.warn "[ConfigSync] Could not remap #{field}=#{source_id}: source #{source_model} not found (unscoped)"
      return nil
    end

    match_value = source_record.send(match_field)

    # Find the target record in the current tenant
    # Try exact match first, fall back to case-insensitive
    target_record = ActsAsTenant.with_tenant(tenant) do
      source_model.find_by(match_field => match_value) ||
        source_model.where("LOWER(#{source_model.connection.quote_column_name(match_field)}) = ?",
                           match_value.to_s.downcase.strip).first
    end

    if target_record
      target_record.id
    else
      Rails.logger.warn "[ConfigSync] Could not remap #{field}=#{source_id}: no matching #{source_model} with #{match_field}=#{match_value.inspect} in tenant #{tenant.name} (#{tenant.id})"
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

    # Get only the latest price per pricebook_item + supplier combo (one per pricebook)
    source_records = ActsAsTenant.with_tenant(source_tenant) do
      PriceHistory
        .where(supplier_id: contact_ids)
        .where("pricebook_item_id IS NOT NULL AND supplier_id IS NOT NULL")
        .select("DISTINCT ON (pricebook_item_id, supplier_id) price_histories.*")
        .order(:pricebook_item_id, :supplier_id, date_effective: :desc, created_at: :desc)
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
