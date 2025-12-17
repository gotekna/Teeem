class Api::V1::DocumentTemplatesController < ApplicationController
  before_action :set_document_template, only: [ :show, :update, :destroy, :preview, :link_sharepoint, :generate_and_send ]

  # GET /api/v1/document_templates
  def index
    templates = DocumentTemplate.all

    # Filter by category
    templates = templates.by_category(params[:category]) if params[:category].present?

    # Filter by active status
    templates = templates.active if params[:active_only] == "true"

    templates = templates.order(:category, :name)

    render json: {
      success: true,
      document_templates: templates.map { |t| template_json(t) }
    }
  end

  # GET /api/v1/document_templates/:id
  def show
    render json: {
      success: true,
      document_template: template_json(@document_template, include_fields: true)
    }
  end

  # POST /api/v1/document_templates
  def create
    template = DocumentTemplate.new(document_template_params)

    if template.save
      render json: {
        success: true,
        document_template: template_json(template)
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
        document_template: template_json(@document_template)
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
  def preview
    job = Job.find_by(id: params[:job_id])
    contact = Contact.find_by(id: params[:contact_id])

    unless @document_template.sharepoint_linked?
      render json: {
        success: false,
        errors: [ "Template not linked to SharePoint file" ]
      }, status: :unprocessable_entity
      return
    end

    generator = DocumentGenerator.new(@document_template)
    result = generator.generate(job: job, contact: contact)

    # Return the generated document as download
    send_data result[:docx_content],
              filename: result[:filename],
              type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              disposition: "attachment"
  rescue DocumentGenerator::GenerationError, DocumentGenerator::TemplateError => e
    render json: {
      success: false,
      errors: [ e.message ]
    }, status: :unprocessable_entity
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
        document_template: template_json(@document_template),
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
  rescue DocumentGenerator::GenerationError, DocumentGenerator::TemplateError => e
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

      # Get the document drive
      drives = client.get_site_drives(teeem_site[:id])
      documents_drive = drives.find { |d| d[:name] == "Shared Documents" || d[:name] == "Documents" }

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
      :is_active,
      data_schema: {}
    )
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
      sharepoint_linked: template.sharepoint_linked?,
      sharepoint_path: template.sharepoint_path,
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
end
