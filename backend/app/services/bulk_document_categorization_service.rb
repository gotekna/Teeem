# Service to bulk categorize job documents by matching folder paths to EntityTabs
# Used for client onboarding to automatically assign document types based on folder structure
#
# Usage:
#   service = BulkDocumentCategorizationService.new(job)
#   result = service.categorize_all          # Execute categorization
#   result = service.preview                 # Dry run - see what would happen
#
# Returns:
#   {
#     success: true,
#     dry_run: false,
#     stats: { total: 100, categorized: 85, skipped: 10, failed: 5 },
#     details: [{ id: 1, file_name: "...", status: "categorized", ... }, ...]
#   }
#
class BulkDocumentCategorizationService
  def initialize(job, options = {})
    @job = job
    @dry_run = options.fetch(:dry_run, false)
    @force = options.fetch(:force, false)  # Re-categorize even already-categorized docs
    @current_user = options[:user]
    @stats = { total: 0, categorized: 0, skipped: 0, failed: 0, recategorized: 0 }
    @details = []
  end

  # Main entry point - categorizes documents
  # With force=true, re-categorizes ALL documents (fixes wrong assignments)
  # With force=false (default), only categorizes documents with document_type_id IS NULL
  def categorize_all
    load_entity_tabs

    # Get documents to process
    documents = if @force
      @job.job_documents.all  # ALL documents when force=true
    else
      @job.job_documents.where(document_type_id: nil)  # Only uncategorized
    end
    @stats[:total] = documents.count

    Rails.logger.info("[BulkCategorize] Starting categorization for Job #{@job.id}: #{@stats[:total]} documents, dry_run=#{@dry_run}")

    documents.find_each do |doc|
      process_document(doc)
    end

    Rails.logger.info("[BulkCategorize] Completed: #{@stats.inspect}")

    { success: true, stats: @stats, details: @details, dry_run: @dry_run }
  end

  # Preview what would be categorized (dry run)
  def preview
    @dry_run = true
    categorize_all
  end

  private

  def load_entity_tabs
    # Load all job document tabs with their document types
    # SSoT: scope='job', tab_group='documents', enabled=true
    @entity_tabs = EntityTab
      .for_scope('job')
      .for_group('documents')
      .enabled
      .includes(:document_types, :children)
      .to_a

    Rails.logger.info("[BulkCategorize] Loaded #{@entity_tabs.size} EntityTabs")

    # Build lookup structures for efficient matching
    build_path_lookup
  end

  def build_path_lookup
    @path_to_tab = {}
    @name_to_tabs = Hash.new { |h, k| h[k] = [] }

    # Flatten hierarchy into lookup tables
    process_tab_hierarchy(@entity_tabs)

    Rails.logger.info("[BulkCategorize] Built path lookup with #{@path_to_tab.size} paths, #{@name_to_tabs.size} names")
  end

  def process_tab_hierarchy(tabs, parent_path = nil)
    tabs.each do |tab|
      # Compute effective path for matching
      effective_path = compute_matching_path(tab, parent_path)

      if effective_path.present?
        normalized = normalize_path(effective_path)
        @path_to_tab[normalized] = tab
        Rails.logger.debug("[BulkCategorize] Indexed path: '#{normalized}' -> #{tab.display_name}")
      end

      # Also index by display_name for fuzzy matching
      normalized_name = normalize_path(tab.display_name)
      @name_to_tabs[normalized_name] << tab

      # Process children recursively
      if tab.children.any?
        process_tab_hierarchy(tab.children, effective_path)
      end
    end
  end

  def process_document(doc)
    # Try to match to an EntityTab
    matched_tab = find_matching_tab(doc.folder_path)

    if matched_tab.nil?
      @stats[:skipped] += 1
      @details << {
        id: doc.id,
        file_name: doc.file_name,
        folder_path: doc.folder_path,
        status: 'skipped',
        reason: 'no_tab_match'
      }
      return
    end

    # Find matching DocumentType from tab's linked types
    matched_type = find_matching_document_type(doc, matched_tab)

    if matched_type.nil?
      @stats[:skipped] += 1
      @details << {
        id: doc.id,
        file_name: doc.file_name,
        folder_path: doc.folder_path,
        status: 'skipped',
        reason: 'no_type_match',
        matched_tab: matched_tab.display_name
      }
      return
    end

    # Check if already correctly categorized (skip if no change needed)
    already_correct = doc.document_type_id == matched_type.id
    was_wrong = doc.document_type_id.present? && doc.document_type_id != matched_type.id
    old_type_name = was_wrong ? DocumentType.find_by(id: doc.document_type_id)&.name : nil

    if already_correct
      @stats[:skipped] += 1
      @details << {
        id: doc.id,
        file_name: doc.file_name,
        folder_path: doc.folder_path,
        status: 'skipped',
        reason: 'already_correct',
        document_type: matched_type.name
      }
      return
    end

    # Categorize the document
    if @dry_run
      status = was_wrong ? 'would_recategorize' : 'would_categorize'
      @stats[was_wrong ? :recategorized : :categorized] += 1
      @details << {
        id: doc.id,
        file_name: doc.file_name,
        folder_path: doc.folder_path,
        status: status,
        entity_tab: matched_tab.display_name,
        document_type: matched_type.name,
        document_type_id: matched_type.id,
        old_type: old_type_name
      }.compact
    else
      begin
        doc.update!(document_type_id: matched_type.id)
        status = was_wrong ? 'recategorized' : 'categorized'
        @stats[was_wrong ? :recategorized : :categorized] += 1
        @details << {
          id: doc.id,
          file_name: doc.file_name,
          folder_path: doc.folder_path,
          status: status,
          entity_tab: matched_tab.display_name,
          document_type: matched_type.name,
          document_type_id: matched_type.id,
          old_type: old_type_name
        }.compact
      rescue => e
        @stats[:failed] += 1
        @details << {
          id: doc.id,
          file_name: doc.file_name,
          status: 'failed',
          error: e.message
        }
        Rails.logger.error("[BulkCategorize] Failed to update doc #{doc.id}: #{e.message}")
      end
    end
  end

  def find_matching_tab(folder_path)
    return nil if folder_path.blank?

    normalized = normalize_path(folder_path)

    # Strategy 1: Exact path match
    if @path_to_tab[normalized]
      Rails.logger.debug("[BulkCategorize] Exact match for '#{folder_path}'")
      return @path_to_tab[normalized]
    end

    # Strategy 2: Find longest prefix match
    best_match = nil
    best_length = 0

    @path_to_tab.each do |path, tab|
      if normalized.start_with?(path) && path.length > best_length
        best_match = tab
        best_length = path.length
      end
    end

    if best_match
      Rails.logger.debug("[BulkCategorize] Prefix match for '#{folder_path}' -> #{best_match.display_name}")
      return best_match
    end

    # Strategy 3: Folder name contains tab display name (fuzzy match)
    # Split folder path into parts and try to match each part
    folder_parts = normalized.split('/')

    @name_to_tabs.each do |name, tabs|
      # Check if any folder part matches the tab name
      if folder_parts.any? { |part| part == name || part.include?(name) }
        Rails.logger.debug("[BulkCategorize] Name match for '#{folder_path}' -> #{tabs.first.display_name}")
        return tabs.first
      end
    end

    # Strategy 4: Check if the tab's display_name appears anywhere in the folder path
    @name_to_tabs.each do |name, tabs|
      if normalized.include?(name) && name.length >= 3  # Minimum 3 chars to avoid false positives
        Rails.logger.debug("[BulkCategorize] Contains match for '#{folder_path}' -> #{tabs.first.display_name}")
        return tabs.first
      end
    end

    nil
  end

  # Image extensions that should fallback to Supervisor Photo
  IMAGE_EXTENSIONS = %w[.jpg .jpeg .png .heic .gif .bmp .tiff .webp].freeze
  SUPERVISOR_PHOTO_TYPE_ID = 87  # SSoT: "Supervisor Photo" document type

  def find_matching_document_type(doc, tab)
    extension = ".#{doc.file_extension.to_s.downcase}"

    # If tab has no document types, use fallback
    if tab.document_types.empty?
      return fallback_document_type(extension)
    end

    # Filter to types that accept this file extension
    matching_types = tab.document_types.select do |dt|
      dt.file_extensions&.any? { |ext| ext.downcase == extension }
    end

    # If no match by extension, try all types (some may not have extensions configured)
    matching_types = tab.document_types.to_a if matching_types.empty?

    # If still no match, use fallback
    if matching_types.empty?
      return fallback_document_type(extension)
    end

    # If only one match, return it
    return matching_types.first if matching_types.size == 1

    # If multiple matches, try to pick best by context
    folder_context = doc.folder_path.to_s.downcase
    file_context = doc.file_name.to_s.downcase

    # Try to match by folder context
    context_match = matching_types.find do |dt|
      name_lower = dt.name.to_s.downcase
      folder_context.include?(name_lower) || file_context.include?(name_lower)
    end

    context_match || matching_types.first
  end

  # Fallback document type when tab has no matching types
  def fallback_document_type(extension)
    # Images default to Supervisor Photo
    if IMAGE_EXTENSIONS.include?(extension)
      @supervisor_photo_type ||= DocumentType.find_by(id: SUPERVISOR_PHOTO_TYPE_ID)
      return @supervisor_photo_type
    end

    nil
  end

  def compute_matching_path(tab, parent_path)
    # Use the tab's upload_folder_path (which strips {{JobCode}})
    tab_path = tab.upload_folder_path

    if tab_path.present?
      tab_path
    elsif tab.sharepoint_folder_path.present?
      # Fallback to sharepoint_folder_path
      tab.sharepoint_folder_path.gsub(/\{\{JobCode\}\}\s*\/?/, "").gsub(/^\/+/, "")
    elsif parent_path.present?
      # Build from parent path + display_name
      "#{parent_path}/#{tab.display_name}"
    else
      # Just use display_name
      tab.display_name
    end
  end

  def normalize_path(path)
    return '' if path.blank?
    path.to_s
      .downcase
      .gsub(/^\/+|\/+$/, '')  # Strip leading/trailing slashes
      .gsub(/\/+/, '/')       # Normalize multiple slashes
      .gsub(/\s+/, ' ')       # Normalize spaces
      .strip
  end
end
