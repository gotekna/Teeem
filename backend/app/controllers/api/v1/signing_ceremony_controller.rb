# Public controller for the e-signature signing ceremony.
# This controller uses token-based authentication, not JWT.
#
# ⚠️ DO NOT SIMPLIFY - Tenant context required for SaaS (Feb 2026)
# ════════════════════════════════════════════════════════════════
# Why: This is a PUBLIC controller (no JWT auth). Without explicit tenant
# context, TenantSetting.instance and MicrosoftCredential lookups fall back
# to Tenant.first - which breaks in multi-tenant SaaS (wrong credentials,
# wrong from address). We resolve the tenant from signer → request → user → tenant.
# ════════════════════════════════════════════════════════════════
class Api::V1::SigningCeremonyController < ApplicationController
  skip_before_action :authorize_request
  before_action :authenticate_signer, except: [ :verify_token, :download_signed_document ]
  before_action :set_tenant_from_signer, except: [ :verify_token, :download_signed_document ]

  # GET /api/v1/sign/:token
  # Verify the token and get signing session info
  def verify_token
    token = params[:token]

    signer = find_signer_by_token(token)

    unless signer
      render json: {
        success: false,
        errors: [ "Invalid or expired signing link" ]
      }, status: :unauthorized
      return
    end

    request = signer.e_signature_request

    # Check if request is still valid
    if request.status.in?(%w[completed declined expired cancelled])
      render json: {
        success: false,
        errors: [ "This signing request is no longer active" ],
        status: request.status
      }, status: :gone
      return
    end

    # Get this signer's fields (if positioned signing is used)
    signer_fields = signer.fields.by_page.map do |field|
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
        value: field.value
      }
    end

    # Set tenant context for this request (SSoT for SaaS)
    set_tenant_from_request(signer.e_signature_request)

    # Check tenant setting for email verification requirement
    email_verification_required = resolve_email_verification_required(signer)

    render json: {
      success: true,
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        role: signer.role,
        status: signer.status,
        can_sign: signer.can_sign?,
        email_verified: signer.email_verified?,
        email_verification_required: email_verification_required
      },
      request: {
        id: request.id,
        request_number: request.request_number,
        title: request.title,
        description: request.description,
        expires_at: request.expires_at,
        has_positioned_fields: request.fields.any?,
        other_signers: request.signers.where.not(id: signer.id).map { |s|
          { name: s.name, status: s.status }
        }
      },
      fields: signer_fields
    }
  end

  # POST /api/v1/sign/:token/view
  # Mark the document as viewed
  def mark_viewed
    @signer.mark_viewed!(
      ip_address: request.remote_ip,
      user_agent: request.user_agent
    )

    render json: {
      success: true,
      message: "Document marked as viewed"
    }
  end

  # POST /api/v1/sign/:token/send_verification
  # Send email verification code
  def send_verification_code
    code = @signer.generate_verification_code!

    begin
      ESignatureEmailService.deliver(ESignatureMailer.verification_code(@signer))
    rescue ESignatureEmailService::DeliveryError, MicrosoftAppGraphClient::ApiError => e
      Rails.logger.error "[ESignature] Verification code email failed for #{@signer.email}: #{e.message}"
      render json: {
        success: false,
        errors: [ "Failed to send verification email. Please try again or contact the sender." ]
      }, status: :unprocessable_entity
      return
    rescue MicrosoftAppGraphClient::NotConnectedError, MicrosoftAppGraphClient::DeadTokenError => e
      Rails.logger.error "[ESignature] Email service not available: #{e.message}"
      render json: {
        success: false,
        errors: [ "Email service is temporarily unavailable. Please try again later." ]
      }, status: :service_unavailable
      return
    end

    render json: {
      success: true,
      message: "Verification code sent to #{@signer.email}"
    }
  end

  # POST /api/v1/sign/:token/verify
  # Verify the email code
  def verify_code
    code = params[:code]

    if @signer.verify_code!(code)
      render json: {
        success: true,
        message: "Email verified successfully"
      }
    else
      remaining_attempts = 5 - @signer.email_verification_attempts

      render json: {
        success: false,
        errors: [ "Invalid verification code" ],
        remaining_attempts: remaining_attempts > 0 ? remaining_attempts : 0
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/sign/:token/sign
  # Submit the signature
  def sign
    unless @signer.can_sign?
      render json: {
        success: false,
        errors: [ "You cannot sign at this time" ]
      }, status: :unprocessable_entity
      return
    end

    if resolve_email_verification_required(@signer) && !@signer.email_verified?
      render json: {
        success: false,
        errors: [ "Please verify your email before signing" ]
      }, status: :unprocessable_entity
      return
    end

    success = @signer.sign!(
      signature_data: params[:signature_data],
      signature_type: params[:signature_type],
      typed_font: params[:typed_font],
      ip_address: request.remote_ip,
      user_agent: request.user_agent,
      device: detect_device,
      skip_email_verification: !resolve_email_verification_required(@signer)
    )

    if success
      request_status = @signer.e_signature_request.reload

      render json: {
        success: true,
        message: "Document signed successfully",
        request_status: request_status.status,
        request_completed: request_status.status == "completed"
      }
    else
      render json: {
        success: false,
        errors: [ "Failed to record signature" ]
      }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/sign/:token/fields/:field_id/complete
  # Complete a single signature field
  def complete_field
    field = @signer.fields.find_by(id: params[:field_id])

    unless field
      render json: {
        success: false,
        errors: [ "Field not found" ]
      }, status: :not_found
      return
    end

    if field.complete?
      render json: {
        success: false,
        errors: [ "This field has already been completed" ]
      }, status: :unprocessable_entity
      return
    end

    if resolve_email_verification_required(@signer) && !@signer.email_verified?
      render json: {
        success: false,
        errors: [ "Please verify your email before signing" ]
      }, status: :unprocessable_entity
      return
    end

    value = params[:value]

    # Validate value based on field type
    if field.required && value.blank?
      render json: {
        success: false,
        errors: [ "This field is required" ]
      }, status: :unprocessable_entity
      return
    end

    field.complete!(value)

    # Check if all fields are now complete
    all_complete = @signer.fields.required.incomplete.empty?

    render json: {
      success: true,
      message: "Field completed",
      field: {
        id: field.id,
        completed: true,
        value: field.field_type.in?(%w[signature initials]) ? "[CAPTURED]" : field.value
      },
      all_fields_complete: all_complete
    }
  end

  # POST /api/v1/sign/:token/decline
  # Decline to sign
  def decline
    success = @signer.decline!(
      reason: params[:reason],
      ip_address: request.remote_ip,
      user_agent: request.user_agent
    )

    if success
      render json: {
        success: true,
        message: "You have declined to sign this document"
      }
    else
      render json: {
        success: false,
        errors: [ "Failed to record decline" ]
      }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/esign_download/:token
  # Public download of the signed/stamped document using a stateless signed token.
  # No signer authentication needed - the token IS the auth (signed by Rails secret).
  # Used in completion emails so external signers can download without a TEEEM account.
  def download_signed_document
    begin
      data = Rails.application.message_verifier(:esign_download).verify(params[:token])
      request_obj = ESignatureRequest.find(data[:request_id])
    rescue ActiveSupport::MessageVerifier::InvalidSignature
      render json: { success: false, errors: ["Invalid or expired download link"] }, status: :unauthorized
      return
    rescue ActiveRecord::RecordNotFound
      render json: { success: false, errors: ["Document not found"] }, status: :not_found
      return
    end

    unless request_obj.status == "completed"
      render json: { success: false, errors: ["Document is not yet fully signed"] }, status: :unprocessable_entity
      return
    end

    # Set tenant context for storage access
    set_tenant_from_request(request_obj)

    storage_ref = request_obj.original_storage_reference
    unless storage_ref.present?
      render json: { success: false, errors: ["Document not available"] }, status: :not_found
      return
    end

    begin
      content = fetch_document_content(request_obj, storage_ref)

      # Re-stamp the PDF (same as what was stored at completion)
      stamper = ESignaturePdfStamper.new(request_obj)
      stamped = stamper.stamp!
      content = stamped if stamped.present?

      send_data content,
                filename: request_obj.generate_signed_filename,
                type: "application/pdf",
                disposition: "attachment"
    rescue => e
      Rails.logger.error "[ESignature] Signed document download failed: #{e.class} - #{e.message}"
      render json: { success: false, errors: ["Failed to retrieve document"] }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/sign/:token/document
  # Download the document to be signed
  # Supports both StorageBlob (S3/Wasabi) and SharePoint storage
  def download_document
    request_obj = @signer.e_signature_request
    storage_ref = request_obj.original_storage_reference

    unless storage_ref.present?
      render json: {
        success: false,
        errors: [ "Document not available" ]
      }, status: :not_found
      return
    end

    begin
      content = fetch_document_content(request_obj, storage_ref)

      # Log download event
      @signer.log_event("document_downloaded",
        description: "Document downloaded for review",
        ip_address: request.remote_ip,
        user_agent: request.user_agent
      )

      send_data content,
                filename: "#{request_obj.title}.pdf",
                type: "application/pdf",
                disposition: "inline"
    rescue => e
      Rails.logger.error "[ESignature] Document download failed: #{e.class} - #{e.message}"
      render json: {
        success: false,
        errors: [ "Failed to retrieve document" ]
      }, status: :unprocessable_entity
    end
  end

  private

  # Fetch document content from StorageBlob (S3/Wasabi) or SharePoint
  def fetch_document_content(request_obj, storage_ref)
    # Try StorageBlob first (S3/Wasabi - used by DirectorChangeService and newer code)
    blob = StorageBlob.find_by(id: storage_ref)
    if blob
      Rails.logger.info "[ESignature] Downloading document from StorageBlob ##{blob.id}"
      return blob.download
    end

    # Fall back to SharePoint (legacy path)
    if request_obj.storage_site_id.present? && request_obj.storage_drive_id.present?
      Rails.logger.info "[ESignature] Downloading document from SharePoint (item: #{storage_ref})"
      client = MicrosoftAppGraphClient.new
      return client.get_drive_item_content(
        site_id: request_obj.storage_site_id,
        drive_id: request_obj.storage_drive_id,
        item_id: storage_ref
      )
    end

    raise "No storage backend available for document (ref: #{storage_ref})"
  end

  def authenticate_signer
    token = params[:token]

    @signer = find_signer_by_token(token)

    unless @signer
      render json: {
        success: false,
        errors: [ "Invalid or expired signing link" ]
      }, status: :unauthorized
    end
  end

  def find_signer_by_token(token)
    return nil if token.blank?

    token_hash = Digest::SHA256.hexdigest(token)

    ESignatureSigner
      .joins(:e_signature_request)
      .where(access_token_hash: token_hash)
      .where("access_token_expires_at > ?", Time.current)
      .where(e_signature_requests: { status: %w[sent in_progress] })
      .first
  end

  # SSoT: Set ActsAsTenant.current_tenant from the signer's request chain.
  # This ensures TenantSetting.instance, MicrosoftCredential lookups, and all
  # tenant-scoped queries resolve to the correct tenant in this public controller.
  def set_tenant_from_signer
    return unless @signer

    set_tenant_from_request(@signer.e_signature_request)
  end

  def set_tenant_from_request(esign_request)
    tenant = esign_request&.created_by&.tenant
    ActsAsTenant.current_tenant = tenant if tenant
  end

  def resolve_email_verification_required(signer)
    tenant = signer.e_signature_request.created_by&.tenant
    return true unless tenant

    setting = TenantSetting.find_by(tenant_id: tenant.id)
    setting&.esignature_require_email_verification != false
  end

  def detect_device
    user_agent = request.user_agent.to_s.downcase

    if user_agent.include?("mobile") || user_agent.include?("android") || user_agent.include?("iphone")
      "mobile"
    elsif user_agent.include?("tablet") || user_agent.include?("ipad")
      "tablet"
    else
      "desktop"
    end
  end
end
