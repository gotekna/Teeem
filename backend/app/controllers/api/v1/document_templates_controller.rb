class Api::V1::DocumentTemplatesController < ApplicationController
  before_action :set_document_template, only: [ :show, :update, :destroy, :preview, :link_sharepoint, :generate_and_send ]

  # ============================================================================
  # SSoT: TeknaDocumentGenerator::TEMPLATES is the source of truth for templates
  # The DocumentTemplate model (database) is DEPRECATED - Dec 2024
  # ============================================================================

  # GET /api/v1/document_templates
  # Returns templates from TeknaDocumentGenerator::TEMPLATES (SSoT)
  # Plus legacy database templates for backwards compatibility
  def index
    # SSoT: TeknaDocumentGenerator templates (active)
    ssot_templates = TeknaDocumentGenerator::TEMPLATES.map do |key, config|
      {
        id: "ssot_#{key}",
        template_key: key.to_s,
        name: config[:title] || key.to_s.titleize,
        category: config[:category],
        template_type: config[:source] == :sharepoint ? "sharepoint_fetch" : "html",
        layout: config[:layout],
        is_active: true,
        is_ssot: true,
        requires: config[:requires],
        output_filename: config[:output_filename],
        qbcc_required: config[:qbcc_required] || false,
        preview_url: "/api/v1/tekna_documents/#{key}/preview?format=html"
      }
    end

    # Filter SSoT templates by category
    if params[:category].present?
      ssot_templates = ssot_templates.select { |t| t[:category] == params[:category] }
    end

    # Also include legacy database templates (marked as deprecated)
    legacy_templates = []
    if params[:include_legacy] == "true"
      templates = DocumentTemplate.all
      templates = templates.by_category(params[:category]) if params[:category].present?
      templates = templates.active if params[:active_only] == "true"
      templates = templates.order(:category, :sort_order, :name)
      legacy_templates = templates.map { |t| template_json(t).merge(is_legacy: true, is_deprecated: true) }
    end

    all_templates = ssot_templates + legacy_templates

    render json: {
      success: true,
      data: all_templates,
      ssot_count: ssot_templates.count,
      legacy_count: legacy_templates.count,
      message: "Templates now sourced from TeknaDocumentGenerator (SSoT). Database templates are deprecated."
    }
  end

  # GET /api/v1/document_templates/ssot
  # Returns ONLY templates from TeknaDocumentGenerator::TEMPLATES
  def ssot
    templates = TeknaDocumentGenerator::TEMPLATES.map do |key, config|
      {
        template_key: key.to_s,
        name: config[:title] || key.to_s.titleize,
        category: config[:category],
        template_type: config[:source] == :sharepoint ? "sharepoint_fetch" : "html",
        layout: config[:layout],
        path: config[:path],
        requires: config[:requires],
        output_filename: config[:output_filename],
        qbcc_required: config[:qbcc_required] || false,
        preview_url: "/api/v1/tekna_documents/#{key}/preview?format=html"
      }
    end

    # Filter by category
    templates = templates.select { |t| t[:category] == params[:category] } if params[:category].present?

    # Group by category for UI
    grouped = templates.group_by { |t| t[:category] }

    render json: {
      success: true,
      data: {
        templates: templates,
        grouped: grouped,
        categories: templates.map { |t| t[:category] }.uniq.compact.sort
      }
    }
  end

  # GET /api/v1/document_templates/ssot/:template_key
  # Get details for a specific SSoT template
  def ssot_show
    key = params[:template_key].to_sym

    unless TeknaDocumentGenerator::TEMPLATES.key?(key)
      return render json: {
        success: false,
        error: "Template not found: #{params[:template_key]}",
        available: TeknaDocumentGenerator::TEMPLATES.keys.map(&:to_s)
      }, status: :not_found
    end

    config = TeknaDocumentGenerator::TEMPLATES[key]

    # Read the template file content for editing
    template_path = Rails.root.join("app/views/tekna_documents/#{config[:path]}.html.erb")
    template_content = File.exist?(template_path) ? File.read(template_path) : nil

    # Read the layout file content
    layout_path = Rails.root.join("app/views/tekna_documents/layouts/#{config[:layout]}.html.erb")
    layout_content = File.exist?(layout_path) ? File.read(layout_path) : nil

    render json: {
      success: true,
      data: {
        template_key: key.to_s,
        name: config[:title] || key.to_s.titleize,
        category: config[:category],
        template_type: config[:source] == :sharepoint ? "sharepoint_fetch" : "html",
        layout: config[:layout],
        path: config[:path],
        requires: config[:requires],
        output_filename: config[:output_filename],
        qbcc_required: config[:qbcc_required] || false,
        preview_url: "/api/v1/tekna_documents/#{key}/preview?format=html",
        # For editor
        template_file_path: template_path.to_s,
        template_content: template_content,
        layout_file_path: layout_path.to_s,
        layout_content: layout_content,
        # Available layouts
        available_layouts: list_available_layouts
      }
    }
  end

  # PUT /api/v1/document_templates/ssot/:template_key
  # Update template content (save to file)
  def ssot_update
    key = params[:template_key].to_sym

    unless TeknaDocumentGenerator::TEMPLATES.key?(key)
      return render json: {
        success: false,
        error: "Template not found: #{params[:template_key]}"
      }, status: :not_found
    end

    config = TeknaDocumentGenerator::TEMPLATES[key]

    # Don't allow editing SharePoint-sourced templates
    if config[:source] == :sharepoint
      return render json: {
        success: false,
        error: "Cannot edit SharePoint-sourced templates"
      }, status: :unprocessable_entity
    end

    updated = []
    errors = []

    # Update template content if provided
    if params[:template_content].present?
      template_path = Rails.root.join("app/views/tekna_documents/#{config[:path]}.html.erb")

      begin
        # Ensure directory exists
        FileUtils.mkdir_p(File.dirname(template_path))

        # Backup existing file
        if File.exist?(template_path)
          backup_path = "#{template_path}.backup.#{Time.current.strftime('%Y%m%d%H%M%S')}"
          FileUtils.cp(template_path, backup_path)
        end

        # Write new content
        File.write(template_path, params[:template_content])
        updated << "template"
        Rails.logger.info "[TemplateEditor] Updated template: #{template_path}"
      rescue StandardError => e
        errors << "Failed to save template: #{e.message}"
        Rails.logger.error "[TemplateEditor] Error saving template #{template_path}: #{e.message}"
      end
    end

    if errors.any?
      render json: { success: false, errors: errors }, status: :unprocessable_entity
    else
      render json: {
        success: true,
        message: "Updated: #{updated.join(', ')}",
        updated: updated
      }
    end
  end

  # GET /api/v1/document_templates/layouts
  # List all available layouts with their content
  def layouts
    layouts_dir = Rails.root.join("app/views/tekna_documents/layouts")
    layouts = []

    if Dir.exist?(layouts_dir)
      Dir.glob("#{layouts_dir}/*.html.erb").each do |file|
        name = File.basename(file, ".html.erb")
        content = File.read(file)

        layouts << {
          name: name,
          display_name: name.titleize,
          file_path: file,
          content: content,
          description: layout_description(name)
        }
      end
    end

    render json: {
      success: true,
      data: layouts.sort_by { |l| l[:name] }
    }
  end

  # GET /api/v1/document_templates/layouts/:name
  # Get a specific layout's content
  def layout_show
    name = params[:name].to_s.gsub(/[^a-z0-9_-]/i, "")
    layout_path = Rails.root.join("app/views/tekna_documents/layouts/#{name}.html.erb")

    unless File.exist?(layout_path)
      return render json: {
        success: false,
        error: "Layout not found: #{name}"
      }, status: :not_found
    end

    render json: {
      success: true,
      data: {
        name: name,
        display_name: name.titleize,
        file_path: layout_path.to_s,
        content: File.read(layout_path),
        description: layout_description(name),
        # Templates using this layout
        templates_using: TeknaDocumentGenerator::TEMPLATES.select { |_, c| c[:layout] == name }.keys.map(&:to_s)
      }
    }
  end

  # PUT /api/v1/document_templates/layouts/:name
  # Update a layout's content
  def layout_update
    name = params[:name].to_s.gsub(/[^a-z0-9_-]/i, "")
    layout_path = Rails.root.join("app/views/tekna_documents/layouts/#{name}.html.erb")

    unless File.exist?(layout_path)
      return render json: {
        success: false,
        error: "Layout not found: #{name}"
      }, status: :not_found
    end

    unless params[:content].present?
      return render json: {
        success: false,
        error: "Content is required"
      }, status: :unprocessable_entity
    end

    begin
      # Backup existing file
      backup_path = "#{layout_path}.backup.#{Time.current.strftime('%Y%m%d%H%M%S')}"
      FileUtils.cp(layout_path, backup_path)

      # Write new content
      File.write(layout_path, params[:content])
      Rails.logger.info "[TemplateEditor] Updated layout: #{layout_path}"

      render json: {
        success: true,
        message: "Layout '#{name}' updated successfully",
        backup_path: backup_path
      }
    rescue StandardError => e
      Rails.logger.error "[TemplateEditor] Error saving layout #{layout_path}: #{e.message}"
      render json: {
        success: false,
        error: "Failed to save layout: #{e.message}"
      }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/document_templates/:id
  def show
    render json: {
      success: true,
      data: template_json(@document_template, include_fields: true)
    }
  end

  # POST /api/v1/document_templates
  def create
    template = DocumentTemplate.new(document_template_params)

    if template.save
      render json: {
        success: true,
        data: template_json(template)
      }, status: :created
    else
      render json: {
        success: false,
        errors: template.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/document_templates/:id
  def update
    if @document_template.update(document_template_params)
      render json: {
        success: true,
        data: template_json(@document_template)
      }
    else
      render json: {
        success: false,
        errors: @document_template.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/document_templates/:id
  def destroy
    if @document_template.destroy
      render json: {
        success: true,
        message: "Document template deleted successfully"
      }
    else
      render json: {
        success: false,
        errors: [ "Failed to delete document template" ]
      }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/document_templates/categories
  def categories
    render json: {
      success: true,
      categories: DocumentTemplate::CATEGORIES
    }
  end

  # GET /api/v1/document_templates/:id/preview
  # Preview the document with sample data
  # DEPRECATED: Word templates removed Dec 2024. Use TeknaDocumentGenerator instead.
  def preview
    render json: {
      success: false,
      errors: [ "Word template preview is no longer supported. Use TeknaDocumentGenerator templates instead." ]
    }, status: :gone
  end

  # POST /api/v1/document_templates/:id/link_sharepoint
  # Link template to a SharePoint file
  def link_sharepoint
    site_id = params[:site_id]
    drive_id = params[:drive_id]
    item_id = params[:item_id]
    sharepoint_path = params[:sharepoint_path]

    if [ site_id, drive_id, item_id ].any?(&:blank?)
      render json: {
        success: false,
        errors: [ "site_id, drive_id, and item_id are required" ]
      }, status: :unprocessable_entity
      return
    end

    # Verify the file exists in SharePoint
    begin
      client = MicrosoftAppGraphClient.new
      item = client.get_drive_item(drive_id, item_id)

      unless item[:name].end_with?(".docx")
        render json: {
          success: false,
          errors: [ "File must be a Word document (.docx)" ]
        }, status: :unprocessable_entity
        return
      end

      @document_template.update!(
        sharepoint_site_id: site_id,
        sharepoint_drive_id: drive_id,
        sharepoint_item_id: item_id,
        sharepoint_path: sharepoint_path || item[:name]
      )

      render json: {
        success: true,
        data: template_json(@document_template),
        sharepoint_file: {
          name: item[:name],
          web_url: item[:web_url],
          size: item[:size]
        }
      }
    rescue MicrosoftAppGraphClient::ApiError => e
      render json: {
        success: false,
        errors: [ "Failed to verify SharePoint file: #{e.message}" ]
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/document_templates/:id/generate_and_send
  # Generate document from template and send for e-signature
  def generate_and_send
    job = Job.find_by(id: params[:job_id])

    unless job
      render json: {
        success: false,
        errors: [ "Job not found" ]
      }, status: :not_found
      return
    end

    unless @document_template.sharepoint_linked?
      render json: {
        success: false,
        errors: [ "Template not linked to SharePoint file" ]
      }, status: :unprocessable_entity
      return
    end

    # Build signers from params or from job contacts
    signers = build_signers(job, params[:signers])

    if signers.empty?
      render json: {
        success: false,
        errors: [ "At least one signer is required" ]
      }, status: :unprocessable_entity
      return
    end

    # Execute the service
    service = DocumentEsignService.new(
      template: @document_template,
      job: job,
      signers: signers,
      title: params[:title],
      description: params[:description],
      message_to_signers: params[:message_to_signers],
      signing_order: params[:signing_order]&.to_i || 0,
      expires_in_days: params[:expires_in_days]&.to_i || 30,
      auto_send: params[:auto_send] != false,
      extra_data: params[:extra_data]&.to_unsafe_h || {}
    )

    result = service.execute!

    render json: {
      success: true,
      message: "Document generated and sent for e-signature",
      e_signature_request: {
        id: result[:e_signature_request].id,
        request_number: result[:request_number],
        status: result[:status],
        signers_count: result[:signers_count]
      },
      document: {
        filename: result[:document_filename],
        sharepoint_id: result[:document_sharepoint_id]
      }
    }
  rescue DocumentEsignService::Error => e
    render json: {
      success: false,
      errors: [ e.message ]
    }, status: :unprocessable_entity
  rescue StandardError => e
    render json: {
      success: false,
      errors: [ "Document generation failed: #{e.message}" ]
    }, status: :unprocessable_entity
  end

  # GET /api/v1/document_templates/sharepoint_files
  # List available template files from SharePoint
  def sharepoint_files
    folder_path = params[:folder_path] || "Templates"

    begin
      client = MicrosoftAppGraphClient.new

      # Get the TEEEM site
      sites = client.get_all_sites
      teeem_site = sites.find { |s| s[:name] == "TEEEM" || s[:display_name] == "TEEEM" }

      unless teeem_site
        render json: {
          success: false,
          errors: [ "TEEEM SharePoint site not found" ]
        }, status: :not_found
        return
      end

      # Get the document drive - SSoT: Use configured drive name from StorageConfiguration
      drives = client.get_site_drives(teeem_site[:id])
      # SSoT: drive_name comes from StorageConfiguration - try configured name first, then common defaults
      configured_drive_name = StorageConfiguration.instance&.drive_name
      documents_drive = drives.find do |d|
        (configured_drive_name.present? && d[:name] == configured_drive_name) ||
        d[:name] == "Documents" ||
        d[:name] == "Shared Documents"
      end

      unless documents_drive
        render json: {
          success: false,
          errors: [ "Documents drive not found" ]
        }, status: :not_found
        return
      end

      # List files in the folder
      items = client.list_drive_items(documents_drive[:id], folder_path: folder_path)

      # Filter to only DOCX files and folders
      files = items.select { |i| i[:is_folder] || i[:name].end_with?(".docx") }

      render json: {
        success: true,
        site_id: teeem_site[:id],
        drive_id: documents_drive[:id],
        folder_path: folder_path,
        files: files.map do |f|
          {
            id: f[:id],
            name: f[:name],
            is_folder: f[:is_folder],
            size: f[:size],
            web_url: f[:web_url],
            modified_at: f[:modified_at]
          }
        end
      }
    rescue MicrosoftAppGraphClient::ApiError, MicrosoftAppGraphClient::NotConnectedError => e
      render json: {
        success: false,
        errors: [ e.message ]
      }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/document_templates/sharepoint_download/:item_id
  # Download a file from SharePoint by item ID
  # Used to download PDF templates from SharePoint to local templates folder
  def sharepoint_download
    item_id = params[:item_id]

    unless item_id.present?
      return render json: {
        success: false,
        error: "item_id is required"
      }, status: :bad_request
    end

    begin
      # SSoT: Use MicrosoftCredential for auth, StorageConfiguration for drive_id
      cred = MicrosoftCredential.sharepoint_credential
      storage_config = StorageConfiguration.instance
      unless cred && storage_config&.connected?
        return render json: {
          success: false,
          error: "SharePoint not configured. Please connect in Admin > System > Connections."
        }, status: :service_unavailable
      end

      client = MicrosoftAppGraphClient.new(cred)
      drive_id = storage_config.drive_id

      # Get file content
      content = client.get_drive_item_content(
        drive_id: drive_id,
        item_id: item_id
      )

      # Get file info for the name
      item_info = client.get("/drives/#{drive_id}/items/#{item_id}")
      filename = item_info["name"] || "download.pdf"

      send_data content,
        filename: filename,
        type: "application/octet-stream",
        disposition: "attachment"
    rescue MicrosoftAppGraphClient::ApiError => e
      render json: {
        success: false,
        error: "SharePoint error: #{e.message}"
      }, status: :unprocessable_entity
    end
  end

  private

  def set_document_template
    @document_template = DocumentTemplate.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: {
      success: false,
      errors: [ "Document template not found" ]
    }, status: :not_found
  end

  def document_template_params
    params.require(:document_template).permit(
      :name, :description, :category,
      :output_format, :output_naming_pattern,
      :is_active, :sort_order,
      :template_type, :local_template_path, :layout,
      :is_legal_format, :legal_source,
      data_schema: {}
    )
  end

  def build_signers(job, signers_params)
    signers = []

    if signers_params.present?
      # Build from explicit params
      signers_params.each do |signer_param|
        if signer_param[:contact_id].present?
          contact = Contact.find_by(id: signer_param[:contact_id])
          signers << { contact: contact, role: signer_param[:role] || "signer" } if contact
        elsif signer_param[:contact_key].present?
          contact = resolve_contact_from_job(job, signer_param[:contact_key])
          signers << { contact: contact, role: signer_param[:role] || signer_param[:contact_key] } if contact
        elsif signer_param[:email].present?
          signers << {
            name: signer_param[:name],
            email: signer_param[:email],
            role: signer_param[:role] || "signer"
          }
        end
      end
    else
      # Default: use all job clients
      job.job_contacts.where(role: "client").includes(:contact).each do |jc|
        signers << { contact: jc.contact, role: "client" } if jc.contact&.email.present?
      end
    end

    signers
  end

  def resolve_contact_from_job(job, key)
    case key.to_s
    when "primary_contact", "client_1"
      job.primary_contact
    when "secondary_contact", "client_2"
      job.secondary_contact
    when "builder", "builder_contact"
      job.builder_contact
    else
      job.job_contacts.find_by(role: key)&.contact
    end
  end

  def template_json(template, include_fields: false)
    json = {
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      output_format: template.output_format,
      output_naming_pattern: template.output_naming_pattern,
      is_active: template.is_active,
      sort_order: template.sort_order,
      sharepoint_linked: template.sharepoint_linked?,
      sharepoint_path: template.sharepoint_path,
      # New unified template fields
      template_type: template.template_type,
      local_template_path: template.local_template_path,
      layout: template.layout,
      is_legal_format: template.is_legal_format,
      legal_source: template.legal_source,
      created_at: template.created_at,
      updated_at: template.updated_at
    }

    if include_fields
      json[:available_fields] = template.available_fields
      json[:data_schema] = template.data_schema
      json[:sharepoint_site_id] = template.sharepoint_site_id
      json[:sharepoint_drive_id] = template.sharepoint_drive_id
      json[:sharepoint_item_id] = template.sharepoint_item_id
    end

    json
  end

  # List all available layouts from the layouts directory
  def list_available_layouts
    layouts_dir = Rails.root.join("app/views/tekna_documents/layouts")
    return [] unless Dir.exist?(layouts_dir)

    Dir.glob("#{layouts_dir}/*.html.erb").map do |file|
      File.basename(file, ".html.erb")
    end.sort
  end

  # Get description for a layout
  def layout_description(name)
    case name
    when "tekna"
      "Tekna branded layout with logo, header and footer. Used for Welcome Letter, Specs, etc."
    when "qbcc_official"
      "Plain layout matching official QBCC document format. No branding."
    when "none"
      "No layout - used for passthrough documents"
    else
      "Custom layout"
    end
  end
end
