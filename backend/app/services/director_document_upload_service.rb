class DirectorDocumentUploadService
  DIRECTOR_IDS_FOLDER = "Director IDs"

  DOCUMENT_TYPES = {
    "drivers_licence_front" => "Drivers Licence Front",
    "drivers_licence_back" => "Drivers Licence Back",
    "passport" => "Passport",
    "photo" => "Photo",
    "director_id_confirmation" => "Director ID Confirmation",
    "birth_certificate" => "Birth Certificate",
    "other" => "Other Documents"
  }.freeze

  def initialize
    @credential = MicrosoftCredential.sharepoint_credential
    raise "No active OneDrive credential found" unless @credential
    @client = MicrosoftGraphClient.new(@credential)
  end

  # Upload a file to the director's folder in OneDrive
  # Returns the SharePoint URL for the uploaded file
  def upload_document(director_name:, document_type:, file:, filename: nil)
    folder_id = ensure_director_folder(director_name)

    actual_filename = filename || file.original_filename
    # Prefix with document type for organization
    prefixed_filename = "#{DOCUMENT_TYPES[document_type] || document_type} - #{actual_filename}"

    result = @client.upload_file(file, folder_id, prefixed_filename)

    {
      success: true,
      file_id: result["id"],
      web_url: result["webUrl"],
      name: result["name"],
      size: result["size"]
    }
  rescue => e
    Rails.logger.error "Director document upload failed: #{e.message}"
    { success: false, error: e.message }
  end

  # Get the shareable URL for a file
  def get_share_link(file_id)
    response = @client.post("/drives/#{@credential.drive_id}/items/#{file_id}/createLink", {
      type: "view",
      scope: "organization"
    })
    response.dig("link", "webUrl")
  rescue => e
    Rails.logger.error "Failed to create share link: #{e.message}"
    nil
  end

  # List all documents for a director
  def list_director_documents(director_name)
    folder_id = find_director_folder(director_name)
    return [] unless folder_id

    response = @client.get("/drives/#{@credential.drive_id}/items/#{folder_id}/children")
    response["value"].map do |item|
      {
        id: item["id"],
        name: item["name"],
        web_url: item["webUrl"],
        size: item["size"],
        created_at: item["createdDateTime"],
        modified_at: item["lastModifiedDateTime"]
      }
    end
  rescue => e
    Rails.logger.error "Failed to list director documents: #{e.message}"
    []
  end

  # Scan existing OneDrive folders to find documents for all directors
  def scan_existing_documents
    results = {}

    # Known folders containing director IDs
    id_folder_names = [
      "Director IDs",
      "Andrew Passport Driver Licence etc",
      "Rob & Rach Passport Driver Licence etc"
    ]

    root_response = @client.get("/drives/#{@credential.drive_id}/root/children")

    id_folder_names.each do |folder_name|
      folder = root_response["value"].find { |f| f["name"] == folder_name && f["folder"] }
      next unless folder

      items = @client.get("/drives/#{@credential.drive_id}/items/#{folder['id']}/children")

      items["value"].each do |item|
        director_name = extract_director_name(item["name"], folder_name)
        results[director_name] ||= { folder_name: folder_name, documents: [] }

        if item["folder"]
          # It's a subfolder per director
          subitems = @client.get("/drives/#{@credential.drive_id}/items/#{item['id']}/children")
          subitems["value"].each do |subitem|
            results[director_name][:documents] << {
              name: subitem["name"],
              web_url: subitem["webUrl"],
              type: classify_document(subitem["name"])
            }
          end
        else
          # Direct file
          results[director_name][:documents] << {
            name: item["name"],
            web_url: item["webUrl"],
            type: classify_document(item["name"])
          }
        end
      end
    end

    results
  end

  private

  def ensure_director_folder(director_name)
    folder_id = find_director_folder(director_name)
    return folder_id if folder_id

    # Create the folder
    parent_folder_id = ensure_director_ids_folder
    folder = @client.create_folder(director_name, parent_folder_id)
    folder["id"]
  end

  def find_director_folder(director_name)
    parent_folder_id = find_director_ids_folder
    return nil unless parent_folder_id

    response = @client.get("/drives/#{@credential.drive_id}/items/#{parent_folder_id}/children")
    folder = response["value"].find { |f| f["name"].downcase == director_name.downcase && f["folder"] }
    folder&.dig("id")
  end

  def ensure_director_ids_folder
    folder_id = find_director_ids_folder
    return folder_id if folder_id

    # Create at root
    folder = @client.create_folder(DIRECTOR_IDS_FOLDER, "root")
    folder["id"]
  end

  def find_director_ids_folder
    response = @client.get("/drives/#{@credential.drive_id}/root/children")
    folder = response["value"].find { |f| f["name"] == DIRECTOR_IDS_FOLDER && f["folder"] }
    folder&.dig("id")
  end

  def extract_director_name(filename, folder_name)
    # Try to extract director name from filename
    case folder_name
    when "Andrew Passport Driver Licence etc"
      "Andrew Mark Clement"
    when "Rob & Rach Passport Driver Licence etc"
      if filename.downcase.include?("rachel") || filename.downcase.include?("rach")
        "Rachel Anne Harder"
      elsif filename.downcase.include?("rob")
        "Robert James Harder"
      else
        "Rob & Rachel Harder"
      end
    else
      filename.split(/[-_]/).first&.strip || "Unknown"
    end
  end

  def classify_document(filename)
    name = filename.downcase

    if name.include?("passport")
      "passport"
    elsif name.include?("licence") || name.include?("license")
      "drivers_licence"
    elsif name.include?("photo") || name.include?("img_")
      "photo"
    elsif name.include?("director") && name.include?("id")
      "director_id_confirmation"
    elsif name.include?("birth")
      "birth_certificate"
    else
      "other"
    end
  end
end
