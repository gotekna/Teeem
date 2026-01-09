# frozen_string_literal: true

class Api::V1::EmailLabelsController < ApplicationController
  before_action :set_label, only: [:show, :update, :destroy, :toggle_email, :emails]

  # GET /api/v1/email_labels
  # List all labels for the current user
  def index
    labels = current_user.email_labels.ordered

    # Ensure system labels exist
    EmailLabel.create_system_labels_for(current_user) if labels.empty?
    labels = current_user.email_labels.ordered if labels.empty?

    render json: {
      success: true,
      data: {
        labels: labels.map { |l| label_json(l) },
        system_labels: labels.select(&:is_system).map { |l| label_json(l) },
        user_labels: labels.reject(&:is_system).map { |l| label_json(l) }
      }
    }
  end

  # GET /api/v1/email_labels/:id
  def show
    render json: {
      success: true,
      data: label_json(@label, include_emails: params[:include_emails] == "true")
    }
  end

  # POST /api/v1/email_labels
  # Create a new label
  def create
    label = current_user.email_labels.build(label_params)

    if label.save
      render json: {
        success: true,
        data: label_json(label)
      }, status: :created
    else
      render json: {
        success: false,
        error: label.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /api/v1/email_labels/:id
  def update
    # Prevent editing system labels (except position)
    if @label.is_system && label_params.keys != ["position"]
      return render json: {
        success: false,
        error: "Cannot modify system labels"
      }, status: :unprocessable_entity
    end

    if @label.update(label_params)
      render json: {
        success: true,
        data: label_json(@label)
      }
    else
      render json: {
        success: false,
        error: @label.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/email_labels/:id
  def destroy
    # Prevent deleting system labels
    if @label.is_system
      return render json: {
        success: false,
        error: "Cannot delete system labels"
      }, status: :unprocessable_entity
    end

    @label.destroy

    render json: {
      success: true,
      message: "Label deleted"
    }
  end

  # POST /api/v1/email_labels/:id/toggle_email
  # Toggle this label on/off for an email
  def toggle_email
    email = EmailWarehouse.find(params[:email_id])

    assigned = @label.toggle_for(email)

    render json: {
      success: true,
      data: {
        label_id: @label.id,
        email_id: email.id,
        assigned: assigned,
        message: assigned ? "Label added" : "Label removed"
      }
    }
  end

  # GET /api/v1/email_labels/:id/emails
  # Get all emails with this label
  def emails
    emails = @label.emails.order(received_at: :desc)

    # Pagination
    page = (params[:page] || 1).to_i
    per_page = [(params[:per_page] || 50).to_i, 200].min
    total = emails.count

    emails = emails.offset((page - 1) * per_page).limit(per_page)

    render json: {
      success: true,
      data: {
        label: label_json(@label),
        emails: emails.map { |e| email_summary_json(e) },
        pagination: {
          page: page,
          per_page: per_page,
          total: total,
          total_pages: (total.to_f / per_page).ceil
        }
      }
    }
  end

  # POST /api/v1/email_labels/bulk_assign
  # Assign multiple labels to an email
  def bulk_assign
    email = EmailWarehouse.find(params[:email_id])
    label_ids = params[:label_ids] || []

    # Get user's labels
    labels = current_user.email_labels.where(id: label_ids)

    # Assign each label
    assigned = []
    labels.each do |label|
      label.assign_to(email)
      assigned << label.id
    end

    render json: {
      success: true,
      data: {
        email_id: email.id,
        assigned_label_ids: assigned,
        email_labels: email.email_labels.map { |l| label_json(l) }
      }
    }
  end

  # DELETE /api/v1/email_labels/bulk_remove
  # Remove multiple labels from an email
  def bulk_remove
    email = EmailWarehouse.find(params[:email_id])
    label_ids = params[:label_ids] || []

    # Get user's labels
    labels = current_user.email_labels.where(id: label_ids)

    # Remove each label
    removed = []
    labels.each do |label|
      label.remove_from(email)
      removed << label.id
    end

    render json: {
      success: true,
      data: {
        email_id: email.id,
        removed_label_ids: removed,
        email_labels: email.email_labels.map { |l| label_json(l) }
      }
    }
  end

  # GET /api/v1/email_labels/for_email/:email_id
  # Get all labels assigned to an email
  def for_email
    email = EmailWarehouse.find(params[:email_id])
    all_labels = current_user.email_labels.ordered
    assigned_ids = email.email_label_ids

    render json: {
      success: true,
      data: {
        email_id: email.id,
        all_labels: all_labels.map { |l| label_json(l).merge(assigned: assigned_ids.include?(l.id)) },
        assigned_labels: email.email_labels.map { |l| label_json(l) }
      }
    }
  end

  # GET /api/v1/email_labels/colors
  # Get available label colors
  def colors
    render json: {
      success: true,
      data: {
        colors: EmailLabel::COLORS.map { |name, hex| { name: name.to_s, hex: hex } }
      }
    }
  end

  # POST /api/v1/email_labels/reorder
  # Reorder labels (update positions)
  def reorder
    positions = params[:positions] || []

    positions.each_with_index do |label_id, index|
      current_user.email_labels.find_by(id: label_id)&.update(position: index)
    end

    render json: {
      success: true,
      data: {
        labels: current_user.email_labels.ordered.map { |l| label_json(l) }
      }
    }
  end

  private

  def set_label
    @label = current_user.email_labels.find(params[:id])
  end

  def label_params
    params.require(:label).permit(:name, :color, :position)
  end

  def label_json(label, include_emails: false)
    json = {
      id: label.id,
      name: label.name,
      color: label.color,
      is_system: label.is_system,
      position: label.position,
      email_count: label.email_count
    }

    if include_emails
      json[:emails] = label.emails.order(received_at: :desc).limit(50).map { |e| email_summary_json(e) }
    end

    json
  end

  def email_summary_json(email)
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
