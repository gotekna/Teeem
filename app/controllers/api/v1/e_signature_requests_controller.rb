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

    if request.save
      render json: {
        success: true,
        e_signature_request: request_json(request, include_details: true)
      }, status: :created
    else
      render json: {
        success: false,
        errors: request.errors.full_messages
      }, status: :unprocessable_entity
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
end
