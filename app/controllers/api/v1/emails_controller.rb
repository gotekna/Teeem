class Api::V1::EmailsController < ApplicationController
  before_action :set_current_user

  # GET /api/v1/emails
  # Get all emails, optionally filtered by construction
  def index
    if params[:job_id].present?
      @emails = Email.for_construction(params[:job_id])
    elsif params[:unassigned]
      @emails = Email.unassigned
    else
      @emails = Email.recent(50)
    end

    render json: @emails
  end

  # GET /api/v1/emails/:id
  def show
    @email = Email.find(params[:id])
    render json: @email
  end

  # POST /api/v1/emails
  # Create a new email from parsed email data
  def create
    parser = EmailParserService.new(email_params_from_request)
    parsed_data = parser.parse

    @email = Email.new(parsed_data)
    @email.user = @current_user

    # Try to auto-match to a construction
    if params[:auto_match] != false
      matched_construction = parser.match_construction
      @email.construction = matched_construction if matched_construction
    end

    if @email.save
      render json: @email, status: :created
    else
      render json: { errors: @email.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/emails/:id
  # Update email (mainly for assigning to construction)
  def update
    @email = Email.find(params[:id])

    if @email.update(update_params)
      render json: @email
    else
      render json: { errors: @email.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/emails/:id
  def destroy
    @email = Email.find(params[:id])
    @email.destroy
    head :no_content
  end

  # POST /api/v1/emails/:id/assign_to_job
  # Assign an email to a specific construction job
  def assign_to_job
    @email = Email.find(params[:id])
    construction_id = params[:job_id]

    if construction_id.blank?
      render json: { error: 'construction_id is required' }, status: :unprocessable_entity
      return
    end

    if @email.update(construction_id: construction_id)
      render json: @email
    else
      render json: { errors: @email.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/emails/webhook
  # Webhook endpoint for receiving emails from external services
  # (e.g., SendGrid Inbound Parse, Mailgun, etc.)
  def webhook
    # Parse the incoming webhook data
    # This will vary depending on the email service provider
    parser = EmailParserService.new(params)
    parsed_data = parser.parse

    @email = Email.new(parsed_data)

    # Try to auto-match to a construction
    matched_construction = parser.match_construction
    @email.construction = matched_construction if matched_construction

    if @email.save
      render json: { success: true, email_id: @email.id, matched: @email.construction_id.present? }
    else
      render json: { success: false, errors: @email.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def email_params_from_request
    # Extract email data from request params
    # Supports both direct JSON and multipart form data
    params.permit(
      :from, :from_email,
      :subject,
      :text_body, :body_text,
      :html_body, :body_html,
      :message_id,
      :in_reply_to,
      :date, :received_at,
      to: [],
      cc: [],
      bcc: [],
      references: [],
      attachments: []
    )
  end

  def update_params
    params.require(:email).permit(:job_id, :user_id)
  end

  def set_current_user
    # TODO: Replace with actual current_user logic from your authentication system
    @current_user = User.first
  end
end
