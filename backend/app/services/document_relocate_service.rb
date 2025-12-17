# Service to move/rename documents in OneDrive when their metadata changes
class DocumentRelocateService
  class RelocateError < StandardError; end

  def initialize(document)
    @document = document
    @credential = OrganizationOneDriveCredential.active_credential
    @client = MicrosoftGraphClient.new(@credential) if @credential
  end

  # Relocate document in OneDrive based on updated metadata
  # This handles:
  # - Renaming the file (title change)
  # - Moving to different company folder (company_id change)
  # - Moving to different subfolder (folder change)
  def relocate!(new_company_id: nil, new_folder: nil, new_title: nil)
    return { success: true, skipped: true, reason: "No OneDrive file" } unless @document.sharepoint_file_id.present?
    return { success: false, error: "No OneDrive credential" } unless @client

    actions = []
    drive_id = @credential.drive_id

    # Get current file info
    current_file = @client.get("/drives/#{drive_id}/items/#{@document.sharepoint_file_id}")

    # Determine what needs to change
    needs_rename = new_title.present? && new_title != @document.title
    needs_move = (new_company_id.present? && new_company_id.to_s != @document.company_id.to_s) ||
                 (new_folder.present? && new_folder != @document.folder)

    # Calculate target folder if moving
    if needs_move
      target_folder_id = find_target_folder_id(
        company_id: new_company_id || @document.company_id,
        folder: new_folder || @document.folder
      )

      unless target_folder_id
        return { success: false, error: "Target folder not found in OneDrive" }
      end
    end

    # Build the update payload
    update_payload = {}

    # Add rename if needed
    if needs_rename
      # Preserve file extension
      current_extension = File.extname(current_file["name"])
      # Sanitize the title for OneDrive (remove illegal characters)
      sanitized_title = sanitize_onedrive_filename(new_title)
      new_name = sanitized_title.end_with?(current_extension) ? sanitized_title : "#{sanitized_title}#{current_extension}"
      update_payload[:name] = new_name
      actions << { type: "rename", from: current_file["name"], to: new_name }
    end

    # Add move if needed
    if needs_move && target_folder_id
      update_payload[:parentReference] = { id: target_folder_id }
      actions << { type: "move", to_folder: target_folder_id }
    end

    # Execute the update if there are changes
    if update_payload.present?
      @client.patch("/drives/#{drive_id}/items/#{@document.sharepoint_file_id}", update_payload)

      # Update the document record
      updates = {}
      updates[:title] = new_title if needs_rename
      updates[:company_id] = new_company_id if new_company_id.present?
      updates[:folder] = new_folder if new_folder.present?

      @document.update!(updates)

      {
        success: true,
        actions: actions,
        message: "Document #{actions.map { |a| a[:type] }.join(' and ')} successful"
      }
    else
      { success: true, skipped: true, reason: "No changes required" }
    end

  rescue MicrosoftGraphClient::APIError => e
    Rails.logger.error("Document relocate failed: #{e.message}")
    { success: false, error: "OneDrive API error: #{e.message}" }
  rescue StandardError => e
    Rails.logger.error("Document relocate failed: #{e.class} - #{e.message}")
    { success: false, error: e.message }
  end

  private

  # Sanitize filename for OneDrive - remove characters not allowed by Microsoft
  # Invalid characters: " * : < > ? / \ |
  # Also remove leading/trailing spaces and periods
  def sanitize_onedrive_filename(filename)
    return "" if filename.blank?

    # Remove invalid characters for OneDrive/SharePoint
    sanitized = filename.gsub(/["*:<>?\/\\|]/, "")

    # Replace multiple spaces with single space
    sanitized = sanitized.gsub(/\s+/, " ")

    # Remove leading/trailing spaces and periods
    sanitized = sanitized.strip.gsub(/^\.+|\.+$/, "")

    # Ensure not empty after sanitization
    sanitized.presence || "Untitled"
  end

  # Find the OneDrive folder ID for the target company/folder
  def find_target_folder_id(company_id:, folder:)
    company = CorporateCompany.find_by(id: company_id)
    return nil unless company

    drive_id = @credential.drive_id

    # First, find or verify company folder
    company_folder_id = company.onedrive_folder_id

    unless company_folder_id
      # Try to find company folder by name in the root
      base_path = CorporateCompanySetting.company_documents_base_path
      root_items = @client.get("/drives/#{drive_id}/root:/#{base_path}:/children")
      company_folder = root_items["value"]&.find { |item| item["name"] == company.name && item["folder"].present? }
      company_folder_id = company_folder&.dig("id")

      # Update company record if found
      company.update(onedrive_folder_id: company_folder_id) if company_folder_id
    end

    return nil unless company_folder_id

    # If no specific folder requested, return company root
    return company_folder_id unless folder.present?

    # Find subfolder within company folder
    subfolders = @client.get("/drives/#{drive_id}/items/#{company_folder_id}/children")
    target_subfolder = subfolders["value"]&.find do |item|
      item["folder"].present? && item["name"].upcase == folder.upcase
    end

    if target_subfolder
      target_subfolder["id"]
    else
      # Create the folder if it doesn't exist
      create_folder(company_folder_id, folder)
    end
  end

  # Create a folder if it doesn't exist
  def create_folder(parent_id, folder_name)
    drive_id = @credential.drive_id

    result = @client.post("/drives/#{drive_id}/items/#{parent_id}/children", {
      name: folder_name.upcase,
      folder: {},
      "@microsoft.graph.conflictBehavior" => "fail"
    })

    result["id"]
  rescue MicrosoftGraphClient::APIError => e
    # Folder might already exist, try to get it
    if e.message.include?("nameAlreadyExists")
      subfolders = @client.get("/drives/#{drive_id}/items/#{parent_id}/children")
      target = subfolders["value"]&.find { |item| item["name"].upcase == folder_name.upcase }
      return target["id"] if target
    end
    nil
  end
end
