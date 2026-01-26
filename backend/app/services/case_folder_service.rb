# Service to manage storage folders for cases
# Creates folders under Documents > Corporate > Case Info
# SSoT: Uses DocumentProviderAware for provider-agnostic storage operations
class CaseFolderService
  include DocumentProviderAware

  def initialize(case_record)
    @case = case_record
  end

  # SSoT: Get case info path from StorageConfiguration
  def case_info_path
    @case_info_path ||= "#{StorageConfiguration.instance.path_for(:corporate)}/Case Info"
  end

  # Create a dedicated folder for this case in storage
  # Returns the folder info hash or nil if storage is not connected
  def create_case_folder
    return nil unless storage_connected?

    # Build folder name from case number and title
    folder_name = build_folder_name

    begin
      # Build full path
      full_path = "/#{case_info_path}/#{folder_name}"

      # Create the folder (including parent folders)
      result = get_or_create_folder_path(full_path)

      if result
        # Save the folder path to the case
        @case.update!(
          storage_folder_id: result[:id],
          storage_folder_path: full_path
        )

        Rails.logger.info "[CaseFolderService] Created storage folder: #{full_path}"
        result
      else
        Rails.logger.error "[CaseFolderService] Failed to create folder at: #{full_path}"
        nil
      end
    rescue DocumentProviders::Error => e
      Rails.logger.error "[CaseFolderService] Storage API error creating folder: #{e.message}"
      nil
    end
  end

  # Get or verify the existing case folder
  def get_case_folder
    return nil unless @case.storage_folder_path.present?

    begin
      setup_default_provider!
      if folder_exists_in_provider?(@case.storage_folder_path)
        { path: @case.storage_folder_path, id: @case.storage_folder_id }
      else
        nil
      end
    rescue DocumentProviders::Error => e
      Rails.logger.warn "[CaseFolderService] Case folder not found: #{e.message}"
      nil
    end
  end

  # Ensure the case has a folder (create if missing)
  def ensure_folder_exists
    return get_case_folder if @case.storage_folder_path.present? && get_case_folder

    create_case_folder
  end

  # Create subfolders within the case folder
  def create_subfolder(name)
    folder = ensure_folder_exists
    return nil unless folder

    subfolder_path = "#{@case.storage_folder_path}/#{name}"
    get_or_create_folder_path(subfolder_path)
  end

  private

  def storage_connected?
    begin
      setup_default_provider!
      true
    rescue DocumentProviders::NotConnectedError
      false
    end
  end

  def build_folder_name
    # Format: CASE-20251205-001 - Robert Harder Bankrupt Estate
    # SSoT: Use centralized filename sanitization if available
    sanitized_title = if defined?(SharePoint::FilenameSanitizer)
      SharePoint::FilenameSanitizer.sanitize_path_segment(@case.title.to_s).truncate(50, omission: "")
    else
      @case.title.to_s.gsub(/[\/\\:*?"<>|]/, "_").truncate(50, omission: "")
    end
    "#{@case.case_number} - #{sanitized_title}"
  end
end
