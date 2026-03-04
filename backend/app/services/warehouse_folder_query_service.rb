# frozen_string_literal: true

# WarehouseFolderQueryService - Optimized tab loading (SSoT)
#
# This is THE ONE SSoT for folder queries.
# Queries warehouse_folders table.
#
# Key optimizations:
# 1. Pre-fetch all tabs in single query
# 2. Batch load document counts via GROUP BY
# 3. Memoize TenantSetting (1 call total)
# 4. Build tree in Ruby memory (no recursive queries)
#
class WarehouseFolderQueryService
  def initialize(warehouse_type: nil, scope: nil, entity_type: nil, include_disabled: false, tab_group: nil, with_document_types: false, include_counts: false)
    # Accept both warehouse_type and scope (scope for backwards compat)
    @warehouse_type = warehouse_type || scope
    @entity_type = entity_type
    @include_disabled = include_disabled
    @tab_group = tab_group
    @with_document_types = with_document_types
    @include_counts = include_counts
  end

  # Returns ALL scopes' nested tabs in a single query.
  # FRC (Feb 2026): WarehouseProviderTab was firing 15 parallel requests (one per scope)
  # causing H12 timeouts on staging. This method loads ALL folders once and groups by
  # warehouse_type code, reducing 15 queries to 1.
  def all_scopes_nested_tabs
    # Step 1: Load ALL tabs across all warehouse types (single query)
    all_tabs = WarehouseFolder
      .includes(:warehouse_folder_document_types, :document_types, :parent)
      .eager_load(:warehouse_type)
    all_tabs = all_tabs.enabled unless @include_disabled
    all_tabs = all_tabs.to_a

    Rails.logger.info "[WarehouseFolderQueryService] all_scopes: loaded #{all_tabs.size} folders total"

    # Step 2: Set up shared state for tree building
    @children_by_parent_id = all_tabs.group_by(&:parent_id)
    @document_counts_by_type = {}
    @storage_config = load_storage_config
    @document_types_json_by_tab = build_document_types_json(all_tabs)
    @tabs_by_id = all_tabs.index_by(&:id)

    # Step 3: Group by warehouse_type code and build nested structure per scope
    tabs_by_type = all_tabs.group_by { |t| t.warehouse_type&.code }
    result = {}

    tabs_by_type.each do |type_code, _type_tabs|
      next if type_code.blank?

      # Find root tabs for this warehouse_type
      root_tabs = (_type_tabs.select { |t| t.parent_id.nil? })
        .select { |t| @include_disabled || t.enabled }
        .sort_by(&:order_position)
        .map { |tab| build_tab_json(tab) }

      result[type_code] = root_tabs
    end

    result
  end

  # Returns nested tabs JSON matching the expected format
  def nested_tabs
    # Step 1: Load all tabs for warehouse_type (single query with includes)
    all_tabs = preload_tabs

    # Step 2: Group by parent for tree building
    @children_by_parent_id = all_tabs.group_by(&:parent_id)

    # Step 3: Pre-fetch document counts only when explicitly requested
    # Querying 303K+ WarehouseDocuments is expensive (~15-25s). Skip unless needed.
    if @include_counts
      all_doc_type_ids = all_tabs.flat_map { |t| t.document_types.map(&:id) }.compact.uniq
      @document_counts_by_type = preload_document_counts(all_doc_type_ids)
    else
      @document_counts_by_type = {}
    end

    # Step 4: Memoize storage config (single query)
    @storage_config = load_storage_config

    # Step 5: Pre-build document_types JSON for each tab
    @document_types_json_by_tab = build_document_types_json(all_tabs)

    # Step 6: Build parent lookup for hierarchy traversal
    @tabs_by_id = all_tabs.index_by(&:id)

    # Step 7: If filtering to tabs with document types, identify which tabs to keep
    if @with_document_types
      @tabs_with_documents = Set.new
      all_tabs.each do |tab|
        if tab.document_types.any?
          mark_ancestors_with_documents(tab)
        end
      end
    end

    # Step 8: Build nested structure from root tabs only
    root_tabs = @children_by_parent_id[nil] || []
    result = root_tabs
      .select { |t| @include_disabled || t.enabled }
      .select { |t| !@with_document_types || @tabs_with_documents.include?(t.id) }
      .sort_by(&:order_position)
      .map { |tab| build_tab_json(tab) }

    result
  end

  # Mark tab and all ancestors as having document types
  def mark_ancestors_with_documents(tab)
    current = tab
    while current
      @tabs_with_documents.add(current.id)
      current = @tabs_by_id[current.parent_id]
    end
  end

  private

  # Single query to load all tabs with associations
  def preload_tabs
    tabs = WarehouseFolder.for_warehouse_type(@warehouse_type)
                     .includes(:warehouse_folder_document_types, :document_types, :parent)
                     .eager_load(:warehouse_type)

    tabs = tabs.enabled unless @include_disabled
    tabs = tabs.for_entity_type(@entity_type) if @entity_type.present?
    tabs = tabs.for_tab_group(@tab_group) if @tab_group.present?

    result = tabs.to_a

    Rails.logger.info "[WarehouseFolderQueryService] warehouse_type=#{@warehouse_type}, loaded #{result.size} folders"

    result
  end

  # Single grouped query for document counts
  # FRC (Feb 2026): Was using metadata->>'document_type_id' JSONB extraction which
  # caused full table scan on 139K+ rows (GIN index only helps @> containment).
  # Fix: Use indexed warehouse_folder_document_type_id FK column instead.
  def preload_document_counts(document_type_ids)
    return {} if document_type_ids.empty?

    # Map WFDT IDs to their document_type_id (indexed lookup)
    wfdt_to_dt = WarehouseFolderDocumentType
      .where(document_type_id: document_type_ids)
      .pluck(:id, :document_type_id)

    return {} if wfdt_to_dt.empty?

    wfdt_ids = wfdt_to_dt.map(&:first)

    # Count by indexed FK column (uses index_warehouse_documents_on_warehouse_folder_document_type_id)
    counts_by_wfdt = WarehouseDocument
      .where(warehouse_folder_document_type_id: wfdt_ids)
      .group(:warehouse_folder_document_type_id)
      .count

    # Aggregate back to document_type_id
    result = Hash.new(0)
    wfdt_to_dt.each do |wfdt_id, dt_id|
      result[dt_id] += counts_by_wfdt[wfdt_id] || 0
    end

    result
  end

  # Load storage config once
  def load_storage_config
    config = WarehouseProvider.instance
    {
      root_path: config.root_path.presence || "",
      paths: {
        job: config.path_for(:job),
        task: config.path_for(:task),
        people: config.path_for(:people),
        company: config.path_for(:corporate),
        contacts: config.path_for(:contacts)
      }
    }
  end

  # Pre-build document_types JSON for all tabs
  def build_document_types_json(all_tabs)
    all_tabs.each_with_object({}) do |tab, hash|
      # Pre-build lookup hash to avoid O(n*m) Array.find per document_type
      wfdt_by_doc_type = tab.warehouse_folder_document_types.index_by(&:document_type_id)

      hash[tab.id] = tab.document_types.map do |dt|
        join = wfdt_by_doc_type[dt.id]

        effective_ui = join&.ui_name_template.presence || dt.ui_name.presence || tab.ui_name_template.presence
        effective_dl = join&.download_name_template.presence || dt.download_name.presence || tab.download_name_template.presence

        {
          id: dt.id,
          wfdt_id: join&.id,  # SSoT: WarehouseFolderDocumentType join ID — used by upload to select correct WFDT
          name: dt.name,
          abbreviation: dt.abbreviation,
          tracks_signing_status: dt.tracks_signing_status || false,
          is_primary: join&.is_primary || false,
          ui_name_template: join&.ui_name_template,
          download_name_template: join&.download_name_template,
          effective_ui_name_template: effective_ui,
          effective_download_name_template: effective_dl,
          has_template_overrides: join&.ui_name_template.present? || join&.download_name_template.present?,
          ui_name: effective_ui,
          download_name: effective_dl
        }
      end
    end
  end

  # Build JSON for a single tab (recursively includes children)
  def build_tab_json(tab)
    children_json = build_children_json(tab.id)
    doc_count = compute_document_count(tab)
    full_path = compute_full_folder_path(tab)

    {
      id: tab.id,
      warehouse_type: tab.warehouse_type_code,
      warehouse_type_id: tab.warehouse_type_id,
      warehouse_type_code: tab.warehouse_type_code,
      warehouse_type_name: tab.warehouse_type&.display_name,
      scope: tab.warehouse_type_code,  # Legacy backwards compat
      tab_key: tab.tab_key,
      name: tab.display_name || tab.name,
      display_name: tab.display_name || tab.name,
      display_code: tab.display_code,
      description: tab.description,
      tab_group: tab.tab_group,
      parent_id: tab.parent_id,
      parent_name: tab.parent&.display_name || tab.parent&.name,
      children_count: children_json.size,
      entity_filters: tab.entity_filters || [],
      order_position: tab.order_position,
      enabled: tab.enabled,
      is_system: tab.is_system,
      icon_name: tab.icon_name,
      effective_icon_name: compute_effective_icon_name(tab),
      display_mode: tab.display_mode || 'both',
      hidden_by_default: tab.hidden_by_default,
      component_name: tab.component_name,
      tab_type: tab.tab_type,
      is_mailbox: tab.is_mailbox,
      visibility_rule: tab.visibility_rule,
      warehouse_enabled: tab.warehouse_enabled,
      folder_path: full_path,
      folder_segment: tab.folder_segment,
      folder_path_suffix: tab.folder_path_suffix,
      download_name: tab.download_name_template,
      ui_name: tab.ui_name_template,
      full_warehouse_path: full_path,
      uses_custom_path: tab.uses_custom_path,
      warehouse_type_override: tab.warehouse_type_override,
      path_preview: compute_path_preview(full_path, tab.name),
      hierarchy_path: full_path,
      document_count: doc_count,
      is_photo_category: tab.is_photo_category,
      is_cad_category: tab.is_cad_category,
      is_dynamic: tab.dynamic?,
      dynamic_type: tab.dynamic_type&.to_s,
      folder_path_template: full_path,
      full_path_template: full_path,
      warehouse_folders_count: children_json.size,
      can_delete: compute_can_delete(tab),
      children: children_json,
      document_types: @document_types_json_by_tab[tab.id] || []
    }
  end

  # Build children JSON from pre-grouped data
  def build_children_json(parent_id)
    children = @children_by_parent_id[parent_id] || []
    children
      .select { |c| @include_disabled || c.enabled }
      .select { |c| !@with_document_types || @tabs_with_documents&.include?(c.id) }
      .sort_by(&:order_position)
      .map { |child| build_tab_json(child) }
  end

  # Compute document count from pre-loaded batch data
  def compute_document_count(tab)
    return 0 unless tab.tab_group == 'documents'

    doc_type_ids = tab.document_types.map(&:id)
    return 0 if doc_type_ids.empty?

    doc_type_ids.sum { |id| @document_counts_by_type[id] || 0 }
  end

  # Compute full_folder_path using pre-loaded @tabs_by_id (no DB queries).
  # Replaces tab.full_folder_path which calls ancestor_segment_chain → parent → parent → ...
  # causing N+1 on non-eager-loaded grandparents (Sentry TEEEM-BACKEND-4G).
  def compute_full_folder_path(tab)
    parts = []

    # 1. Warehouse type base template
    wt_base = tab.warehouse_type&.folder_path_template.presence || tab.warehouse_type&.display_name
    parts << wt_base if wt_base.present?

    # 2. Walk up parent chain via pre-loaded hash (zero DB queries)
    segments = []
    current = tab
    while current
      segments.unshift(current.folder_segment) if current.folder_segment.present?
      current = @tabs_by_id[current.parent_id]
    end
    parts.concat(segments)

    # 3. Add user suffix if present
    parts << tab.folder_path_suffix if tab.folder_path_suffix.present?

    parts.compact.join('/')
  end

  # Compute can_delete? using pre-loaded data (no DB queries).
  # Replaces tab.can_delete? which calls children.exists? and
  # warehouse_folder_document_types.exists? (N+1 queries, Sentry TEEEM-BACKEND-4G).
  def compute_can_delete(tab)
    return false if tab.is_system
    return false if (@children_by_parent_id[tab.id] || []).any?
    return false if tab.warehouse_folder_document_types.any?  # already eager-loaded

    true
  end

  # Compute path preview from pre-computed full_path (no DB queries).
  # Replaces tab.path_preview which calls full_path_template → full_folder_path →
  # ancestor_segment_chain → parent.parent... (N+1 per parent level).
  def compute_path_preview(full_path, fallback_name)
    return fallback_name if full_path.blank?

    preview = full_path.dup
    preview.gsub!("{{JobCode}}", "J-001")
    preview.gsub!("{{JobName}}", "Smith Residence")
    preview.gsub!("{{ContactName}}", "John Smith")
    preview.gsub!("{{CompanyCode}}", "ABC")
    preview.gsub!("{{CompanyName}}", "ABC Pty Ltd")
    preview.gsub!("{{CompanyGroup}}", "ABC Group")
    preview.gsub!("{{TaskId}}", "123")
    preview.gsub!("{{TaskName}}", "Site Inspection")
    preview.gsub!("{{CaseId}}", "456")
    preview.gsub!("{{CaseName}}", "Insurance Claim")
    preview.gsub!("{{UserName}}", "John Doe")
    preview.gsub!("{{TabName}}", "Sales")
    preview.gsub!("{{Year}}", Time.current.year.to_s)
    preview.gsub!("{{Month}}", Time.current.strftime("%B"))
    preview.gsub!("{{Mailbox}}", "inbox@example.com")
    preview.gsub!("{{Date}}", Time.current.strftime("%Y-%m-%d"))
    preview
  end

  # Compute effective icon (inherits from parent)
  def compute_effective_icon_name(tab)
    return tab.icon_name if tab.icon_name.present?

    parent = @tabs_by_id[tab.parent_id]
    while parent
      return parent.icon_name if parent.icon_name.present?
      parent = @tabs_by_id[parent.parent_id]
    end

    'Folder'
  end
end

# Backwards compatibility alias
BaseFolderQueryService = WarehouseFolderQueryService
