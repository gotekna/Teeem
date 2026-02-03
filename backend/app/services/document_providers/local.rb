# frozen_string_literal: true

# DocumentProviders::Local - Local filesystem storage provider
#
# Stores documents on the local filesystem. Useful for:
# - Development environments
# - Self-hosted deployments without cloud storage
# - Air-gapped environments
#
# Root path is configured in WarehouseProvider.root_path
# Default: Rails.root.join("storage/documents")
#
module DocumentProviders
  class Local < Base
    # Default storage path if not configured
    DEFAULT_ROOT = Rails.root.join("storage/documents").to_s.freeze

    # SSoT: Factory method to create provider for a tenant (Jan 2026 fix)
    def self.for_tenant(tenant)
      config = WarehouseProvider.for_tenant(tenant)
      new(config, tenant: tenant)
    end

    # DEPRECATED: Use for_tenant instead
    def self.for_organization(organization)
      Rails.logger.warn "[DEPRECATED] Local.for_organization - use for_tenant instead"
      config = WarehouseProvider.for_organization(organization)
      new(config, tenant: organization&.tenant)
    end

    def initialize(config, tenant: nil)
      @config = config
      @tenant = tenant
      @root_path = config&.root_path.presence || DEFAULT_ROOT

      # Ensure root directory exists
      FileUtils.mkdir_p(@root_path)
    end

    attr_reader :config

    def credential
      nil # Local storage doesn't need credentials
    end

    def provider_type
      :local
    end

    def connected?
      File.directory?(@root_path) && File.writable?(@root_path)
    end

    # ====================
    # FOLDER OPERATIONS
    # ====================

    def list_folder(path, options = {})
      full_path = resolve_path(path)
      return [] unless File.directory?(full_path)

      Dir.children(full_path).map do |name|
        item_path = File.join(full_path, name)
        stat = File.stat(item_path)

        {
          id: item_path,
          name: name,
          type: File.directory?(item_path) ? :folder : :file,
          size: stat.size,
          mime_type: File.directory?(item_path) ? nil : Marcel::MimeType.for(name: name),
          created_at: stat.birthtime,
          modified_at: stat.mtime,
          path: File.join(path, name)
        }
      end
    end

    def create_folder(path, options = {})
      full_path = resolve_path(path)
      FileUtils.mkdir_p(full_path)

      {
        id: full_path,
        name: File.basename(path),
        type: :folder,
        path: path
      }
    end

    def folder_exists?(path)
      File.directory?(resolve_path(path))
    end

    def get_folder(path)
      full_path = resolve_path(path)
      raise NotFoundError, "Folder not found: #{path}" unless File.directory?(full_path)

      stat = File.stat(full_path)
      {
        id: full_path,
        name: File.basename(path),
        type: :folder,
        path: path,
        created_at: stat.birthtime,
        modified_at: stat.mtime
      }
    end

    # ====================
    # FILE OPERATIONS
    # ====================

    def upload_file(folder_path, content, filename, options = {})
      folder_full_path = resolve_path(folder_path)
      FileUtils.mkdir_p(folder_full_path)

      file_path = File.join(folder_full_path, sanitize_filename(filename))

      # Handle overwrite option
      if File.exist?(file_path) && !options[:overwrite]
        # Generate unique filename
        base = File.basename(filename, ".*")
        ext = File.extname(filename)
        counter = 1
        while File.exist?(file_path)
          file_path = File.join(folder_full_path, "#{base}_#{counter}#{ext}")
          counter += 1
        end
      end

      # Write content
      if content.respond_to?(:read)
        File.binwrite(file_path, content.read)
      else
        File.binwrite(file_path, content)
      end

      stat = File.stat(file_path)
      {
        id: file_path,
        name: File.basename(file_path),
        type: :file,
        path: File.join(folder_path, File.basename(file_path)),
        size: stat.size
      }
    end

    def download_file(path_or_id)
      full_path = looks_like_full_path?(path_or_id) ? path_or_id : resolve_path(path_or_id)
      raise NotFoundError, "File not found: #{path_or_id}" unless File.file?(full_path)

      File.binread(full_path)
    end

    def download_url(path_or_id, options = {})
      # Local storage doesn't support pre-signed URLs
      # Return a file:// URL for development use
      full_path = looks_like_full_path?(path_or_id) ? path_or_id : resolve_path(path_or_id)
      "file://#{full_path}"
    end

    def get_file(path_or_id)
      full_path = looks_like_full_path?(path_or_id) ? path_or_id : resolve_path(path_or_id)
      raise NotFoundError, "File not found: #{path_or_id}" unless File.file?(full_path)

      stat = File.stat(full_path)
      {
        id: full_path,
        name: File.basename(full_path),
        type: :file,
        path: strip_root(full_path),
        size: stat.size,
        mime_type: Marcel::MimeType.for(name: File.basename(full_path)),
        created_at: stat.birthtime,
        modified_at: stat.mtime
      }
    end

    def delete_file(path_or_id)
      full_path = looks_like_full_path?(path_or_id) ? path_or_id : resolve_path(path_or_id)
      return false unless File.file?(full_path)

      File.delete(full_path)
      true
    end

    def rename_file(path_or_id, new_name)
      full_path = looks_like_full_path?(path_or_id) ? path_or_id : resolve_path(path_or_id)
      raise NotFoundError, "File not found: #{path_or_id}" unless File.file?(full_path)

      new_path = File.join(File.dirname(full_path), sanitize_filename(new_name))
      File.rename(full_path, new_path)
      get_file(new_path)
    end

    def copy_file(source_path_or_id, destination_folder, new_name = nil)
      source_full = looks_like_full_path?(source_path_or_id) ? source_path_or_id : resolve_path(source_path_or_id)
      raise NotFoundError, "Source file not found" unless File.file?(source_full)

      dest_folder = resolve_path(destination_folder)
      FileUtils.mkdir_p(dest_folder)

      filename = new_name || File.basename(source_full)
      dest_path = File.join(dest_folder, sanitize_filename(filename))

      FileUtils.cp(source_full, dest_path)
      get_file(dest_path)
    end

    def move_file(source_path_or_id, destination_folder, new_name = nil)
      source_full = looks_like_full_path?(source_path_or_id) ? source_path_or_id : resolve_path(source_path_or_id)
      raise NotFoundError, "Source file not found" unless File.file?(source_full)

      dest_folder = resolve_path(destination_folder)
      FileUtils.mkdir_p(dest_folder)

      filename = new_name || File.basename(source_full)
      dest_path = File.join(dest_folder, sanitize_filename(filename))

      FileUtils.mv(source_full, dest_path)
      get_file(dest_path)
    end

    # ====================
    # SEARCH
    # ====================

    def search(query, options = {})
      base_path = options[:folder_path] ? resolve_path(options[:folder_path]) : @root_path
      results = []

      Dir.glob(File.join(base_path, "**", "*#{query}*")).each do |path|
        next if options[:type] == :file && File.directory?(path)
        next if options[:type] == :folder && File.file?(path)

        stat = File.stat(path)
        results << {
          id: path,
          name: File.basename(path),
          type: File.directory?(path) ? :folder : :file,
          size: stat.size,
          path: strip_root(path)
        }

        break if options[:limit] && results.size >= options[:limit]
      end

      results
    end

    # ====================
    # THUMBNAILS
    # ====================

    def thumbnail_url(path_or_id, options = {})
      # Local storage doesn't generate thumbnails
      nil
    end

    # ====================
    # TEEEM-SPECIFIC
    # ====================

    def find_job_folder(job)
      job_path = @config&.job_path(job.job_code) || "/Jobs/#{job.job_code}"
      full_path = resolve_path(job_path)

      return nil unless File.directory?(full_path)

      {
        id: full_path,
        name: job.job_code,
        type: :folder,
        path: job_path
      }
    end

    def create_job_folder_structure(job, _template = nil)
      job_path = @config&.job_path(job.job_code) || "/Jobs/#{job.job_code}"
      full_path = resolve_path(job_path)

      # Create main job folder
      FileUtils.mkdir_p(full_path)

      # Create subfolders from WarehouseFolder hierarchy
      create_subfolders_from_warehouse_folders(full_path)

      {
        id: full_path,
        name: job.job_code,
        type: :folder,
        path: job_path
      }
    end

    def validate_root_folder
      if File.directory?(@root_path) && File.writable?(@root_path)
        { valid: true }
      elsif !File.exist?(@root_path)
        { valid: false, error: "Root folder does not exist: #{@root_path}", error_type: "not_found" }
      else
        { valid: false, error: "Root folder not writable: #{@root_path}", error_type: "permission_denied" }
      end
    end

    def native_client
      nil # No native client for local storage
    end

    private

    def resolve_path(path)
      # Normalize and join with root
      normalized = path.to_s.sub(%r{^/}, "")
      File.join(@root_path, normalized)
    end

    def strip_root(full_path)
      full_path.sub(@root_path, "").sub(%r{^/}, "")
    end

    def looks_like_full_path?(str)
      str.to_s.start_with?("/") && str.to_s.include?(@root_path)
    end

    def sanitize_filename(filename)
      filename.to_s.gsub(/[<>:"|?*\\]/, "_").strip
    end

    def create_subfolders_from_warehouse_folders(parent_path)
      root_tabs = WarehouseFolder.for_jobs
                           .where(warehouse_enabled: true)
                           .enabled
                           .root_tabs
                           .ordered
                           .includes(children: { children: :children })

      root_tabs.each do |tab|
        create_warehouse_folder_recursive(tab, parent_path)
      end
    end

    def create_warehouse_folder_recursive(tab, parent_path)
      folder_path = File.join(parent_path, tab.display_name)
      FileUtils.mkdir_p(folder_path)

      Rails.logger.info "[Local SSoT] Created folder: #{folder_path}"

      tab.children.where(warehouse_enabled: true).enabled.ordered.each do |child|
        create_warehouse_folder_recursive(child, folder_path)
      end
    end
  end
end
