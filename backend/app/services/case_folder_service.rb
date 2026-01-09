# Service to manage OneDrive folders for cases
# Creates folders under Documents > Corporate > Case Info
class CaseFolderService
  CASE_INFO_PATH = "Corporate/Case Info"

  def initialize(case_record)
    @case = case_record
  end

  # Create a dedicated folder for this case in OneDrive
  # Returns the folder info hash or nil if OneDrive is not connected
  def create_case_folder
    return nil unless onedrive_connected?

    # Build folder name from case number and title
    folder_name = build_folder_name

    begin
      # Get or create the Case Info parent folder
      parent_folder = ensure_case_info_folder_exists

      return nil unless parent_folder

      # Create the case-specific folder
      result = graph_client.create_folder(folder_name, parent_id: parent_folder["id"])

      if result && result["id"]
        # Save the folder ID and path to the case
        full_path = "#{CASE_INFO_PATH}/#{folder_name}"
        @case.update!(
          sharepoint_folder_id: result["id"],
          sharepoint_folder_path: full_path
        )

        Rails.logger.info "[CaseFolderService] Created SharePoint folder: #{full_path}"
        result
      else
        Rails.logger.error "[CaseFolderService] Failed to create folder: #{result}"
        nil
      end
    rescue MicrosoftGraphClient::APIError => e
      Rails.logger.error "[CaseFolderService] API error creating folder: #{e.message}"
      nil
    end
  end

  # Get or verify the existing case folder
  def get_case_folder
    return nil unless @case.sharepoint_folder_id.present?

    begin
      graph_client.get_item(@case.sharepoint_folder_id)
    rescue MicrosoftGraphClient::APIError => e
      Rails.logger.warn "[CaseFolderService] Case folder not found: #{e.message}"
      nil
    end
  end

  # Ensure the case has a folder (create if missing)
  def ensure_folder_exists
    return get_case_folder if @case.sharepoint_folder_id.present?

    create_case_folder
  end

  # Create subfolders within the case folder
  def create_subfolder(name)
    folder = ensure_folder_exists
    return nil unless folder

    graph_client.create_folder(name, parent_id: folder["id"])
  end

  private

  def onedrive_connected?
    credential = MicrosoftCredential.sharepoint_credential
    credential&.access_token.present?
  end

  def graph_client
    @graph_client ||= begin
      credential = MicrosoftCredential.sharepoint_credential
      raise "SharePoint not connected for organization" unless credential

      MicrosoftGraphClient.new(credential)
    end
  end

  def build_folder_name
    # Format: CASE-20251205-001 - Robert Harder Bankrupt Estate
    # SSoT: Use centralized SharePoint path sanitization
    sanitized_title = SharePoint::FilenameSanitizer.sanitize_path_segment(@case.title.to_s).truncate(50, omission: "")
    "#{@case.case_number} - #{sanitized_title}"
  end

  def ensure_case_info_folder_exists
    # Try to get existing folder
    folder = graph_client.get_folder_by_path(CASE_INFO_PATH)
    return folder if folder

    # Need to create Corporate and Case Info folders
    corporate_folder = graph_client.get_folder_by_path("Corporate")

    unless corporate_folder
      # Create Corporate folder at root
      corporate_folder = graph_client.create_folder("Corporate")
    end

    return nil unless corporate_folder

    # Create Case Info under Corporate
    graph_client.create_folder("Case Info", parent_id: corporate_folder["id"])
  end
end
