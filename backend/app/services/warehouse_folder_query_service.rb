# frozen_string_literal: true

# WarehouseFolderQueryService - Optimized tab loading (SSoT)
#
# This service eliminates N+1 queries when loading warehouse folders.
# Original: 431 queries for 16 tabs (657ms)
# Optimized: ~5 queries total (<50ms)
#
# Key optimizations:
# 1. Pre-fetch all tabs in single query
# 2. Batch load document counts via GROUP BY
# 3. Memoize TenantSetting (1 call total)
# 4. Build tree in Ruby memory (no recursive queries)
#
class WarehouseFolderQueryService
  def initialize(warehouse_type: nil, scope: nil, entity_type: nil, include_disabled: false, tab_group: nil, with_document_types: false)
    # Accept both warehouse_type and scope (scope for backwards compat)
    @warehouse_type = warehouse_type || scope
    @entity_type = entity_type
    @include_disabled = include_disabled
    @tab_group = tab_group
    @with_document_types = with_document_types
  end

  # Returns nested tabs JSON matching WarehouseFolder#as_nested_json format
  def nested_tabs
    # Step 1: Load all tabs for warehouse_type (single query with includes)
    all_tabs = preload_tabs

    # Step 2: Group by parent for tree building
    @children_by_parent_id = all_tabs.group_by(&:parent_id)

    # Step 3: Pre-fetch document counts (single grouped query)
    # Use preloaded document_types association (not document_type_ids which does pluck)
    all_doc_type_ids = all_tabs.flat_map { |t| t.document_types.map(&:id) }.compact.uniq
    @document_counts_by_type = preload_document_counts(all_doc_type_ids)

    # Step 4: Memoize storage config (single query)
    @storage_config = load_storage_config

    # Step 5: Pre-build document_types JSON for each tab
    @document_types_json_by_tab = build_document_types_json(all_tabs)

    # Step 6: Build parent lookup for hierarchy traversal
    @tabs_by_id = all_tabs.index_by(&:id)

    # Step 7: If filtering to tabs with document types, identify which tabs to keep
    if @with_document_types
      @tabs_with_documents = Set.new
      # Find all tabs that have document types
      all_tabs.each do |tab|
        if tab.document_types.any?
          # Mark this tab and all its ancestors as having documents
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
                    .global
                    .includes(:document_types, :parent)

    tabs = tabs.enabled unless @include_disabled
    tabs = tabs.for_entity_type(@entity_type) if @entity_type.present?
    tabs = tabs.for_group(@tab_group) if @tab_group.present?

    tabs.to_a
  end

  # Single grouped query for document counts
  # SSoT: WarehouseDocument is THE ONE document table (Jan 2026)
  # Document type is stored in metadata JSONB (metadata->>'document_type_id')
  def preload_document_counts(document_type_ids)
    return {} if document_type_ids.empty?

    # Query WarehouseDocument using metadata JSONB for document_type_id
    counts = WarehouseDocument
      .where("metadata->>'document_type_id' IN (?)", document_type_ids.map(&:to_s))
      .group("metadata->>'document_type_id'")
      .count

    # Convert string keys back to integers for lookup
    counts.transform_keys(&:to_i)
  end

  # Load storage config once (eliminates 192 queries)
  # SSoT: Uses WarehouseProvider (not TenantSetting)
  def load_storage_config
    config = WarehouseProvider.instance
    {
      root_path: config.root_path.presence || "",
      # SSoT: warehouse_folders contains full path patterns including identifier
      paths: {
        job: config.path_for(:job),
        task: config.path_for(:task),
        people: config.path_for(:people),
        company: config.path_for(:corporate),
        contacts: config.path_for(:contacts)
      },
      # SSoT: Store full warehouse_folders for path derivation
      warehouse_folders: config.effective_warehouse_folders
    }
  end

  # Pre-build document_types JSON for all tabs
  def build_document_types_json(all_tabs)
    all_tabs.each_with_object({}) do |tab, hash|
      hash[tab.id] = tab.document_types.map do |dt|
        {
          id: dt.id,
          name: dt.name,
          display_name: dt.display_name,
          abbreviation: dt.abbreviation,
          file_name: dt.file_name
        }
      end
    end
  end

  # SSoT: Get resolved warehouse path by substituting folder name into template
  # Template: WarehouseProvider.warehouse_folders (e.g., "Warehousing/{{TeeemXL}}")
  # Folder name: warehouse_folder if set, otherwise display_name
  def derive_warehouse_folder(tab)
    return nil unless tab.warehouse_enabled

    # Get template from SSoT
    warehouse_type = tab.warehouse_type || 'corporate'
    warehouse_type = WarehouseProvider::WAREHOUSE_KEY_ALIASES[warehouse_type] || warehouse_type
    template = @storage_config.dig(:warehouse_folders, warehouse_type)
    return nil unless template.present?

    # SSoT: Use stored warehouse_folder if set, otherwise fall back to display_name
    # warehouse_folder column EXISTS and stores the custom folder path/token
    folder_name = tab.warehouse_folder.presence || tab.display_name.to_s

    # Substitute folder name into template
    template.gsub('{{TeeemXL}}', folder_name).gsub('{{TabName}}', folder_name)
  end

  # Build JSON for a single tab (recursively includes children)
  def build_tab_json(tab)
    # Compute children first (recursive)
    children_json = build_children_json(tab.id)

    # Compute document count from pre-loaded data
    doc_count = compute_document_count(tab)

    # Get warehouse_folder: stored value if set, otherwise derived from template
    derived_folder = derive_warehouse_folder(tab)

    # Compute warehouse paths without additional queries
    warehouse_data = compute_warehouse_data(tab, derived_folder)

    # Build the JSON structure matching WarehouseFolder#as_nested_json exactly
    {
      id: tab.id,
      warehouse_type: tab.warehouse_type,
      scope: tab.warehouse_type,  # Legacy backwards compat
      tab_key: tab.tab_key,
      name: tab.display_name,  # SSoT: Frontend expects 'name'
      display_name: tab.display_name,
      display_code: tab.display_code,
      description: tab.description,
      tab_group: tab.tab_group,
      parent_id: tab.parent_id,
      job_id: tab.job_id,
      entity_filters: tab.entity_filters || [],
      order_position: tab.order_position,
      enabled: tab.enabled,
      icon_name: tab.icon_name,
      effective_icon_name: compute_effective_icon_name(tab),
      display_mode: tab.display_mode || 'both',
      hidden_by_default: tab.hidden_by_default,
      component_name: tab.component_name,
      is_system_tab: tab.is_system_tab,
      # SSoT: Visibility rules - when this tab is shown/hidden
      visibility_rule: tab.visibility_rule,
      # New warehouse naming
      warehouse_enabled: tab.warehouse_enabled,
      # SSoT: Return raw stored warehouse_folder for editing (nil/empty = use display_name default in UI)
      # ⚠️ DO NOT use .presence here - empty string "" must be preserved (user intentionally cleared it)
      warehouse_folder: tab.read_attribute(:warehouse_folder),
      full_warehouse_path: warehouse_data[:full_path],
      uses_custom_path: tab.uses_custom_path,
      warehouse_type_override: tab.warehouse_type_override || 'corporate',
      warehouse_base_path: warehouse_data[:base_path],
      effective_warehouse_path: warehouse_data[:effective_path],
      folder_path: warehouse_data[:upload_path],
      inherited_template: warehouse_data[:inherited_template],
      # LIM: Legacy storage_*/sharepoint_* aliases REMOVED (Jan 2026)
      # Frontend uses warehouse_* fields. Backend services use model methods.
      hierarchy_path: compute_hierarchy_path(tab, derived_folder),
      document_count: doc_count,
      is_photo_category: tab.is_photo_category,
      is_cad_category: tab.is_cad_category,
      can_delete: compute_can_delete(tab, doc_count),
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

    # Use preloaded association (not document_type_ids which does pluck)
    doc_type_ids = tab.document_types.map(&:id)
    return 0 if doc_type_ids.empty?

    doc_type_ids.sum { |id| @document_counts_by_type[id] || 0 }
  end

  # Compute effective icon (inherits from parent)
  def compute_effective_icon_name(tab)
    return tab.icon_name if tab.icon_name.present?

    # Traverse parent chain using pre-loaded data
    parent = @tabs_by_id[tab.parent_id]
    while parent
      return parent.icon_name if parent.icon_name.present?
      parent = @tabs_by_id[parent.parent_id]
    end

    'Folder'  # Default
  end

  # Compute all warehouse-related paths
  # SSoT: derived_folder comes from WarehouseProvider.warehouse_folders (not WarehouseFolder.warehouse_folder)
  def compute_warehouse_data(tab, derived_folder)
    return {} unless tab.warehouse_enabled

    warehouse_type_key = warehouse_type_for_template(tab)
    base_path = compute_base_path(warehouse_type_key)
    inherited_template = @storage_config.dig(:warehouse_folders, tab.warehouse_type)
    effective_path = compute_effective_path(tab, inherited_template, derived_folder)
    upload_path = compute_upload_path(tab, effective_path)

    {
      base_path: base_path,
      inherited_template: inherited_template,
      effective_path: effective_path,
      upload_path: upload_path,
      full_path: derived_folder.present? ? "#{@storage_config[:root_path]}/#{derived_folder}" : nil
    }
  end

  # Map WarehouseFolder warehouse_type to config key
  def warehouse_type_for_template(tab)
    case tab.warehouse_type
    when 'job' then :job
    when 'corporate', 'corporate_entity' then :company  # SSoT: 'corporate' is THE ONE (Jan 2026)
    when 'people', 'contact'
      tab.warehouse_type_override == 'contacts' ? :contacts : :people
    else :job
    end
  end

  # Compute warehouse base path
  def compute_base_path(warehouse_type_key)
    sub_path = @storage_config.dig(:paths, warehouse_type_key)
    return nil unless sub_path

    "#{@storage_config[:root_path].chomp('/')}/#{sub_path.sub(/^\//, '')}"
  end

  # Compute effective warehouse path (handles parent inheritance)
  # SSoT: derived_folder comes from WarehouseProvider.warehouse_folders
  def compute_effective_path(tab, template, derived_folder = nil)
    return nil unless tab.warehouse_enabled

    if tab.uses_custom_path && derived_folder.present?
      # Custom path - use exactly what's derived from SSoT
      derived_folder
    elsif tab.parent_id.present?
      # SSoT: Child tabs inherit from parent path
      parent = @tabs_by_id[tab.parent_id]
      if parent&.warehouse_enabled
        parent_derived = derive_warehouse_folder(parent)
        parent_template = @storage_config.dig(:warehouse_folders, parent.warehouse_type)
        parent_path = compute_effective_path(parent, parent_template, parent_derived)
        return nil unless parent_path.present?
        "#{parent_path}/#{tab.display_name}"
      else
        nil
      end
    else
      # Root tab - use derived folder or template from config
      return derived_folder if derived_folder.present?
      return nil unless template.present?
      resolve_template(template, {
        "Category" => tab.display_name,
        "TabName" => tab.display_name
      })
    end
  end

  # Compute folder path for uploads (strips {{JobCode}} for job warehouse_type)
  def compute_upload_path(tab, effective_path)
    return nil unless effective_path.present?

    if tab.warehouse_type == 'job'
      effective_path.gsub(/\{\{JobCode\}\}\s*\/?/, "").gsub(/^\/+/, "").presence
    else
      effective_path
    end
  end

  # Resolve template placeholders
  def resolve_template(template, values)
    result = template.dup
    values.each { |key, value| result.gsub!("{{#{key}}}", value.to_s) }
    result
  end

  # Compute hierarchy path
  # SSoT: derived_folder comes from WarehouseProvider.warehouse_folders
  def compute_hierarchy_path(tab, derived_folder = nil)
    return derived_folder if derived_folder.present?

    warehouse_type_prefix = case tab.warehouse_type
                            when 'corporate', 'corporate_entity' then 'Corporate'  # SSoT: 'corporate' is THE ONE
                            when 'people' then 'People'
                            when 'job' then 'Jobs'
                            when 'document' then 'Documents'
                            when 'xero' then 'Corporate'
                            else tab.warehouse_type.to_s.titleize
                            end

    # Build tab hierarchy (root to leaf) using pre-loaded data
    tab_parts = []
    current = tab
    while current
      tab_parts.unshift(current.display_name)
      current = @tabs_by_id[current.parent_id]
    end

    ([warehouse_type_prefix] + tab_parts).join('/')
  end

  # Compute can_delete
  def compute_can_delete(tab, doc_count)
    return false if tab.is_system_tab
    doc_count == 0
  end
end
