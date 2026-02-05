# frozen_string_literal: true

module Api
  module V1
    # WarehouseTypesController - CRUD for warehouse types
    #
    # SSoT: Database-driven warehouse types (Feb 2026)
    # Replaces the hardcoded WAREHOUSE_TYPES constant with database table
    #
    class WarehouseTypesController < ApplicationController
      before_action :set_warehouse_type, only: [:show, :update, :destroy, :update_base_folders]
      before_action :set_warehouse_type_by_code, only: [:records]

      # GET /api/v1/warehouse_types
      def index
        @warehouse_types = WarehouseType.includes(:base_folders).visible

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
      #       baseFolders: [{ id: "bf-123", name: "Plans", children: [...] }],
      #       fileCount: 1234
      #     }
      #   ],
      #   counts: { job: 1234, corporate: 500, ... },
      #   total: 80149
      # }
      def tree
        # Get enabled warehouse types with their base folders and nested warehouse folders
        warehouse_types = WarehouseType.enabled.ordered.includes(
          base_folders: { children: :children }
        )

        # Get document counts by source_type
        document_counts = fetch_document_counts

        render json: {
          success: true,
          data: {
            tree: warehouse_types.map { |wt| warehouse_type_tree_node(wt, document_counts) },
            counts: document_counts,
            total: WarehouseDocument.count
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
          # SSoT (Feb 2026): Cascade folder_path_template changes to base_folders and warehouse_folders
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
            error: "Cannot delete warehouse type with associated base folders or document types"
          }, status: :unprocessable_entity
        end

        @warehouse_type.destroy
        render json: { success: true }
      end

      # PATCH /api/v1/warehouse_types/:id/update_base_folders
      # Batch update base folder assignments for a warehouse type
      #
      # Folders removed from this type are moved to the "unassigned" type
      # (warehouse_type_id has NOT NULL constraint, so folders must belong somewhere)
      def update_base_folders
        base_folder_ids = params[:base_folder_ids] || []

        # Move removed folders to unassigned type (instead of deleting)
        removed_folders = @warehouse_type.base_folders.where.not(id: base_folder_ids)
        if removed_folders.exists?
          unassigned_type = WarehouseType.unassigned
          removed_folders.update_all(warehouse_type_id: unassigned_type.id)
        end

        # Assign selected folders to this type (may steal from other types)
        if base_folder_ids.present?
          BaseFolder.where(id: base_folder_ids).update_all(warehouse_type_id: @warehouse_type.id)
        end

        # Reload and return updated warehouse type
        @warehouse_type.reload
        render json: {
          success: true,
          data: serialize_warehouse_type(@warehouse_type)
        }
      end

      # GET /api/v1/warehouse_types/:code/records
      # Returns actual database records for a warehouse type (lazy-loaded on tree expand)
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
      #     records: [{ id, name, subtitle, code }, ...],
      #     pagination: { total, limit, offset, has_more }
      #   }
      # }
      def records
        limit = (params[:limit] || 50).to_i.clamp(1, 100)
        offset = (params[:offset] || 0).to_i
        search = params[:search]&.strip

        # Get base scope (without select) for counting, then add select for pagination
        # FRC: Don't call .count on a scope with .select(multiple columns) - PostgreSQL fails
        base_scope = case @warehouse_type.code
        when 'job'
          scope = Job.all
          scope = scope.where("name ILIKE ? OR job_code ILIKE ?", "%#{search}%", "%#{search}%") if search.present?
          scope.order(created_at: :desc)
        when 'contact'
          scope = Contact.all
          scope = scope.where("display_name ILIKE ? OR first_name ILIKE ? OR last_name ILIKE ?", "%#{search}%", "%#{search}%", "%#{search}%") if search.present?
          scope.order(:display_name)
        when 'corporate'
          scope = Corporate.includes(:company_group, :contact)
          scope = scope.joins(:contact).where("contacts.display_name ILIKE ? OR corporates.code ILIKE ?", "%#{search}%", "%#{search}%") if search.present?
          scope.order("contacts.display_name")
        when 'task'
          scope = SmTask.all
          scope = scope.where("name ILIKE ? OR description ILIKE ?", "%#{search}%", "%#{search}%") if search.present?
          scope.order(created_at: :desc)
        when 'user'
          scope = User.all
          scope = scope.where("first_name ILIKE ? OR last_name ILIKE ? OR email ILIKE ?", "%#{search}%", "%#{search}%", "%#{search}%") if search.present?
          scope.order(:first_name)
        when 'email'
          # Emails don't have individual record folders - return empty
          nil
        else
          nil
        end

        # Skip pagination for nil/empty results
        if base_scope.nil?
          total = 0
          paginated_records = []
        else
          total = base_scope.count
          paginated_records = base_scope.limit(limit).offset(offset).to_a
        end

        render json: {
          success: true,
          data: {
            records: paginated_records.map { |r| serialize_record(r, @warehouse_type.code) },
            pagination: {
              total: total,
              limit: limit,
              offset: offset,
              has_more: offset + limit < total
            }
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

      # Serialize a record for the records API response
      def serialize_record(record, warehouse_type_code)
        case warehouse_type_code
        when 'job'
          job_code = record.job_code.present? ? record.job_code : "J-#{record.id.to_s.rjust(3, '0')}"
          {
            id: record.id,
            name: record.name || "Job ##{record.id}",
            subtitle: record.location,
            code: job_code
          }
        when 'contact'
          {
            id: record.id,
            name: record.display_name || "#{record.first_name} #{record.last_name}".strip,
            subtitle: record.company_name_or_trust,
            code: nil
          }
        when 'corporate'
          # SSoT: Corporate links to Contact for identity - get name from contact's display_name
          {
            id: record.id,
            name: record.contact&.display_name || "Corporate ##{record.id}",
            subtitle: record.company_group&.name,
            code: record.code
          }
        when 'task'
          {
            id: record.id,
            name: record.name || "Task ##{record.id}",
            subtitle: record.description&.truncate(50),
            code: "T-#{record.id}"
          }
        when 'user'
          {
            id: record.id,
            name: "#{record.first_name} #{record.last_name}".strip,
            subtitle: record.email,
            code: nil
          }
        else
          {
            id: record.id,
            name: record.try(:name) || record.try(:title) || "Record #{record.id}",
            subtitle: nil,
            code: nil
          }
        end
      end

      def warehouse_type_params
        params.require(:warehouse_type).permit(
          :code,
          :display_name,
          :description,
          :icon_name,
          :folder_path_template,
          :enabled,
          :order_position
        )
      end

      # Build full path by walking up parent hierarchy
      # e.g., Statement → Balance Sheet → Xero = "Xero/Balance Sheet/Statement"
      # ALWAYS use name (not folder_path_template) to avoid duplicating the warehouse type prefix
      def build_ancestor_path(base_folder)
        path_parts = []
        current = base_folder

        while current.present?
          # Always use name - folder_path_template may contain full paths that would duplicate
          path_parts.unshift(current.name)
          current = current.parent
        end

        path_parts.join('/')
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
          base_folders_count: warehouse_type.base_folders.count,
          base_folders: warehouse_type.base_folders.enabled.ordered.map do |bf|
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
            ancestor_path = build_ancestor_path(bf)

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

            # SSoT (Feb 2026): Include linked warehouse_folder for UI/DL editing
            # FRC (Feb 2026): Bypass tenant scoping - warehouse_folders are config data linked to base_folders
            # The tenant_id is for Config Sync, not for restricting admin access
            wf = ActsAsTenant.without_tenant do
              WarehouseFolder.includes(:document_types).find_by(base_folder_id: bf.id)
            end

            {
              id: bf.id,
              name: bf.name,
              parent_id: bf.parent_id,
              parent_name: bf.parent&.name,
              children_count: bf.children.count,
              folder_path_template: bf.folder_path_template,
              full_path_template: full_template,
              scope_base_template: wt_template,  # SSoT: Warehouse type's base template for folder editor grey prefix
              path_preview: bf.path_preview,
              is_system: bf.is_system,
              warehouse_folder: wf ? {
                id: wf.id,
                display_name: wf.display_name,
                folder_path: wf.folder_path,
                ui_name: wf.ui_name,
                download_name: wf.download_name,
                parent_id: wf.parent_id,  # SSoT: For parent tab selection in editor
                # SSoT (Feb 2026): Include document_types for tree view display
                # ui_name/download_name show orange if missing, green if configured
                document_types: wf.document_types.map { |dt|
                  {
                    id: dt.id,
                    name: dt.name,
                    abbreviation: dt.abbreviation,
                    ui_name: dt.ui_name,
                    download_name: dt.download_name
                  }
                }
              } : nil
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
        # Get enabled base folders for this warehouse type
        base_folders = warehouse_type.base_folders.enabled.ordered

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
          baseFolders: base_folders.map { |bf| base_folder_tree_node(bf, warehouse_type) }
        }
      end

      # Build a tree node for a base folder
      def base_folder_tree_node(base_folder, warehouse_type)
        # Get linked warehouse folder (bypass tenant scoping for config data)
        warehouse_folder = ActsAsTenant.without_tenant do
          WarehouseFolder.includes(:children, :document_types).find_by(base_folder_id: base_folder.id)
        end

        # Build full path template
        wt_template = warehouse_type.folder_path_template.presence
        ancestor_path = build_ancestor_path(base_folder)

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

        # Get children - either from base_folder.children or warehouse_folder.children
        children = if warehouse_folder
          warehouse_folder.children
            .where(warehouse_enabled: true, enabled: true)
            .order(:order_position, :display_name)
            .map { |wf| warehouse_folder_tree_node(wf) }
        else
          base_folder.children.enabled.ordered.map { |bf| base_folder_tree_node(bf, warehouse_type) }
        end

        {
          id: "bf-#{base_folder.id}",
          name: base_folder.name,
          parentId: base_folder.parent_id,
          folderPathTemplate: full_template,
          pathPreview: base_folder.path_preview,
          isSystem: base_folder.is_system,
          children: children,
          warehouseFolder: warehouse_folder ? {
            id: warehouse_folder.id,
            displayName: warehouse_folder.display_name,
            folderPath: warehouse_folder.folder_path,
            iconName: warehouse_folder.icon_name,
            uiName: warehouse_folder.ui_name,
            downloadName: warehouse_folder.download_name
          } : nil
        }
      end

      # Build a tree node for a warehouse folder (child tabs)
      def warehouse_folder_tree_node(folder)
        children = folder.children
          .where(warehouse_enabled: true, enabled: true)
          .order(:order_position, :display_name)

        {
          id: "wf-#{folder.id}",
          name: folder.display_name,
          type: "category",
          iconName: folder.icon_name || "folder",
          warehouseType: folder.warehouse_type,
          folderPath: folder.folder_path,
          fullPath: folder.folder_path,
          fileCount: 0,
          children: children.map { |child| warehouse_folder_tree_node(child) }
        }
      end

      # SSoT (Feb 2026): Cascade folder_path_template changes to related records
      # When a warehouse_type's template changes, update:
      # 1. base_folders that have templates starting with the old prefix
      # 2. warehouse_folders that reference those base_folders
      def cascade_template_change(old_template, new_template)
        return if old_template.blank? && new_template.blank?

        # Normalize: remove trailing slashes for comparison
        old_prefix = old_template&.chomp('/') || ''
        new_prefix = new_template&.chomp('/') || ''

        # Update base_folders that have folder_path_template starting with old prefix
        @warehouse_type.base_folders.each do |bf|
          next if bf.folder_path_template.blank?

          if bf.folder_path_template.start_with?(old_prefix)
            # Replace old prefix with new prefix
            new_bf_template = bf.folder_path_template.sub(old_prefix, new_prefix)
            bf.update_column(:folder_path_template, new_bf_template)

            # Also update linked warehouse_folders
            # FRC (Feb 2026): Bypass tenant scoping for config data
            ActsAsTenant.without_tenant do
              WarehouseFolder.where(base_folder_id: bf.id).find_each do |wf|
                next if wf.folder_path.blank?

                if wf.folder_path.start_with?(old_prefix)
                  new_wf_path = wf.folder_path.sub(old_prefix, new_prefix)
                  wf.update_column(:folder_path, new_wf_path)
                end
              end
            end
          end
        end

        # Also update any warehouse_folders directly linked to this warehouse_type
        # (not through base_folder) that have paths starting with old prefix
        # FRC (Feb 2026): Bypass tenant scoping for config data
        ActsAsTenant.without_tenant do
          WarehouseFolder.where(warehouse_type: @warehouse_type.code).find_each do |wf|
            next if wf.folder_path.blank?

            if wf.folder_path.start_with?(old_prefix)
              new_wf_path = wf.folder_path.sub(old_prefix, new_prefix)
              wf.update_column(:folder_path, new_wf_path)
            end
          end
        end
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
