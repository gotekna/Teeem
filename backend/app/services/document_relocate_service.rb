# Service to move/rename documents in storage when their metadata changes
# SSoT: Uses DocumentProviderAware for provider-agnostic storage operations
class DocumentRelocateService
  include DocumentProviderAware

  class RelocateError < StandardError; end

  def initialize(document)
    @document = document
  end

  # Relocate document in storage based on updated metadata
  # This handles:
  # - Renaming the file (file_name change)
  # - Moving to different company folder (company_id change)
  # - Moving to different subfolder (folder change)
  def relocate!(new_company_id: nil, new_folder: nil, new_file_name: nil)
    # Check for storage identifier - SSoT: use storage_reference
    file_identifier = @document.storage_reference
    return { success: true, skipped: true, reason: "No storage file" } unless file_identifier.present?

    # Setup provider
    begin
      setup_default_provider!
    rescue DocumentProviders::NotConnectedError => e
      return { success: false, error: "Storage not connected: #{e.message}" }
    end

    actions = []

    # Determine what needs to change
    needs_rename = new_file_name.present? && new_file_name != @document.file_name
    needs_move = (new_company_id.present? && new_company_id.to_s != @document.company_id.to_s) ||
                 (new_folder.present? && new_folder != @document.folder)

    # Calculate target folder path if moving
    target_folder_path = nil
    if needs_move
      target_folder_path = build_target_folder_path(
        company_id: new_company_id || @document.company_id,
        folder: new_folder || @document.folder
      )

      unless target_folder_path
        return { success: false, error: "Could not determine target folder path" }
      end

      # Ensure target folder exists
      get_or_create_folder_path(target_folder_path)
    end

    # Handle rename
    if needs_rename
      # Preserve file extension
      current_extension = File.extname(@document.file_name || "")
      # Sanitize the file_name (remove illegal characters)
      sanitized_name = sanitize_storage_filename(new_file_name)
      new_name = sanitized_name.end_with?(current_extension) ? sanitized_name : "#{sanitized_name}#{current_extension}"
      actions << { type: "rename", from: @document.file_name, to: new_name }
    end

    # Handle move
    if needs_move && target_folder_path
      actions << { type: "move", to_folder: target_folder_path }
    end

    # Execute the operations
    if actions.any?
      # If both rename and move, do move with rename
      if needs_rename && needs_move
        result = move_file_in_provider(file_identifier, target_folder_path, new_name)
      elsif needs_rename
        result = rename_file_in_provider(file_identifier, new_name)
      elsif needs_move
        result = move_file_in_provider(file_identifier, target_folder_path, @document.file_name)
      end

      # Update the document record
      updates = {}
      updates[:file_name] = new_name if needs_rename
      updates[:company_id] = new_company_id if new_company_id.present?
      updates[:folder] = new_folder if new_folder.present?
      updates[:storage_path] = result[:path] if result.is_a?(Hash) && result[:path]

      @document.update!(updates)

      {
        success: true,
        actions: actions,
        message: "Document #{actions.map { |a| a[:type] }.join(' and ')} successful"
      }
    else
      { success: true, skipped: true, reason: "No changes required" }
    end

  rescue DocumentProviders::Error => e
    Rails.logger.error("Document relocate failed: #{e.message}")
    { success: false, error: "Storage API error: #{e.message}" }
  rescue StandardError => e
    Rails.logger.error("Document relocate failed: #{e.class} - #{e.message}")
    { success: false, error: e.message }
  end

  private

  # Sanitize filename for storage - remove illegal characters
  # SSoT: Use centralized filename sanitization
  def sanitize_storage_filename(filename)
    return filename unless defined?(SharePoint::FilenameSanitizer)
    SharePoint::FilenameSanitizer.sanitize(filename)
  end

  # Build target folder path for company/folder combination
  # SSoT: Uses StorageConfiguration for path building
  def build_target_folder_path(company_id:, folder:)
    company = CorporateCompany.find_by(id: company_id)
    return nil unless company

    storage_config = StorageConfiguration.instance
    base_path = storage_config.path_for(:corporate)
    company_folder = company.document_folder_name || company.name

    if folder.present?
      "/#{base_path}/#{company_folder}/#{folder.upcase}"
    else
      "/#{base_path}/#{company_folder}"
    end
  end
end
