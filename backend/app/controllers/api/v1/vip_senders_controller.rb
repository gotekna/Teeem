# frozen_string_literal: true

class Api::V1::VipSendersController < ApplicationController
  before_action :set_vip, only: [:show, :update, :destroy, :emails]

  # GET /api/v1/vip_senders
  # List all VIP senders for current user
  def index
    vips = current_user.vip_senders.alphabetical

    # Filter by category
    if params[:category].present?
      vips = vips.by_category(params[:category])
    end

    # Search
    if params[:search].present?
      vips = vips.where("name ILIKE ? OR email_address ILIKE ?", "%#{params[:search]}%", "%#{params[:search]}%")
    end

    render json: {
      success: true,
      data: {
        vips: vips.map { |v| v.as_json(include_count: params[:include_count] == "true") },
        categories: VipSender::CATEGORIES.map { |k, v| { key: k.to_s, label: v[:label] } },
        count: vips.count
      }
    }
  end

  # GET /api/v1/vip_senders/:id
  def show
    render json: {
      success: true,
      data: @vip.as_json(include_count: true)
    }
  end

  # POST /api/v1/vip_senders
  # Add a VIP sender
  def create
    vip = current_user.vip_senders.build(vip_params)

    if vip.save
      render json: {
        success: true,
        data: vip.as_json
      }, status: :created
    else
      render json: {
        success: false,
        error: vip.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /api/v1/vip_senders/:id
  def update
    if @vip.update(vip_params)
      render json: {
        success: true,
        data: @vip.as_json
      }
    else
      render json: {
        success: false,
        error: @vip.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/vip_senders/:id
  def destroy
    @vip.destroy

    render json: {
      success: true,
      message: "VIP sender removed"
    }
  end

  # POST /api/v1/vip_senders/toggle
  # Toggle VIP status for an email address
  def toggle
    email_address = params[:email_address]
    return render json: { success: false, error: "Email address required" }, status: :bad_request if email_address.blank?

    result = VipSender.toggle!(
      user: current_user,
      email_address: email_address,
      name: params[:name]
    )

    render json: {
      success: true,
      data: {
        is_vip: result.present?,
        vip: result&.as_json
      },
      message: result ? "Added to VIP" : "Removed from VIP"
    }
  end

  # GET /api/v1/vip_senders/check
  # Check if an email address is VIP
  def check
    email_address = params[:email_address]
    return render json: { success: false, error: "Email address required" }, status: :bad_request if email_address.blank?

    vip = current_user.vip_senders.find_by(email_address: email_address.downcase)

    render json: {
      success: true,
      data: {
        is_vip: vip.present?,
        vip: vip&.as_json
      }
    }
  end

  # GET /api/v1/vip_senders/:id/emails
  # Get recent emails from this VIP
  def emails
    emails = @vip.recent_emails(limit: params[:limit]&.to_i || 20)

    render json: {
      success: true,
      data: {
        vip: @vip.as_json,
        emails: emails.map { |e| email_json(e) },
        count: @vip.email_count
      }
    }
  end

  # GET /api/v1/vip_senders/inbox
  # Get all emails from VIP senders
  def inbox
    emails = VipSender.vip_emails_for(current_user).order(received_at: :desc)

    # Pagination
    page = (params[:page] || 1).to_i
    per_page = [(params[:per_page] || 50).to_i, 200].min
    total = emails.count

    emails = emails.offset((page - 1) * per_page).limit(per_page)

    render json: {
      success: true,
      data: {
        emails: emails.map { |e| email_json(e) },
        pagination: {
          page: page,
          per_page: per_page,
          total: total,
          total_pages: (total.to_f / per_page).ceil
        }
      }
    }
  end

  # GET /api/v1/vip_senders/suggestions
  # Get suggested VIP senders based on email frequency
  def suggestions
    suggestions = VipSender.suggestions_for(current_user, limit: params[:limit]&.to_i || 10)

    render json: {
      success: true,
      data: {
        suggestions: suggestions
      }
    }
  end

  # POST /api/v1/vip_senders/import_from_contacts
  # Import VIP senders from contacts
  def import_from_contacts
    contact_ids = params[:contact_ids]

    imported = VipSender.import_from_contacts!(current_user, contact_ids: contact_ids)

    render json: {
      success: true,
      data: {
        imported_count: imported,
        vips: current_user.vip_senders.alphabetical.map(&:as_json)
      },
      message: "Imported #{imported} VIP senders"
    }
  end

  private

  def set_vip
    @vip = current_user.vip_senders.find(params[:id])
  end

  def vip_params
    params.require(:vip).permit(:email_address, :name, :category, :notes, :notify_immediately)
  end

  def email_json(email)
    {
      id: email.id,
      subject: email.subject,
      from_email: email.from_email,
      from_name: email.from_name,
      received_at: email.received_at,
      has_attachments: email.has_attachments,
      snippet: email.preview_body(length: 150)
    }
  end
end
