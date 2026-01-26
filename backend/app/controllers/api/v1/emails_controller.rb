# DEPRECATED: This controller now proxies to SyncedEmail
# The legacy Email model has been removed. Use SyncedEmailController instead.
class Api::V1::EmailsController < ApplicationController
  # GET /api/v1/emails
  # Get all emails, optionally filtered by job
  def index
    emails = SyncedEmail.order(received_at: :desc)

    if params[:job_id].present?
      emails = emails.where(job_id: params[:job_id])
    elsif params[:unassigned]
      emails = emails.where(job_id: nil)
    else
      emails = emails.limit(50)
    end

    render json: { success: true, emails: emails.as_json }
  end

  # GET /api/v1/emails/:id
  def show
    @email = SyncedEmail.find(params[:id])
    render json: { success: true, email: @email.as_json }
  end

  # POST /api/v1/emails
  # Create a new email from parsed email data
  def create
    parser = EmailParserService.new(email_params_from_request)
    parsed_data = parser.parse

    @email = SyncedEmail.new(
      internet_message_id: parsed_data[:message_id] || SecureRandom.uuid,
      source_type: "webhook",
      from_email: parsed_data[:from_email] || parsed_data[:from],
      from_name: parsed_data[:from_email]&.split("@")&.first,
      to_emails: parsed_data[:to_emails] || parsed_data[:to] || [],
      cc_emails: parsed_data[:cc_emails] || parsed_data[:cc] || [],
      subject: parsed_data[:subject],
      body_text: parsed_data[:body_text] || parsed_data[:text_body],
      body_html: parsed_data[:body_html] || parsed_data[:html_body],
      received_at: parsed_data[:received_at] || parsed_data[:date] || Time.current,
      has_attachments: false,
      synced_by_user: current_user,
      first_synced_at: Time.current,
      last_synced_at: Time.current,
      # SSoT: Multi-tenancy - always set tenant_id for proper scoping
      tenant_id: current_tenant&.id
    )

    # Try to auto-match to a job
    if params[:auto_match] != false
      matched_job = parser.match_job
      @email.job_id = matched_job.id if matched_job
    end

    if @email.save
      render json: { success: true, email: @email.as_json }, status: :created
    else
      render json: { success: false, errors: @email.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/emails/:id
  # Update email (mainly for assigning to job)
  def update
    @email = SyncedEmail.find(params[:id])

    if @email.update(update_params)
      render json: { success: true, email: @email.as_json }
    else
      render json: { success: false, errors: @email.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/emails/:id
  def destroy
    @email = SyncedEmail.find(params[:id])
    @email.destroy
    head :no_content
  end

  # POST /api/v1/emails/:id/assign_to_job
  # Assign an email to a specific job
  def assign_to_job
    @email = SyncedEmail.find(params[:id])
    job_id = params[:job_id]

    if job_id.blank?
      render json: { success: false, error: "job_id is required" }, status: :unprocessable_entity
      return
    end

    if @email.update(job_id: job_id)
      render json: { success: true, email: @email.as_json }
    else
      render json: { success: false, errors: @email.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /api/v1/emails/webhook
  # Webhook endpoint for receiving emails from external services
  def webhook
    parser = EmailParserService.new(params)
    parsed_data = parser.parse

    @email = SyncedEmail.new(
      internet_message_id: parsed_data[:message_id] || SecureRandom.uuid,
      source_type: "webhook",
      from_email: parsed_data[:from_email] || parsed_data[:from],
      from_name: parsed_data[:from_email]&.split("@")&.first,
      to_emails: parsed_data[:to_emails] || parsed_data[:to] || [],
      cc_emails: parsed_data[:cc_emails] || parsed_data[:cc] || [],
      subject: parsed_data[:subject],
      body_text: parsed_data[:body_text] || parsed_data[:text_body],
      body_html: parsed_data[:body_html] || parsed_data[:html_body],
      received_at: parsed_data[:received_at] || parsed_data[:date] || Time.current,
      has_attachments: false,
      first_synced_at: Time.current,
      last_synced_at: Time.current,
      # SSoT: Multi-tenancy - always set tenant_id for proper scoping
      tenant_id: current_tenant&.id
    )

    # Try to auto-match to a job
    matched_job = parser.match_job
    @email.job_id = matched_job.id if matched_job

    if @email.save
      render json: { success: true, email_id: @email.id, matched: @email.job_id.present? }
    else
      render json: { success: false, errors: @email.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def email_params_from_request
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
    params.require(:email).permit(:job_id)
  end
end
