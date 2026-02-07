# frozen_string_literal: true

# WarehousePathComputer - SSoT for computing materialized folder paths
#
# Computes the fully-expanded folder path for a WarehouseDocument by:
# 1. Finding the matching WarehouseFolder template
# 2. Extracting token values from the document's associations/metadata
# 3. Expanding the template with those values
#
# Consolidates logic from:
# - WarehouseDocument#computed_folder_path (runtime resolution)
# - WarehouseDocument#extract_folder_tokens (token extraction)
# - WarehouseProvider#resolve_virtual_path (template expansion)
#
# Usage:
#   computer = WarehousePathComputer.new
#   result = computer.compute(warehouse_document)
#   # => { folder_path: "Job/In Progress/J-001 Smith/Photo",
#   #      warehouse_folder_id: 123,
#   #      path_template_version: 1 }
#
#   # Batch computation (pre-loads associations to avoid N+1)
#   results = computer.compute_batch(WarehouseDocument.where(folder_path: nil).limit(1000))
#   # => [{ id: 1, folder_path: "...", warehouse_folder_id: 123, path_template_version: 1 }, ...]
#
class WarehousePathComputer
  # Compute folder path for a single document
  #
  # @param doc [WarehouseDocument] The document to compute for
  # @return [Hash] { folder_path:, warehouse_folder_id:, path_template_version: }
  def compute(doc)
    # Priority 1: documentable.virtual_folder_path (custom path logic on model)
    # safe_call guards against missing models (e.g. deleted JobDocument class)
    documentable = safe_call { doc.documentable }
    if documentable.present? && documentable.respond_to?(:virtual_folder_path)
      path = safe_call { documentable.virtual_folder_path }
      if path.present?
        folder = find_warehouse_folder_for_doc(doc)
        return {
          folder_path: sanitize_path(path),
          warehouse_folder_id: folder&.id,
          path_template_version: folder&.template_version || 0
        }
      end
    end

    # Priority 2: WarehouseFolder template expansion
    folder = find_warehouse_folder_for_doc(doc)
    if folder
      template = folder.full_folder_path
      tokens = extract_tokens(doc)
      expanded = expand_template(template, tokens)
      if expanded.present?
        return {
          folder_path: sanitize_path(expanded),
          warehouse_folder_id: folder.id,
          path_template_version: folder.template_version
        }
      end
    end

    # Priority 3: WarehouseProvider template expansion (fallback)
    provider_path = compute_via_provider(doc)
    if provider_path.present?
      return {
        folder_path: sanitize_path(provider_path),
        warehouse_folder_id: folder&.id,
        path_template_version: folder&.template_version || 0
      }
    end

    # Priority 4: Default from source_type
    {
      folder_path: doc.source_type_to_root_folder,
      warehouse_folder_id: nil,
      path_template_version: 0
    }
  end

  # Batch compute folder paths for multiple documents
  # Pre-loads associations to avoid N+1 queries
  #
  # @param documents [ActiveRecord::Relation] Documents to compute
  # @return [Array<Hash>] Array of { id:, folder_path:, warehouse_folder_id:, path_template_version: }
  def compute_batch(documents)
    # Pre-load all needed associations
    docs = documents.includes(
      :documentable, :storage_blob, :tenant,
      :warehouse_folder_document_type
    ).to_a

    # Pre-load warehouse folders for all source types in this batch
    source_types = docs.map(&:source_type).uniq
    preload_warehouse_folders(source_types)

    docs.map do |doc|
      result = compute(doc)
      result.merge(id: doc.id)
    end
  end

  private

  # Find the WarehouseFolder that matches this document's source_type
  # Uses the document's warehouse_folder_document_type FK if available,
  # otherwise falls back to source_type -> warehouse_type mapping
  #
  # @param doc [WarehouseDocument]
  # @return [WarehouseFolder, nil]
  def find_warehouse_folder_for_doc(doc)
    # Try FK first (most precise)
    if doc.warehouse_folder_document_type.present?
      return doc.warehouse_folder_document_type.warehouse_folder
    end

    # Fall back to source_type -> warehouse_type code -> root folder
    warehouse_type_code = source_type_to_warehouse_type(doc.source_type, doc)
    @folder_cache ||= {}
    @folder_cache[warehouse_type_code] ||= WarehouseFolder.warehouse_folder_for(warehouse_type_code)
  end

  # Pre-load warehouse folders for given source types into cache
  def preload_warehouse_folders(source_types)
    @folder_cache ||= {}
    # Map source types to warehouse type codes
    codes = source_types.map { |st| source_type_to_warehouse_type(st) }.uniq

    # Load root folders for all codes in one query
    WarehouseFolder.root_folders
      .includes(:warehouse_type)
      .where(warehouse_types: { code: codes })
      .each do |folder|
        @folder_cache[folder.warehouse_type.code] = folder
      end
  end

  # Map source_type to warehouse type code
  # Falls back to linkable_type if source_type has no matching warehouse type
  def source_type_to_warehouse_type(source_type, doc = nil)
    code = case source_type
           when "task" then "task"
           when "email", "email_attachment" then "email"
           when "corporate" then "corporate"
           when "job" then "job"
           when "contact" then "contact"
           when "xero" then "corporate"
           when "case" then "case"
           when "notebook" then "notebook"
           else source_type
           end

    # If warehouse type exists, use it
    return code if warehouse_type_exists?(code)

    # Catch-all: fall back to linkable_type (Job → job, Contact → contact, etc.)
    if doc&.linkable_type.present?
      fallback = case doc.linkable_type
                 when "Job" then "job"
                 when "Contact" then "contact"
                 when "CorporateCompany" then "corporate"
                 when "SmTask" then "task"
                 else nil
                 end
      return fallback if fallback && warehouse_type_exists?(fallback)
    end

    # Last resort
    "unassigned"
  end

  # Extract token values from document for template expansion
  # Reuses the same logic as WarehouseDocument#extract_folder_tokens
  #
  # @param doc [WarehouseDocument]
  # @return [Hash] Token name => value
  def extract_tokens(doc)
    doc.send(:extract_folder_tokens)
  rescue NameError => e
    # Guard against deleted model classes (e.g. JobDocument)
    Rails.logger.debug "[WarehousePathComputer] extract_tokens failed for doc##{doc.id}: #{e.message}"
    fallback_tokens_from_linkable(doc)
  end

  # When documentable class is missing, extract tokens from linkable instead
  def fallback_tokens_from_linkable(doc)
    tokens = {}
    date = doc.created_at || Time.current
    tokens[:Year] = date.year.to_s
    tokens[:Month] = date.strftime("%m")

    case doc.linkable_type
    when "Job"
      job = Job.find_by(id: doc.linkable_id)
      if job
        tokens[:JobCode] = job.job_code
        tokens[:JobName] = job.display_name.presence || job.job_code
      end
    when "Contact"
      contact = Contact.find_by(id: doc.linkable_id)
      tokens[:ContactName] = contact&.display_name.presence || "Contact-#{doc.linkable_id}"
    when "CorporateCompany"
      cc = CorporateCompany.find_by(id: doc.linkable_id)
      if cc
        tokens[:CompanyCode] = cc.company_code
        tokens[:CompanyGroup] = cc.company_group&.name.presence || "Default"
      end
    end

    # Use the old folder column value as a hint for subfolder
    tokens[:Subfolder] = doc.folder if doc.folder.present?

    tokens
  end

  # Cached check for warehouse type existence (avoids N queries during batch)
  def warehouse_type_exists?(code)
    @wt_exists_cache ||= {}
    unless @wt_exists_cache.key?(code)
      @wt_exists_cache[code] = WarehouseType.exists?(code: code)
    end
    @wt_exists_cache[code]
  end

  # Expand a template path with token values
  # e.g., "Job/{{JobCode}}/{{JobName}}/Photo" + {JobCode: "J-001", JobName: "Smith"}
  #     => "Job/J-001/Smith/Photo"
  #
  # @param template [String] Path template with {{Token}} placeholders
  # @param tokens [Hash] Token name => value
  # @return [String] Expanded path
  def expand_template(template, tokens)
    return nil if template.blank?

    result = template.dup
    tokens.each do |key, value|
      result.gsub!("{{#{key}}}", value.to_s) if value.present?
    end

    # Remove any remaining unsubstituted tokens (with surrounding slashes)
    result.gsub!(/\/?\{\{[^\}]+\}\}/, "")
    result
  end

  # Compute via WarehouseProvider as fallback
  def compute_via_provider(doc)
    config = WarehouseProvider.instance rescue nil
    return nil unless config

    warehouse_type = source_type_to_warehouse_type(doc.source_type, doc)
    return nil unless warehouse_type

    tokens = extract_tokens(doc)
    config.resolve_virtual_path(warehouse_type.to_sym, tokens)
  rescue StandardError => e
    Rails.logger.debug "[WarehousePathComputer] Provider fallback failed for doc##{doc.id}: #{e.message}"
    nil
  end

  # Clean up path - remove double slashes, leading/trailing slashes
  def sanitize_path(path)
    return nil if path.blank?

    path = path.gsub(%r{//+}, "/")  # Double slashes
    path = path.gsub(%r{^/|/$}, "") # Leading/trailing slashes
    path.presence
  end

  # Safe call that returns nil on any error
  def safe_call
    yield
  rescue StandardError => e
    Rails.logger.debug "[WarehousePathComputer] safe_call failed: #{e.message}"
    nil
  end
end
