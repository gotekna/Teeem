# Service to upload director ID documents to storage
# SSoT: Uses StorageUploadable for provider-agnostic storage operations
class DirectorDocumentUploadService
  include StorageUploadable

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

  # Upload a file to the director's folder in storage
  # Returns the storage URL for the uploaded file
  def upload_document(director_name:, document_type:, file:, filename: nil)
    actual_filename = filename || file.original_filename
    prefixed_filename = "#{DOCUMENT_TYPES[document_type] || document_type} - #{actual_filename}"
    content = file.respond_to?(:read) ? file.read : file
    folder_path = "/#{DIRECTOR_IDS_FOLDER}/#{director_name}"

    result = upload_to_storage_path(folder_path, content, prefixed_filename, content_type: file.content_type)

    if result[:success]
      result.merge(name: prefixed_filename, size: content.bytesize)
    else
      result
    end
  end

  # Get the shareable URL for a file
  # Note: Share link creation is provider-specific - returns nil for non-SharePoint providers
  def get_share_link(file_id_or_path)
    # For SharePoint, we can create share links
    # For S3/Wasabi, the URL is already accessible (or use presigned URLs)
    storage_config = StorageConfiguration.instance
    return nil unless storage_config.provider_type == "sharepoint"

    # SharePoint-specific share link creation
    credential = MicrosoftCredential.sharepoint_credential
    return nil unless credential

    client = MicrosoftGraphClient.new(credential)
    response = client.post("/drives/#{storage_config.drive_id}/items/#{file_id_or_path}/createLink", {
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
    return [] unless storage_connected?

    folder_path = "/#{DIRECTOR_IDS_FOLDER}/#{director_name}"
    return [] unless folder_exists_in_provider?(folder_path)

    list_folder_in_provider(folder_path).map do |item|
      item.slice(:id, :name, :path, :size, :created_at, :modified_at).merge(
        web_url: item[:web_url] || item[:url]
      )
    end
  rescue StandardError => e
    Rails.logger.error "Failed to list director documents: #{e.message}"
    []
  end

  # Scan existing storage folders to find documents for all directors
  def scan_existing_documents
    return {} unless storage_connected?

    results = {}
    id_folder_names = ["Director IDs", "Andrew Passport Driver Licence etc", "Rob & Rach Passport Driver Licence etc"]

    root_items = list_folder_in_provider("/")

    id_folder_names.each do |folder_name|
      folder = root_items.find { |f| f[:name] == folder_name && f[:is_folder] }
      next unless folder

      list_folder_in_provider("/#{folder_name}").each do |item|
        director_name = extract_director_name(item[:name], folder_name)
        results[director_name] ||= { folder_name: folder_name, documents: [] }

        if item[:is_folder]
          list_folder_in_provider("/#{folder_name}/#{item[:name]}").each do |subitem|
            results[director_name][:documents] << document_info(subitem)
          end
        else
          results[director_name][:documents] << document_info(item)
        end
      end
    end

    results
  rescue StandardError => e
    Rails.logger.error "Failed to scan existing documents: #{e.message}"
    {}
  end

  private

  def document_info(item)
    { name: item[:name], path: item[:path], web_url: item[:web_url] || item[:url], type: classify_document(item[:name]) }
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
