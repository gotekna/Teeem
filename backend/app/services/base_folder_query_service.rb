# frozen_string_literal: true

# BaseFolderQueryService - Optimized tab loading (SSoT)
#
# This replaces WarehouseFolderQueryService (Feb 2026).
# Queries base_folders table which is now THE ONE SSoT for folder config.
#
# Key optimizations:
# 1. Pre-fetch all tabs in single query
# 2. Batch load document counts via GROUP BY
# 3. Memoize TenantSetting (1 call total)
# 4. Build tree in Ruby memory (no recursive queries)
#
class BaseFolderQueryService
  def initialize(warehouse_type: nil, scope: nil, entity_type: nil, include_disabled: false, tab_group: nil, with_document_types: false)
    # Accept both warehouse_type and scope (scope for backwards compat)
    @warehouse_type = warehouse_type || scope
    @entity_type = entity_type
    @include_disabled = include_disabled
    @tab_group = tab_group
    @with_document_types = with_document_types
  end

  # Returns nested tabs JSON matching the expected format
  def nested_tabs
    # Step 1: Load all tabs for warehouse_type (single query with includes)
    all_tabs = preload_tabs

    # Step 2: Group by parent for tree building
    @children_by_parent_id = all_tabs.group_by(&:parent_id)

    # Step 3: Pre-fetch document counts (single grouped query)
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
    tabs = BaseFolder.for_warehouse_type(@warehouse_type)
                     .includes(:base_folder_document_types, :document_types, :parent, :warehouse_type)

    tabs = tabs.enabled unless @include_disabled
    tabs = tabs.for_entity_type(@entity_type) if @entity_type.present?
    tabs = tabs.for_tab_group(@tab_group) if @tab_group.present?

    result = tabs.to_a

    Rails.logger.info "[BaseFolderQueryService] warehouse_type=#{@warehouse_type}, loaded #{result.size} folders"

    result
  end

  # Single grouped query for document counts
  def preload_document_counts(document_type_ids)
    return {} if document_type_ids.empty?

    counts = WarehouseDocument
      .where("metadata->>'document_type_id' IN (?)", document_type_ids.map(&:to_s))
      .group("metadata->>'document_type_id'")
      .count

    counts.transform_keys(&:to_i)
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
      hash[tab.id] = tab.document_types.map do |dt|
        join = tab.base_folder_document_types.find { |j| j.document_type_id == dt.id }

        effective_ui = join&.ui_name_template.presence || dt.ui_name.presence || tab.ui_name_template.presence
        effective_dl = join&.download_name_template.presence || dt.download_name.presence || tab.download_name_template.presence

        {
          id: dt.id,
          name: dt.name,
          abbreviation: dt.abbreviation,
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
    full_path = tab.full_folder_path

    {
      id: tab.id,
      warehouse_type: tab.warehouse_type_code,
      scope: tab.warehouse_type_code,  # Legacy backwards compat
      tab_key: tab.tab_key,
      name: tab.display_name || tab.name,
      display_name: tab.display_name || tab.name,
      display_code: tab.display_code,
      description: tab.description,
      tab_group: tab.tab_group,
      parent_id: tab.parent_id,
      entity_filters: tab.entity_filters || [],
      order_position: tab.order_position,
      enabled: tab.enabled,
      icon_name: tab.icon_name,
      effective_icon_name: compute_effective_icon_name(tab),
      display_mode: tab.display_mode || 'both',
      hidden_by_default: tab.hidden_by_default,
      component_name: tab.component_name,
      is_system_tab: tab.is_system_tab,
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
      path_preview: tab.path_preview,
      hierarchy_path: full_path,
      document_count: doc_count,
      is_photo_category: tab.is_photo_category,
      is_cad_category: tab.is_cad_category,
      can_delete: tab.can_delete?,
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
