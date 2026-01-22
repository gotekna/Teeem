class Api::V1::ESignatureRequestsController < ApplicationController
  before_action :set_request, only: [ :show, :update, :destroy, :send_for_signing, :cancel, :audit_trail, :certificate ]

  # GET /api/v1/e_signature_requests
  def index
    requests = ESignatureRequest.includes(:signers, :created_by)

    # Filter by status
    requests = requests.by_status(params[:status]) if params[:status].present?

    # Filter by documentable
    if params[:documentable_type].present? && params[:documentable_id].present?
      requests = requests.where(
        documentable_type: params[:documentable_type],
        documentable_id: params[:documentable_id]
      )
    end

    requests = requests.order(created_at: :desc)

    render json: {
      success: true,
      e_signature_requests: requests.map { |r| request_json(r) }
    }
  end

  # GET /api/v1/e_signature_requests/:id
  def show
    render json: {
      success: true,
      e_signature_request: request_json(@request, include_details: true)
    }
  end

  # POST /api/v1/e_signature_requests
  def create
    request = ESignatureRequest.new(request_params)
    request.created_by = current_user

    # Handle fields with signer_index mapping
    fields_data = params.dig(:e_signature_request, :fields_attributes)

    ActiveRecord::Base.transaction do
      if request.save
        # If fields were provided with signer_index, create them after signers exist
        if fields_data.present?
          create_fields_with_signer_mapping(request, fields_data)
        end

        render json: {
          success: true,
          data: { id: request.id },
          e_signature_request: request_json(request.reload, include_details: true)
        }, status: :created
      else
        render json: {
          success: false,
          errors: request.errors.full_messages
        }, status: :unprocessable_entity
        raise ActiveRecord::Rollback
      end
    end
  end

  # PATCH /api/v1/e_signature_requests/:id
  def update
    unless @request.status == "draft"
      render json: {
        success: false,
        errors: [ "Cannot update a request that has been sent" ]
      }, status: :unprocessable_entity
      return
    end

    if @request.update(request_params)
      render json: {
        success: true,
        e_signature_request: request_json(@request, include_details: true)
      }
    else
      render json: {
        success: false,
        errors: @request.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/e_signature_requests/:id
  def destroy
    unless @request.status == "draft"
      render json: {
        success: false,
        errors: [ "Cannot delete a request that has been sent. Cancel it instead." ]
      }, status: :unprocessable_entity
      return
    end

    if @request.destroy
      render json: {
        success: true,
        message: "E-signature request deleted"
      }
    else
      render json: {
        success: false,
        errors: [ "Failed to delete request" ]
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/e_signature_requests/:id/send
  def send_for_signing
    unless @request.can_send?
      render json: {
        success: false,
        errors: [ "Cannot send this request. Status: #{@request.status}, Signers: #{@request.signers.count}" ]
      }, status: :unprocessable_entity
      return
    end

    if @request.send_for_signing!
      render json: {
        success: true,
        e_signature_request: request_json(@request, include_details: true),
        message: "Request sent to #{@request.signers.count} signers"
      }
    else
      render json: {
        success: false,
        errors: [ "Failed to send request" ]
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/e_signature_requests/:id/cancel
  def cancel
    unless @request.can_cancel?
      render json: {
        success: false,
        errors: [ "Cannot cancel this request" ]
      }, status: :unprocessable_entity
      return
    end

    if @request.cancel!(reason: params[:reason])
      render json: {
        success: true,
        e_signature_request: request_json(@request),
        message: "Request cancelled"
      }
    else
      render json: {
        success: false,
        errors: [ "Failed to cancel request" ]
      }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/e_signature_requests/:id/audit_trail
  def audit_trail
    events = @request.events.chronological.map(&:to_audit_entry)

    render json: {
      success: true,
      request_number: @request.request_number,
      title: @request.title,
      audit_trail: events
    }
  end

  # GET /api/v1/e_signature_requests/:id/certificate
  def certificate
    unless @request.status == "completed"
      render json: {
        success: false,
        errors: [ "Certificate only available for completed requests" ]
      }, status: :unprocessable_entity
      return
    end

    cert = @request.certificate
    unless cert
      render json: {
        success: false,
        errors: [ "Certificate not generated yet" ]
      }, status: :not_found
      return
    end

    if params[:format] == "pdf"
      send_data cert.generate_pdf,
                filename: "#{cert.certificate_number}.pdf",
                type: "application/pdf",
                disposition: "attachment"
    else
      render json: {
        success: true,
        certificate: cert.to_certificate_data
      }
    end
  end

  # POST /api/v1/e_signature_requests/:id/signers
  def add_signer
    @request = ESignatureRequest.find(params[:e_signature_request_id])

    unless @request.status == "draft"
      render json: {
        success: false,
        errors: [ "Cannot add signers after request has been sent" ]
      }, status: :unprocessable_entity
      return
    end

    signer = @request.signers.build(signer_params)

    if signer.save
      render json: {
        success: true,
        signer: signer_json(signer)
      }, status: :created
    else
      render json: {
        success: false,
        errors: signer.errors.full_messages
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/e_signature_requests/:id/signers/:signer_id
  def remove_signer
    @request = ESignatureRequest.find(params[:e_signature_request_id])
    signer = @request.signers.find(params[:id])

    unless @request.status == "draft"
      render json: {
        success: false,
        errors: [ "Cannot remove signers after request has been sent" ]
      }, status: :unprocessable_entity
      return
    end

    if signer.destroy
      render json: {
        success: true,
        message: "Signer removed"
      }
    else
      render json: {
        success: false,
        errors: [ "Failed to remove signer" ]
      }, status: :unprocessable_entity
    end
  end

  private

  def set_request
    @request = ESignatureRequest.find(params[:id])
  rescue ActiveRecord::RecordNotFound
    render json: {
      success: false,
      errors: [ "E-signature request not found" ]
    }, status: :not_found
  end

  def request_params
    params.require(:e_signature_request).permit(
      :title,
      :description,
      :documentable_type,
      :documentable_id,
      :signing_order,
      :expires_at,
      :send_reminders,
      :reminder_interval_days,
      :message_to_signers,
      :original_storage_file_id,
      :storage_site_id,
      :storage_drive_id,
      # Legacy params for backwards compatibility
      :original_sharepoint_file_id,
      :sharepoint_site_id,
      :sharepoint_drive_id,
      signers_attributes: [ :id, :name, :email, :role, :signing_order, :contact_id, :_destroy ]
    )
  end

  def signer_params
    params.require(:signer).permit(:name, :email, :role, :signing_order, :contact_id)
  end

  def request_json(request, include_details: false)
    json = {
      id: request.id,
      request_number: request.request_number,
      title: request.title,
      description: request.description,
      status: request.status,
      signing_order: request.signing_order,
      progress: request.progress_percentage,
      signed_count: request.signed_count,
      total_signers: request.signers.count,
      sent_at: request.sent_at,
      expires_at: request.expires_at,
      completed_at: request.completed_at,
      created_at: request.created_at,
      created_by: request.created_by&.email
    }

    if include_details
      json[:signers] = request.signers.by_signing_order.map { |s| signer_json(s) }
      json[:fields] = request.fields.by_page.map { |f| field_json(f) }
      json[:has_positioned_fields] = request.fields.any?
      json[:documentable] = {
        type: request.documentable_type,
        id: request.documentable_id
      } if request.documentable_type
      json[:message_to_signers] = request.message_to_signers
      json[:send_reminders] = request.send_reminders
      json[:reminder_interval_days] = request.reminder_interval_days
      json[:has_certificate] = request.certificate.present?
    end

    json
  end

  def signer_json(signer)
    {
      id: signer.id,
      name: signer.name,
      email: signer.email,
      role: signer.role,
      status: signer.status,
      signing_order: signer.signing_order,
      notified_at: signer.notified_at,
      viewed_at: signer.viewed_at,
      signed_at: signer.signed_at,
      declined_at: signer.declined_at,
      can_sign: signer.can_sign?,
      contact_id: signer.contact_id
    }
  end

  def field_json(field)
    {
      id: field.id,
      field_type: field.field_type,
      page_number: field.page_number,
      x_percent: field.x_percent,
      y_percent: field.y_percent,
      width_percent: field.width_percent,
      height_percent: field.height_percent,
      label: field.label,
      required: field.required,
      date_format: field.date_format,
      placeholder: field.placeholder,
      completed: field.complete?,
      signer_id: field.e_signature_signer_id,
      signer_email: field.e_signature_signer&.email
    }
  end

  # Create fields and map signer_index to actual signer IDs
  def create_fields_with_signer_mapping(request, fields_data)
    signers = request.signers.order(:signing_order).to_a

    fields_data.each do |field_data|
      field_params = field_data.permit(
        :field_type, :page_number, :x_percent, :y_percent,
        :width_percent, :height_percent, :label, :required,
        :date_format, :placeholder, :signer_index
      )

      signer_index = field_params.delete(:signer_index)&.to_i || 0
      signer = signers[signer_index]

      next unless signer # Skip if signer not found

      request.fields.create!(
        field_params.merge(e_signature_signer: signer)
      )
    end
  end
end
