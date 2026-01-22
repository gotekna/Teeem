# Public controller for the e-signature signing ceremony.
# This controller uses token-based authentication, not JWT.
#
class Api::V1::SigningCeremonyController < ApplicationController
  skip_before_action :authorize_request
  before_action :authenticate_signer, except: [ :verify_token ]

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

    render json: {
      success: true,
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        role: signer.role,
        status: signer.status,
        can_sign: signer.can_sign?,
        email_verified: signer.email_verified?
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

    ESignatureMailer.verification_code(@signer).deliver_later

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

    unless @signer.email_verified?
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
      device: detect_device
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

    unless @signer.email_verified?
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

  # GET /api/v1/sign/:token/document
  # Download the document to be signed
  def download_document
    request_obj = @signer.e_signature_request

    unless request_obj.original_storage_file_id.present?
      render json: {
        success: false,
        errors: [ "Document not available" ]
      }, status: :not_found
      return
    end

    begin
      client = MicrosoftAppGraphClient.new
      content = client.get_drive_item_content(
        site_id: request_obj.storage_site_id,
        drive_id: request_obj.storage_drive_id,
        item_id: request_obj.original_storage_file_id
      )

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
    rescue MicrosoftAppGraphClient::ApiError => e
      render json: {
        success: false,
        errors: [ "Failed to retrieve document" ]
      }, status: :unprocessable_entity
    end
  end

  private

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
