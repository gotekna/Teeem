# frozen_string_literal: true

# WarehouseFolderPathLookup - SSoT for computing warehouse folder paths
#
# ⚠️ DO NOT SIMPLIFY - N+1 prevention (Feb 2026)
# ════════════════════════════════════════════════════════════════════
# Why: Model methods like full_folder_path, full_ancestor_path, and
# path_preview walk up the parent chain using current.parent, which
# triggers a DB query per parent level per folder. With 500+ folders
# nested 2-3 levels deep, this caused ~1,000 extra queries on
# /api/v1/warehouse_types, /api/v1/document_types, and
# /api/v1/warehouse_folders endpoints (H12 timeouts, R14 OOM).
#
# Solution: Pre-load ALL warehouse folders into a hash (1 query total),
# then compute paths by walking the hash in pure Ruby.
#
# ❌ WRONG: wf.full_folder_path (walks parent chain via DB, N+1)
# ❌ WRONG: tab.full_ancestor_path (same)
# ❌ WRONG: tab.path_preview (calls full_folder_path internally)
# ✅ CORRECT: lookup_full_folder_path(wf) (pre-loaded hash, 0 queries)
# ════════════════════════════════════════════════════════════════════
#
# Included by:
#   - Api::V1::WarehouseTypesController
#   - Api::V1::DocumentTypesController
#   - Api::V1::WarehouseFoldersController
#
module WarehouseFolderPathLookup
  extend ActiveSupport::Concern

  private

  # Load all warehouse folders into memory for O(1) parent chain lookups.
  # One query loads ~500-600 rows with only the columns needed for path computation.
  def preload_folder_lookup!
    @_folder_lookup ||= begin
      rows = WarehouseFolder.pluck(:id, :parent_id, :name, :folder_segment, :display_name)
      rows.each_with_object({}) do |(id, parent_id, name, folder_segment, display_name), hash|
        hash[id] = { parent_id: parent_id, name: name, folder_segment: folder_segment, display_name: display_name }
      end
    end
  end

  # Equivalent to build_ancestor_path: walks parent chain using names.
  # Returns: "Grandparent/Parent/Self"
  def lookup_ancestor_path(warehouse_folder)
    preload_folder_lookup!
    parts = []
    current_id = warehouse_folder.id
    while current_id
      entry = @_folder_lookup[current_id]
      break unless entry
      parts.unshift(entry[:name])
      current_id = entry[:parent_id]
    end
    parts.join('/')
  end

  # Equivalent to full_ancestor_path: walks parent chain using folder_segments.
  # Returns: "grandparent_segment/parent_segment/self_segment"
  def lookup_full_ancestor_path(warehouse_folder)
    preload_folder_lookup!
    segments = []
    current_id = warehouse_folder.id
    while current_id
      entry = @_folder_lookup[current_id]
      break unless entry
      segments.unshift(entry[:folder_segment]) if entry[:folder_segment].present?
      current_id = entry[:parent_id]
    end
    segments.join('/')
  end

  # Equivalent to full_folder_path: warehouse type prefix + ancestor segments.
  # Returns: "Job/{{JobCode}}/{{JobName}}/Photo/Supervisor"
  def lookup_full_folder_path(warehouse_folder, warehouse_type = nil)
    wt = warehouse_type || warehouse_folder.warehouse_type
    wt_base = wt&.folder_path_template.presence || wt&.display_name

    ancestor_path = lookup_full_ancestor_path(warehouse_folder)

    parts = []
    parts << wt_base if wt_base.present?
    parts << ancestor_path if ancestor_path.present?
    parts.join('/')
  end

  # Equivalent to build_folder_name_path: walks parent chain using display_names.
  # Returns: "Photo Documents/Supervisor Photos"
  def lookup_folder_name_path(warehouse_folder)
    preload_folder_lookup!
    parts = []
    current_id = warehouse_folder.id
    while current_id
      entry = @_folder_lookup[current_id]
      break unless entry
      parts.unshift(entry[:display_name].presence || entry[:name])
      current_id = entry[:parent_id]
    end
    parts.join('/')
  end

  # Equivalent to path_preview: applies template token substitutions to full_folder_path.
  # Returns: "Job/J-001/Smith Residence/Photo/Supervisor"
  def lookup_path_preview(warehouse_folder, warehouse_type = nil)
    template = lookup_full_folder_path(warehouse_folder, warehouse_type)
    return warehouse_folder.name if template.blank?

    apply_path_preview_tokens(template)
  end

  # Apply template token substitutions to any path string.
  # Shared by lookup_path_preview and services that pre-compute paths.
  def apply_path_preview_tokens(template)
    preview = template.dup
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
end
