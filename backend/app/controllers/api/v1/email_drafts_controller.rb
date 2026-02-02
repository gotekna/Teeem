# frozen_string_literal: true

class Api::V1::EmailDraftsController < ApplicationController
  before_action :set_draft, only: [:show, :update, :destroy]

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
  def create
    draft = current_user.email_drafts.build(draft_params)
    draft.tenant = current_tenant
    draft.organization = current_organization # DEPRECATED: kept for backwards compat

    if draft.save
      render json: {
        success: true,
        data: draft.as_api_response
      }, status: :created
    else
      render json: {
        success: false,
        error: draft.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  rescue StandardError => e
    Rails.logger.error("[EmailDraftsController] create failed: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    render json: {
      success: false,
      error: "Failed to create draft: #{e.message}"
    }, status: :unprocessable_entity
  end

  # PATCH/PUT /api/v1/email_drafts/:id
  def update
    if @draft.update(draft_params)
      render json: {
        success: true,
        data: @draft.as_api_response
      }
    else
      render json: {
        success: false,
        error: @draft.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  rescue StandardError => e
    Rails.logger.error("[EmailDraftsController] update failed: #{e.class} - #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    render json: {
      success: false,
      error: "Failed to update draft: #{e.message}"
    }, status: :unprocessable_entity
  end

  # DELETE /api/v1/email_drafts/:id
  def destroy
    @draft.destroy

    render json: {
      success: true,
      message: "Draft deleted"
    }
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
end
