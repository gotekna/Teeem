# frozen_string_literal: true

class Api::V1::EmailDraftsController < ApplicationController
  before_action :set_draft, only: [:show, :update, :destroy, :send_draft]

  # GET /api/v1/email_drafts
  # List all drafts for current user
  # SSoT (Feb 2026): Uses tenant-scoped lookup
  def index
    drafts = current_user.email_drafts
      .for_tenant(current_tenant)
      .drafts_only
      .recent(params[:limit]&.to_i || 50)

    render json: {
      success: true,
      data: drafts.map(&:as_api_response),
      meta: {
        total: drafts.count
      }
    }
  end

  # GET /api/v1/email_drafts/:id
  def show
    render json: {
      success: true,
      data: @draft.as_api_response
    }
  end

  # POST /api/v1/email_drafts
  # Create a new draft
  # SSoT (Feb 2026): Uses tenant-scoped lookup
  # Provider sync: After DB save, enqueue background job to sync to provider Drafts folder
  def create
    draft = current_user.email_drafts.build(draft_params)
    draft.tenant = current_tenant
    resolve_provider_credential(draft)

    if draft.save
      # Sync to provider Drafts folder in background (keeps response fast)
      DraftSyncJob.perform_later(draft.id) if draft.provider_syncable?

      render json: {
        success: true,
        data: draft.as_api_response
      }, status: :created
    else
      render_validation_errors(draft)
    end
  rescue StandardError => e
    Rails.logger.error("[EmailDraftsController] create failed: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    render_error("Failed to create draft: #{e.message}", status: :unprocessable_entity)
  end

  # PATCH/PUT /api/v1/email_drafts/:id
  # Provider sync: After DB update, enqueue background job to sync to provider Drafts folder
  def update
    if @draft.update(draft_params)
      # Sync updated draft to provider in background
      DraftSyncJob.perform_later(@draft.id) if @draft.provider_syncable?

      render json: {
        success: true,
        data: @draft.as_api_response
      }
    else
      render_validation_errors(@draft)
    end
  rescue StandardError => e
    Rails.logger.error("[EmailDraftsController] update failed: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    render_error("Failed to update draft: #{e.message}", status: :unprocessable_entity)
  end

  # DELETE /api/v1/email_drafts/:id
  # Provider sync: Delete from provider Drafts folder before destroying in TEEEM DB
  def destroy
    # Delete from provider first (best-effort - don't block TEEEM delete on failure)
    DraftSyncService.delete_from_provider(@draft)

    @draft.destroy

    render json: {
      success: true,
      message: "Draft deleted"
    }
  end

  # POST /api/v1/email_drafts/:id/send_draft
  # Send an existing draft via the provider, then clean up
  def send_draft
    # Validate draft has enough content to send
    unless @draft.to_list.any?
      return render_error("Cannot send: no recipients specified", status: :unprocessable_entity)
    end

    # Send via provider (MS365 send_draft or IMAP send+delete)
    DraftSyncService.send_draft(@draft)

    # Mark as sent and destroy the draft record
    @draft.destroy

    render json: {
      success: true,
      message: "Draft sent successfully"
    }
  rescue DraftSyncService::SyncError => e
    render_error("Failed to send draft: #{e.message}", status: :unprocessable_entity)
  rescue StandardError => e
    Rails.logger.error("[EmailDraftsController] send_draft failed: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    render_error("Failed to send draft: #{e.message}", status: :internal_server_error)
  end

  # DELETE /api/v1/email_drafts
  # Clear all drafts for current user
  # SSoT (Feb 2026): Uses tenant-scoped lookup
  def destroy_all
    count = current_user.email_drafts.for_tenant(current_tenant).destroy_all.count

    render json: {
      success: true,
      message: "#{count} drafts deleted"
    }
  end

  private

  def set_draft
    # SSoT (Feb 2026): Uses tenant-scoped lookup
    @draft = current_user.email_drafts
      .for_tenant(current_tenant)
      .find(params[:id])
  end

  def draft_params
    # Parse addresses - frontend sends strings, we store as JSON arrays
    permitted = params.permit(
      :from_address,
      :subject,
      :body,
      :reply_to_message_id,
      :imap_credential_id,
      :microsoft_credential_id,
      :status
    )

    # Handle credential_id (frontend uses credential_id, model uses imap_credential_id)
    if params[:credential_id].present?
      permitted[:imap_credential_id] = params[:credential_id]
    end

    # Sanitize empty/zero/invalid credential_id to nil
    # Rails converts "" to 0 for integer columns, which violates FK constraint
    # Also handle: nil, "", "0", 0, and any non-numeric strings
    credential_id = permitted[:imap_credential_id]
    if credential_id.blank? || credential_id.to_i <= 0
      permitted[:imap_credential_id] = nil
    end

    # Same sanitization for microsoft_credential_id
    ms_credential_id = permitted[:microsoft_credential_id]
    if ms_credential_id.blank? || ms_credential_id.to_i <= 0
      permitted[:microsoft_credential_id] = nil
    end

    # Convert address strings to JSON arrays for storage
    [:to, :cc, :bcc].each do |field|
      if params[field].present?
        addresses = parse_address_param(params[field])
        permitted["#{field}_addresses"] = addresses.to_json
      end
    end

    # Handle attachments (array of objects with name, size, etc.)
    if params[:attachments].present?
      permitted[:attachments] = params[:attachments]
    elsif params[:attachment_names].present?
      # Frontend sends attachment_names array - convert to attachments format
      permitted[:attachments] = params[:attachment_names].map { |name| { name: name } }
    end

    permitted
  end

  def parse_address_param(value)
    return [] if value.blank?

    if value.is_a?(Array)
      value.map(&:strip).reject(&:blank?)
    else
      value.split(",").map(&:strip).reject(&:blank?)
    end
  end

  # Resolve provider credential from account_type param
  # Frontend sends account_type ("ms365" or "imap") + credential_id
  # We need to set the correct FK (imap_credential_id or microsoft_credential_id)
  def resolve_provider_credential(draft)
    account_type = params[:account_type]&.to_s

    case account_type
    when "ms365"
      # credential_id might be in "ms365_123_hash" format from frontend
      cred_id = params[:credential_id].to_s
      cred_id = cred_id.split("_")[1] if cred_id.start_with?("ms365_")
      draft.microsoft_credential_id = cred_id.to_i if cred_id.present? && cred_id.to_i > 0
    when "imap"
      # Already handled via draft_params imap_credential_id
    end
  end
end
