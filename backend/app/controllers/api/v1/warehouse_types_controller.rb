# frozen_string_literal: true

module Api
  module V1
    # WarehouseTypesController - CRUD for warehouse types
    #
    # SSoT: Database-driven warehouse types (Feb 2026)
    # Replaces the hardcoded WAREHOUSE_TYPES constant with database table
    #
    class WarehouseTypesController < ApplicationController
      before_action :set_warehouse_type, only: [:show, :update, :destroy, :update_warehouse_folders]
      before_action :set_warehouse_type_by_code, only: [:records]

      # GET /api/v1/warehouse_types
      def index
        # SSoT (Feb 2026): Eager load document_types for warehouse_folders to avoid N+1
        @warehouse_types = WarehouseType.includes(warehouse_folders: [:document_types, :warehouse_folder_document_types, :parent]).visible

        # Filter by enabled status
        @warehouse_types = @warehouse_types.enabled unless params[:include_disabled] == "true"

        # Filter by system/custom
        @warehouse_types = @warehouse_types.system_types if params[:system_only] == "true"
        @warehouse_types = @warehouse_types.custom_types if params[:custom_only] == "true"

        render json: {
          success: true,
          data: @warehouse_types.ordered.map { |wt| serialize_warehouse_type(wt) },
          summary: warehouse_type_summary
        }
      end

      # GET /api/v1/warehouse_types/options
      # Returns warehouse types formatted for select dropdowns
      def options
        render json: {
          success: true,
          data: WarehouseType.options_for_select
        }
      end

      # GET /api/v1/warehouse_types/tree
      # Returns warehouse types as a tree structure for the File Warehouse page
      #
      # Response structure:
      # {
      #   tree: [
      #     {
      #       id: "wt-job",
      #       code: "job",
      #       displayName: "Job",
      #       iconName: "briefcase",
      #       orderPosition: 1,
      #       warehouseFolders: [{ id: "wf-123", name: "Plans", children: [...] }],
      #       fileCount: 1234
      #     }
      #   ],
      #   counts: { job: 1234, corporate: 500, ... },
      #   total: 80149
      # }
      def tree
        # Get enabled warehouse types with their warehouse folders and nested children
        warehouse_types = WarehouseType.enabled.ordered.includes(
          warehouse_folders: { children: :children }
        )

        # Use materialized path counts when available, fall back to source_type counts
        document_counts = fetch_document_counts
        path_counts = fetch_path_counts_by_warehouse_type

        render json: {
          success: true,
          data: {
            tree: warehouse_types.map { |wt|
              node = warehouse_type_tree_node(wt, document_counts)
              # Enrich with materialized path count if available
              node[:pathFileCount] = path_counts[wt.display_name] || path_counts[wt.code] || 0
              node
            },
            counts: document_counts,
            pathCounts: path_counts,
            total: WarehouseDocument.count,
            materializedCount: WarehouseDocument.where.not(folder_path: nil).count
          }
        }
      end

      # GET /api/v1/warehouse_types/tree/children?path=Job/Active&depth=1
      # Returns children folders at a given depth under a path prefix
      # Uses materialized folder_path for fast tree rendering
      def tree_children
        prefix = params[:path].to_s
        depth = (params[:depth] || 1).to_i
        target_depth = prefix.count("/") + 1 + depth

        children = WarehouseDocument
          .where(tenant_id: current_tenant&.id)
          .where("folder_path LIKE ?", "#{ActiveRecord::Base.sanitize_sql_like(prefix)}/%")
          .where.not(folder_path: nil)
          .group(Arel.sql("split_part(folder_path, '/', #{target_depth})"))
          .count

        # Filter out empty segments
        children.reject! { |k, _| k.blank? }

        render json: {
          success: true,
          data: {
            children: children,
            parentPath: prefix,
            depth: target_depth
          }
        }
      end

      # GET /api/v1/warehouse_types/scoped_tree?linkable_type=Job&linkable_id=123
      # Returns a sub-tree of folders for a specific linked record
      # Used by Job/Contact/Corporate warehouse tabs
      #
      # Three document sources:
      #   1. Direct linkable match (e.g., docs linked to this Job)
      #   2. Documentable match (older docs that use documentable instead of linkable)
      #   3. Cross-linked via "Also show in" + FK chains (e.g., Xero bills linked to Contact
      #      but visible in Job warehouse because document type has secondary folder in Job)
      # ⚠️ DO NOT SIMPLIFY - FK-driven folder counts (Feb 2026 rewrite)
      # ════════════════════════════════════════════════════════════════════
      # Why: The old code parsed folder_path strings, stripped common prefixes,
      #      and tried to match remaining segments to configured folder names.
      #      This broke when: single doc (prefix = full path), root-level docs
      #      (no sub-folder segment), or folder_path missing folder name.
      #
      # The FIX: Use warehouse_folder_id FK (SSoT) to count docs per folder.
      #   warehouse_document.warehouse_folder_id → warehouse_folder.name
      #   No string parsing, no prefix stripping, no name matching.
      #
      # ❌ WRONG: group(:folder_path) → strip prefix → match folder names
      # ✅ CORRECT: group(:warehouse_folder_id) → FK lookup → folder name
      # ════════════════════════════════════════════════════════════════════
      def scoped_tree
        linkable_type = params[:linkable_type]
        linkable_id = params[:linkable_id]

        # Direct linkable match
        docs = WarehouseDocument
          .where(tenant_id: current_tenant&.id)
          .where(linkable_type: linkable_type, linkable_id: linkable_id)

        # Also check documentable (some older docs use documentable instead of linkable)
        documentable_docs = WarehouseDocument
          .where(tenant_id: current_tenant&.id)
          .where(documentable_type: linkable_type, documentable_id: linkable_id)

        # Cross-linked documents via "Also show in" config + FK chains
        cross_docs = cross_linked_documents(linkable_type, linkable_id)

        # Combine all document IDs
        direct_ids = (docs.pluck(:id) + documentable_docs.pluck(:id)).uniq
        cross_ids = cross_docs.pluck(:id)
        combined_ids = (direct_ids + cross_ids).uniq

        if combined_ids.empty?
          return render json: {
            success: true,
            data: { tree: {}, prefix: nil, documentCount: 0 }
          }
        end

        # SSoT: Count docs per warehouse_folder_id (FK-driven, no string parsing)
        folder_id_counts = WarehouseDocument.where(id: combined_ids)
          .where.not(warehouse_folder_id: nil)
          .group(:warehouse_folder_id)
          .count

        # Map warehouse_folder_id → folder name (with parent path for nested folders)
        folder_counts = {}
        folder_id_counts.each do |wf_id, count|
          wf = WarehouseFolder.find_by(id: wf_id)
          next unless wf
          # Build name path: for nested folders use "Parent/Child" so
          # getFolderDocCount("Parent") matches via startsWith
          name_path = build_folder_name_path(wf)
          folder_counts[name_path] = (folder_counts[name_path] || 0) + count
        end

        # Count docs without a warehouse_folder_id (unsorted)
        unsorted = WarehouseDocument.where(id: combined_ids, warehouse_folder_id: nil).count
        folder_counts[""] = unsorted if unsorted > 0

        render json: {
          success: true,
          data: {
            tree: folder_counts,
            prefix: nil,
            documentCount: combined_ids.size
          }
        }
      end

      # GET /api/v1/warehouse_types/:id
      def show
        render json: {
          success: true,
          data: serialize_warehouse_type(@warehouse_type)
        }
      end

      # POST /api/v1/warehouse_types
      def create
        @warehouse_type = WarehouseType.new(warehouse_type_params)

        if @warehouse_type.save
          render json: {
            success: true,
            data: serialize_warehouse_type(@warehouse_type)
          }, status: :created
        else
          render json: {
            success: false,
            errors: @warehouse_type.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # PATCH/PUT /api/v1/warehouse_types/:id
      def update
        old_template = @warehouse_type.folder_path_template

        if @warehouse_type.update(warehouse_type_params)
          # SSoT: Cascade folder_path_template changes to warehouse_folders
          new_template = @warehouse_type.folder_path_template
          if old_template != new_template
            cascade_template_change(old_template, new_template)
          end

          render json: {
            success: true,
            data: serialize_warehouse_type(@warehouse_type)
          }
        else
          render json: {
            success: false,
            errors: @warehouse_type.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # DELETE /api/v1/warehouse_types/:id
      def destroy
        if @warehouse_type.is_system
          return render json: {
            success: false,
            error: "System warehouse types cannot be deleted"
          }, status: :forbidden
        end

        unless @warehouse_type.can_delete?
          return render json: {
            success: false,
            error: "Cannot delete warehouse type with associated warehouse folders or document types"
          }, status: :unprocessable_entity
        end

        @warehouse_type.destroy
        render json: { success: true }
      end

      # PATCH /api/v1/warehouse_types/:id/update_warehouse_folders
      # Batch update warehouse folder assignments for a warehouse type
      #
      # Folders removed from this type are moved to the "unassigned" type
      # (warehouse_type_id has NOT NULL constraint, so folders must belong somewhere)
      def update_warehouse_folders
        warehouse_folder_ids = params[:warehouse_folder_ids] || []

        ActiveRecord::Base.transaction do
          # Move removed folders to unassigned type (instead of deleting)
          removed_folders = @warehouse_type.warehouse_folders.where.not(id: warehouse_folder_ids)
          if removed_folders.exists?
            unassigned_type = WarehouseType.find_by(code: WarehouseType::UNASSIGNED_CODE)
            unless unassigned_type
              unassigned_type = WarehouseType.create!(
                code: WarehouseType::UNASSIGNED_CODE,
                display_name: "Unassigned",
                description: "System type for unassigned warehouse folders",
                is_system: true,
                enabled: false,
                order_position: 999
              )
            end
            # FRC (Feb 2026): Unique constraint (warehouse_type_id, name) means we can't
            # blindly move folders to unassigned if duplicates already exist there.
            # Must use .unscoped to bypass acts_as_tenant - orphaned folders may have
            # tenant_id=NULL (pre-tenancy data) which tenant scoping would miss.
            conflicting_names = removed_folders.pluck(:name)
            WarehouseFolder.unscoped.where(warehouse_type_id: unassigned_type.id, name: conflicting_names).delete_all

            removed_folders.update_all(warehouse_type_id: unassigned_type.id)
          end

          # Assign selected folders to this type (may steal from other types)
          if warehouse_folder_ids.present?
            WarehouseFolder.where(id: warehouse_folder_ids).update_all(warehouse_type_id: @warehouse_type.id)
          end
        end

        # Reload and return updated warehouse type
        @warehouse_type.reload
        render json: {
          success: true,
          data: serialize_warehouse_type(@warehouse_type)
        }
      end

      # GET /api/v1/warehouse_types/:code/records
      # Config-driven: all query/display/search/token config lives on WarehouseType JSONB columns.
      # Zero case/when — works for any warehouse type with source_model set.
      #
      # Params:
      #   - code: Warehouse type code (job, contact, corporate, etc.)
      #   - limit: Max records per page (default 50, max 100)
      #   - offset: Pagination offset (default 0)
      #   - search: Optional search query
      #
      # Response:
      # {
      #   success: true,
      #   data: {
      #     records: [{ id, name, subtitle, code, tokenValues }, ...],
      #     groupingTokens: ["JobStatus", "JobType"],
      #     pagination: { total, limit, offset, has_more }
      #   }
      # }
      def records
        # No source_model = this type doesn't have records (e.g. email)
        if @warehouse_type.source_model.blank?
          return render json: {
            success: true,
            data: {
              records: [],
              groupingTokens: [],
              pagination: { total: 0, limit: 0, offset: 0, has_more: false }
            }
          }
        end

        model = @warehouse_type.source_model.constantize
        eager_loads = derive_eager_loads

        # Single record lookup (used by scoped warehouse tree to resolve token values)
        if params[:record_id].present?
          scope = eager_loads.any? ? model.includes(*eager_loads) : model.all
          record = scope.find_by(id: params[:record_id])
          return render json: {
            success: true,
            data: {
              record: record ? serialize_record_from_config(record) : nil
            }
          }
        end

        limit = (params[:limit] || 50).to_i.clamp(1, 100)
        offset = (params[:offset] || 0).to_i
        search = params[:search]&.strip
        config = @warehouse_type.records_config

        scope = eager_loads.any? ? model.includes(*eager_loads) : model.all
        scope = apply_dynamic_search(scope, model, config['search'], search)
        scope = apply_order_joins(scope, model, config['order'])

        total = scope.count
        paginated = scope.limit(limit).offset(offset).to_a

        render json: {
          success: true,
          data: {
            records: paginated.map { |r| serialize_record_from_config(r) },
            groupingTokens: extract_grouping_tokens(@warehouse_type.folder_path_template),
            pagination: { total: total, limit: limit, offset: offset, has_more: offset + limit < total }
          }
        }
      end

      private

      def set_warehouse_type
        @warehouse_type = WarehouseType.find(params[:id])
      end

      def set_warehouse_type_by_code
        @warehouse_type = WarehouseType.find_by!(code: params[:code])
      end

      # ═══════════════════════════════════════════════════════════════════════════
      # Config-driven record helpers (Feb 2026)
      # All behaviour driven by warehouse_type.token_config + records_config
      # ═══════════════════════════════════════════════════════════════════════════

      # Resolve a dot-path on a record. Returns nil if any link in the chain is nil.
      # Does NOT fabricate values. nil means nil.
      def resolve_dot_path(record, path)
        return nil if path.blank?

        path.to_s.split('.').reduce(record) do |obj, method|
          return nil if obj.nil?
          return nil unless obj.respond_to?(method)
          obj.public_send(method)
        end
      end

      # Derive .includes() from all dot-paths in token_config + records_config.display
      def derive_eager_loads
        all_paths = (@warehouse_type.token_config || {}).values
        display = @warehouse_type.records_config&.dig('display') || {}
        all_paths += display.values.compact

        all_paths
          .select { |p| p.is_a?(String) && p.include?('.') }
          .map { |p| p.split('.').first.to_sym }
          .uniq
      end

      # Auto-join for table-prefixed ORDER BY columns (e.g., "contacts.display_name ASC")
      def apply_order_joins(scope, model, order_clause)
        return scope if order_clause.blank?

        order_clause.split(',').each do |part|
          col = part.strip.split(/\s+/).first # e.g. "contacts.display_name"
          next unless col.include?('.')

          assoc = col.split('.').first.singularize.to_sym
          scope = scope.joins(assoc) if model.reflect_on_association(assoc) && !scope.joins_values.include?(assoc)
        end

        scope.order(Arel.sql(order_clause))
      end

      # Apply search with auto-derived joins for table-prefixed columns
      def apply_dynamic_search(scope, model, search_columns, query)
        return scope if query.blank? || search_columns.blank?

        # Auto-join for table-prefixed columns (e.g., "contacts.display_name")
        search_columns
          .select { |c| c.include?('.') }
          .map { |c| c.split('.').first.singularize.to_sym }
          .uniq
          .each { |assoc| scope = scope.joins(assoc) if model.reflect_on_association(assoc) }

        conditions = search_columns.map { |col| "#{col} ILIKE :q" }.join(" OR ")
        scope.where(conditions, q: "%#{query}%")
      end

      # Serialize a record using records_config — no case/when, no fabrication
      def serialize_record_from_config(record)
        display = @warehouse_type.records_config&.dig('display') || {}
        token_config = @warehouse_type.token_config || {}

        {
          id: record.id,
          name: resolve_dot_path(record, display['name'])&.to_s,
          subtitle: resolve_dot_path(record, display['subtitle'])&.to_s,
          code: resolve_dot_path(record, display['code'])&.to_s,
          tokenValues: token_config.transform_values { |path| resolve_dot_path(record, path)&.to_s }
        }
      end

      # Extract grouping tokens from a folder_path_template (Feb 2026)
      # All token segments except the LAST become grouping levels
      # e.g., "Job/{{JobStatus}}/{{JobType}}/{{JobCode}}{{JobName}}" → ["JobStatus", "JobType"]
      # e.g., "Corporate/{{CompanyGroup}}/{{CompanyCode}}" → ["CompanyGroup"]
      # e.g., "Contacts/{{ContactName}}" → [] (flat - only 1 token segment)
      def extract_grouping_tokens(template)
        return [] if template.blank?

        segments = template.split('/')
        token_segments = segments.select { |s| s.include?('{{') }
        return [] if token_segments.length <= 1

        # All except last token segment → extract first token name from each
        token_segments[0..-2].map { |s| s.scan(/\{\{(\w+)\}\}/).flatten.first }.compact
      end

      def warehouse_type_params
        params.require(:warehouse_type).permit(
          :code,
          :display_name,
          :description,
          :icon_name,
          :folder_path_template,
          :enabled,
          :order_position,
          :source_model,
          token_config: {},
          records_config: {}
        )
      end

      # Build full path by walking up parent hierarchy
      # e.g., Statement → Balance Sheet → Xero = "Xero/Balance Sheet/Statement"
      # ALWAYS use name (not folder_path_template) to avoid duplicating the warehouse type prefix
      def build_ancestor_path(warehouse_folder)
        path_parts = []
        current = warehouse_folder

        while current.present?
          # Always use name - folder_path_template may contain full paths that would duplicate
          path_parts.unshift(current.name)
          current = current.parent
        end

        path_parts.join('/')
      end

      # Build the display name path for a warehouse folder.
      # For root folders: just the display_name (e.g., "Photo Documents")
      # For child folders: "Parent/Child" (e.g., "Finance/Bills")
      # Uses display_name (what the UI shows) falling back to name.
      def build_folder_name_path(warehouse_folder)
        parts = []
        current = warehouse_folder
        while current
          parts.unshift(current.display_name.presence || current.name)
          current = current.parent
        end
        parts.join("/")
      end

      def serialize_warehouse_type(warehouse_type)
        {
          id: warehouse_type.id,
          code: warehouse_type.code,
          display_name: warehouse_type.display_name,
          description: warehouse_type.description,
          icon_name: warehouse_type.icon_name,
          folder_path_template: warehouse_type.folder_path_template,
          is_system: warehouse_type.is_system,
          enabled: warehouse_type.enabled,
          order_position: warehouse_type.order_position,
          warehouse_folders_count: warehouse_type.warehouse_folders.count,
          warehouse_folders: warehouse_type.warehouse_folders.enabled.ordered.map do |wf|
            # SSoT (Feb 2026): Return full_path_template for tree building
            # FRC: Build full path by combining:
            # 1. Warehouse type's base template (e.g., "Corporate/{{CompanyGroup}}/{{CompanyCode}}")
            # 2. Ancestor path from parent hierarchy (e.g., "Xero/Balance Sheet/Statement")
            #
            # Example: Corporate type has "Corporate/{{CompanyGroup}}/{{CompanyCode}}"
            #          Statement has parent Balance Sheet, which has parent Xero
            #          Full path = "Corporate/{{CompanyGroup}}/{{CompanyCode}}/Xero/Balance Sheet/Statement"
            wt_template = warehouse_type.folder_path_template.presence

            # Build path from parent hierarchy
            ancestor_path = build_ancestor_path(wf)

            full_template = if wt_template.blank?
              # No warehouse type template → just use ancestor path
              ancestor_path
            else
              # FRC (Feb 2026): Compare first FOLDER exactly, not string prefix
              # "Assets".start_with?("Asset") was returning true incorrectly
              scope_root = wt_template.split('/').first
              first_folder = ancestor_path.split('/').first
              if first_folder == scope_root
                # Already a full path → use as-is
                ancestor_path
              else
                # Combine warehouse type template + ancestor path
                "#{wt_template}/#{ancestor_path}"
              end
            end

            # SSoT (Feb 2026): WarehouseFolder now contains all UI config directly
            # Document types linked via warehouse_folder_document_types join table
            document_types = wf.document_types.includes(:warehouse_folder_document_types)

            {
              id: wf.id,
              name: wf.name,
              parent_id: wf.parent_id,
              parent_name: wf.parent&.name,
              children_count: wf.children.count,
              folder_segment: wf.folder_segment,
              folder_path_suffix: wf.folder_path_suffix,
              full_path_template: full_template,
              full_folder_path: wf.full_folder_path,
              scope_base_template: wt_template,  # SSoT: Warehouse type's base template for folder editor grey prefix
              path_preview: wf.path_preview,
              is_system: wf.is_system,
              warehouse_type_code: warehouse_type.code,
              # SSoT (Feb 2026): UI config now directly on WarehouseFolder
              display_name: wf.display_name,
              icon_name: wf.icon_name,
              ui_name_template: wf.ui_name_template,
              download_name_template: wf.download_name_template,
              tab_key: wf.tab_key,
              tab_group: wf.tab_group,
              display_mode: wf.display_mode,
              hidden_by_default: wf.hidden_by_default,
              warehouse_enabled: wf.warehouse_enabled,
              is_photo_category: wf.is_photo_category,
              is_cad_category: wf.is_cad_category,
              is_mailbox: wf.is_mailbox,
              dynamic_type: wf.dynamic_type,
              # Document types via join table - SSoT: NO FALLBACKS (Feb 2026)
              document_types: document_types.map { |dt|
                wfdt = dt.warehouse_folder_document_types.find { |j| j.warehouse_folder_id == wf.id }
                {
                  id: dt.id,
                  name: dt.name,
                  abbreviation: dt.abbreviation,
                  is_primary: wfdt&.is_primary || false,
                  # SSoT: Templates from join table ONLY - no fallback to DocumentType
                  ui_name_template: wfdt&.ui_name_template,
                  download_name_template: wfdt&.download_name_template
                }
              }
            }
          end,
          can_delete: warehouse_type.can_delete?,
          created_at: warehouse_type.created_at,
          updated_at: warehouse_type.updated_at
        }
      end

      def warehouse_type_summary
        {
          total: WarehouseType.count,
          enabled: WarehouseType.enabled.count,
          system: WarehouseType.system_types.count,
          custom: WarehouseType.custom_types.count
        }
      end

      # ═══════════════════════════════════════════════════════════════════════════
      # Materialized Path helpers (Feb 2026)
      # ═══════════════════════════════════════════════════════════════════════════

      # Fetch document counts using materialized folder_path (top-level segments)
      def fetch_path_counts_by_warehouse_type
        WarehouseDocument
          .where(tenant_id: current_tenant&.id)
          .where.not(folder_path: nil)
          .group(Arel.sql("split_part(folder_path, '/', 1)"))
          .count
      end

      # Find the longest common prefix among a set of paths.
      # For scoped_tree, this strips the record-identity portion
      # (e.g., "Job/J46 Smith St...") so remaining keys are folder names.
      #
      # ⚠️ DO NOT SIMPLIFY - Single-path edge case (Feb 2026)
      # ════════════════════════════════════════════════════════
      # With 2+ paths the common prefix naturally stops at the record identity
      # because folder segments diverge. With 1 path, the "common prefix" is the
      # entire path, which swallows the folder name into "". Fix: strip last
      # segment for single paths — it's the actual folder, not record identity.
      # ❌ WRONG: return paths.first (folder name becomes "")
      # ✅ CORRECT: return all-but-last segment
      # ════════════════════════════════════════════════════════
      def find_common_prefix(paths)
        return "" if paths.empty?

        if paths.size == 1
          segments = paths.first.split("/")
          # Last segment is the folder name — don't include it in the prefix.
          # If only 1-2 segments (root-level doc), return the full path as prefix.
          return segments.length > 2 ? segments[0..-2].join("/") : paths.first
        end

        # Split all paths into segments
        split_paths = paths.map { |p| p.split("/") }
        min_length = split_paths.map(&:length).min

        prefix_segments = []
        (0...min_length).each do |i|
          segment = split_paths.first[i]
          break unless split_paths.all? { |sp| sp[i] == segment }
          prefix_segments << segment
        end

        prefix_segments.join("/")
      end

      # ═══════════════════════════════════════════════════════════════════════════
      # Tree endpoint helper methods (Feb 2026)
      # ═══════════════════════════════════════════════════════════════════════════

      # Fetch document counts grouped by source_type
      def fetch_document_counts
        counts = WarehouseDocument.group(:source_type).count

        # Map source_type to standard count keys (matches warehouse_type codes)
        {
          "job" => counts["job"] || 0,
          "corporate" => counts["corporate"] || 0,
          "contact" => counts["contact"] || 0,
          "email" => counts["email"] || 0,
          "task" => counts["task"] || 0,
          "user" => counts["user"] || 0,
          "warehouse" => counts["warehouse"] || 0,
          "template" => counts["template"] || 0,
          # Also provide legacy keys for backwards compatibility
          "jobs" => counts["job"] || 0,
          "contacts" => counts["contact"] || 0,
          "emails" => counts["email"] || 0,
          "tasks" => counts["task"] || 0,
          "users" => counts["user"] || 0,
          "warehousing" => counts["warehouse"] || 0,
          "templates" => counts["template"] || 0
        }
      end

      # Build a tree node for a warehouse type
      def warehouse_type_tree_node(warehouse_type, counts)
        # Get only root-level folders (parent_id: nil) - children are nested via children association
        # FRC (Feb 2026): Without this filter, .includes() eager-loads ALL folders into memory,
        # so warehouse_type.warehouse_folders returns root AND children at the same level
        warehouse_folders = warehouse_type.warehouse_folders.enabled.ordered.where(parent_id: nil)

        # Get count for this warehouse type
        file_count = counts[warehouse_type.code] || 0

        {
          id: "wt-#{warehouse_type.code}",
          code: warehouse_type.code,
          displayName: warehouse_type.display_name,
          iconName: warehouse_type.icon_name,
          orderPosition: warehouse_type.order_position,
          folderPathTemplate: warehouse_type.folder_path_template,
          pathPreview: resolve_template_tokens(warehouse_type.folder_path_template),
          fileCount: file_count,
          warehouseFolders: warehouse_folders.map { |wf| warehouse_folder_tree_node(wf, warehouse_type) }
        }
      end

      # Build a tree node for a warehouse folder
      # SSoT (Feb 2026): WarehouseFolder is THE ONE
      def warehouse_folder_tree_node(warehouse_folder, warehouse_type)
        # Build full path template
        wt_template = warehouse_type.folder_path_template.presence
        ancestor_path = build_ancestor_path(warehouse_folder)

        full_template = if wt_template.blank?
          ancestor_path
        else
          scope_root = wt_template.split('/').first
          first_folder = ancestor_path.split('/').first
          if first_folder == scope_root
            ancestor_path
          else
            "#{wt_template}/#{ancestor_path}"
          end
        end

        # SSoT: Children come directly from WarehouseFolder (has parent/children self-ref)
        children = warehouse_folder.children
          .where(warehouse_enabled: true)
          .enabled
          .ordered
          .map { |child| warehouse_folder_tree_node(child, warehouse_type) }

        {
          id: "wf-#{warehouse_folder.id}",
          name: warehouse_folder.name,
          parentId: warehouse_folder.parent_id,
          folderPathTemplate: full_template,
          fullFolderPath: warehouse_folder.full_folder_path,
          folderSegment: warehouse_folder.folder_segment,
          folderPathSuffix: warehouse_folder.folder_path_suffix,
          pathPreview: warehouse_folder.path_preview,
          isSystem: warehouse_folder.is_system,
          children: children,
          # SSoT (Feb 2026): UI config now directly on WarehouseFolder
          displayName: warehouse_folder.display_name,
          iconName: warehouse_folder.icon_name || "folder",
          uiNameTemplate: warehouse_folder.ui_name_template,
          downloadNameTemplate: warehouse_folder.download_name_template,
          tabKey: warehouse_folder.tab_key,
          tabGroup: warehouse_folder.tab_group,
          displayMode: warehouse_folder.display_mode,
          hiddenByDefault: warehouse_folder.hidden_by_default,
          warehouseEnabled: warehouse_folder.warehouse_enabled,
          isPhotoCategory: warehouse_folder.is_photo_category,
          isCadCategory: warehouse_folder.is_cad_category,
          isMailbox: warehouse_folder.is_mailbox,
          dynamicType: warehouse_folder.dynamic_type
        }
      end

      # ═══════════════════════════════════════════════════════════════════════════
      # Cross-linked documents (Feb 2026)
      # "Also show in" — documents appear in secondary warehouse types via FK chains
      #
      # Architecture:
      #   WarehouseDocument.warehouse_folder_document_type_id (FK)
      #     → WarehouseFolderDocumentType.document_type_id
      #       → all WarehouseFolderDocumentType rows for that doc type (primary + secondary)
      #         → secondary folders in the target warehouse type = "Also show in"
      #
      # For Jobs: ExternalInvoice.job_id → documents whose document type has
      #           a secondary (is_primary=false) folder in the Job warehouse type.
      #
      # For Corporate: ExternalInvoice.contact → Contact.company → CorporateCompany
      #                (future extension when FK chain is established)
      # ═══════════════════════════════════════════════════════════════════════════

      # Find documents that should appear via "Also show in" + FK chains
      # @param linkable_type [String] "Job", "Contact", etc.
      # @param linkable_id [Integer] The ID of the linked record
      # @return [ActiveRecord::Relation] Documents to include
      def cross_linked_documents(linkable_type, linkable_id)
        case linkable_type
        when "Job"
          cross_linked_documents_for_job(linkable_id)
        else
          WarehouseDocument.none
        end
      end

      # Find Xero documents whose ExternalInvoice.job_id matches this job,
      # but only if the document type has a secondary folder in the Job warehouse type.
      # This respects the "Also show in" config — only shows if configured.
      def cross_linked_documents_for_job(job_id)
        # Find ExternalInvoices linked to this job
        invoice_ids = ExternalInvoice.where(job_id: job_id).pluck(:id)
        return WarehouseDocument.none if invoice_ids.empty?

        # Find document_type_ids that have a secondary (non-primary) folder in Job warehouse
        job_wt = WarehouseType.find_by(code: "job")
        return WarehouseDocument.none unless job_wt

        secondary_doc_type_ids = WarehouseFolderDocumentType
          .joins(:warehouse_folder)
          .where(is_primary: false)
          .where(warehouse_folders: { warehouse_type_id: job_wt.id })
          .pluck(:document_type_id)
        return WarehouseDocument.none if secondary_doc_type_ids.empty?

        # Find warehouse documents for these invoices whose document type
        # has a secondary folder configured in the Job warehouse
        WarehouseDocument
          .where(tenant_id: current_tenant&.id)
          .where(documentable_type: "ExternalInvoice", documentable_id: invoice_ids)
          .where.not(folder_path: nil)
          .where(
            "metadata->>'document_type_id' IN (?)",
            secondary_doc_type_ids.map(&:to_s)
          )
      end

      # Remap folder paths for cross-linked documents to the secondary folder's path
      # in the target warehouse type. E.g., a Xero bill stored at
      # "Contacts/Bunnings/Financial/Bills" should appear as "Job/J-001/Smith Residence/Finance/Bills"
      # when viewed in a Job's warehouse.
      #
      # Uses WarehousePathComputer to expand the secondary folder's template with
      # the target record's tokens (JobCode, JobName, etc.)
      #
      # @param cross_docs [ActiveRecord::Relation] Cross-linked documents
      # @param target_linkable_type [String] The target context (e.g., "Job")
      # @param target_linkable_id [Integer] The target record ID
      # @return [Hash] { expanded_folder_path => [doc_id, ...] }
      def remap_cross_linked_paths(cross_docs, target_linkable_type, target_linkable_id = nil)
        return {} unless cross_docs.any?
        target_linkable_id ||= params[:linkable_id]

        target_wt_code = case target_linkable_type
                         when "Job" then "job"
                         when "Contact" then "contact"
                         when "CorporateCompany" then "corporate"
                         else return {}
                         end

        target_wt = WarehouseType.find_by(code: target_wt_code)
        return {} unless target_wt

        # Build token values from the target record for template expansion
        tokens = build_tokens_for_linkable(target_linkable_type, target_linkable_id)

        # Pre-load secondary folder templates for this target warehouse type
        # { document_type_id => path_template }
        secondary_template_map = {}
        computer = WarehousePathComputer.new
        WarehouseFolderDocumentType
          .joins(:warehouse_folder)
          .where(is_primary: false)
          .where(warehouse_folders: { warehouse_type_id: target_wt.id })
          .includes(warehouse_folder: :warehouse_type)
          .each do |wfdt|
            template = computer.send(:build_path_template, wfdt.warehouse_folder)
            secondary_template_map[wfdt.document_type_id] = template
          end

        result = Hash.new { |h, k| h[k] = [] }

        cross_docs.select(:id, :metadata).find_each do |doc|
          doc_type_id = doc.metadata&.dig("document_type_id")&.to_i
          next unless doc_type_id

          template = secondary_template_map[doc_type_id]
          next unless template

          # Expand the template with the target record's tokens
          expanded = computer.send(:expand_template, template, tokens)
          expanded = computer.send(:sanitize_path, expanded)
          next if expanded.blank?

          result[expanded] << doc.id
        end

        result
      end

      # Build token values for a linkable record (for template expansion)
      # @param linkable_type [String] "Job", "Contact", etc.
      # @param linkable_id [Integer] Record ID
      # @return [Hash] Token name => value (e.g., { JobCode: "J-001", JobName: "Smith" })
      def build_tokens_for_linkable(linkable_type, linkable_id)
        tokens = {}
        case linkable_type
        when "Job"
          job = Job.find_by(id: linkable_id)
          if job
            tokens[:JobCode] = job.job_code
            tokens[:JobName] = job.name.presence || job.job_code
          end
        when "Contact"
          contact = Contact.find_by(id: linkable_id)
          if contact
            tokens[:ContactName] = contact.display_name.presence || "Contact-#{contact.id}"
            tokens[:ContactId] = contact.id
          end
        when "CorporateCompany"
          cc = CorporateCompany.find_by(id: linkable_id)
          if cc
            tokens[:CompanyCode] = cc.company_code
            tokens[:CompanyGroup] = cc.company_group&.name.presence || "Default"
            tokens[:CompanyName] = cc.name
          end
        end
        tokens
      end

      # SSoT (Feb 2026): No cascade needed - paths are computed dynamically
      # When warehouse_type.folder_path_template changes, all related warehouse_folder
      # paths automatically update because full_folder_path is computed at runtime
      # from: warehouse_type.folder_path_template + parent_chain_segments + folder_segment
      def cascade_template_change(_old_template, _new_template)
        # No-op: paths are computed dynamically, no sync needed
        # Kept as placeholder for any future cascade logic
      end

      # Helper to resolve template tokens to example values for preview display
      def resolve_template_tokens(template)
        return nil if template.blank?

        preview = template.dup
        preview.gsub!("{{JobCode}}", "J-001")
        preview.gsub!("{{JobName}}", "Smith Residence")
        preview.gsub!("{{ContactName}}", "John Smith")
        preview.gsub!("{{CompanyCode}}", "ABC")
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
        preview
      end
    end
  end
end
