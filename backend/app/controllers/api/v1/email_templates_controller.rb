# frozen_string_literal: true

class Api::V1::EmailTemplatesController < ApplicationController
  before_action :set_template, only: [:show, :update, :destroy, :apply, :duplicate, :toggle_favorite]

  # GET /api/v1/email_templates
  # List all templates available to the current user
  def index
    templates = EmailTemplate.available_to(current_user)

    # Filter by category
    if params[:category].present?
      templates = templates.by_category(params[:category])
    end

    # Filter by favorites only
    if params[:favorites] == "true"
      templates = templates.favorites
    end

    # Filter by shared only
    if params[:shared] == "true"
      templates = templates.shared
    end

    # Filter by personal only (user's own)
    if params[:personal] == "true"
      templates = templates.where(user: current_user)
    end

    # Search by name
    if params[:search].present?
      templates = templates.where("name ILIKE ?", "%#{params[:search]}%")
    end

    # Ordering
    case params[:sort]
    when "popular"
      templates = templates.popular
    when "recent"
      templates = templates.order(updated_at: :desc)
    else
      templates = templates.ordered
    end

    render json: {
      success: true,
      data: {
        templates: templates.map(&:as_json),
        categories: EmailTemplate::CATEGORIES,
        system_variables: EmailTemplate::SYSTEM_VARIABLES
      }
    }
  end

  # GET /api/v1/email_templates/:id
  def show
    render json: {
      success: true,
      data: @template.as_json
    }
  end

  # POST /api/v1/email_templates
  # Create a new template
  def create
    template = current_user.email_templates.build(template_params)

    if template.save
      render json: {
        success: true,
        data: template.as_json
      }, status: :created
    else
      render json: {
        success: false,
        error: template.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # PATCH/PUT /api/v1/email_templates/:id
  def update
    # Only owner can edit
    unless @template.user_id == current_user.id
      return render json: {
        success: false,
        error: "You can only edit your own templates"
      }, status: :forbidden
    end

    if @template.update(template_params)
      render json: {
        success: true,
        data: @template.as_json
      }
    else
      render json: {
        success: false,
        error: @template.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/email_templates/:id
  def destroy
    # Only owner can delete
    unless @template.user_id == current_user.id
      return render json: {
        success: false,
        error: "You can only delete your own templates"
      }, status: :forbidden
    end

    @template.destroy

    render json: {
      success: true,
      message: "Template deleted"
    }
  end

  # POST /api/v1/email_templates/:id/apply
  # Apply template with variable substitution
  def apply
    context = params[:context] || {}

    # Add sender info automatically
    context[:sender_name] ||= current_user.name
    context[:sender_email] ||= current_user.email

    # Add today's date
    context[:today_date] ||= Date.current.strftime("%B %d, %Y")

    result = @template.apply(context)

    # Record usage
    @template.record_usage!

    render json: {
      success: true,
      data: {
        subject: result[:subject],
        body_html: result[:body_html],
        body_text: result[:body_text],
        variables_used: @template.variables,
        missing_variables: find_missing_variables(result, context)
      }
    }
  end

  # POST /api/v1/email_templates/:id/duplicate
  # Duplicate a template (for copying shared templates)
  def duplicate
    new_name = params[:new_name] || "#{@template.name} (Copy)"

    new_template = @template.duplicate_for(current_user, new_name: new_name)

    render json: {
      success: true,
      data: new_template.as_json
    }, status: :created
  rescue ActiveRecord::RecordInvalid => e
    render json: {
      success: false,
      error: e.message
    }, status: :unprocessable_entity
  end

  # POST /api/v1/email_templates/:id/toggle_favorite
  def toggle_favorite
    # Only owner can toggle favorite
    unless @template.user_id == current_user.id
      return render json: {
        success: false,
        error: "You can only favorite your own templates"
      }, status: :forbidden
    end

    @template.update!(is_favorite: !@template.is_favorite)

    render json: {
      success: true,
      data: {
        id: @template.id,
        is_favorite: @template.is_favorite
      }
    }
  end

  # GET /api/v1/email_templates/quick_replies
  # Get quick reply templates for fast access
  def quick_replies
    templates = EmailTemplate.quick_replies_for(current_user).limit(10)

    render json: {
      success: true,
      data: {
        templates: templates.map { |t| quick_reply_json(t) }
      }
    }
  end

  # GET /api/v1/email_templates/categories
  # Get available categories
  def categories
    render json: {
      success: true,
      data: {
        categories: EmailTemplate::CATEGORIES.map { |k, v| { value: k.to_s, label: v } }
      }
    }
  end

  # GET /api/v1/email_templates/variables
  # Get system variables
  def variables
    render json: {
      success: true,
      data: {
        variables: EmailTemplate::SYSTEM_VARIABLES.map { |k, v| { name: k, description: v, token: "{{#{k}}}" } }
      }
    }
  end

  # POST /api/v1/email_templates/reorder
  # Reorder templates
  def reorder
    positions = params[:positions] || []

    positions.each_with_index do |template_id, index|
      current_user.email_templates.find_by(id: template_id)&.update(position: index)
    end

    render json: {
      success: true,
      data: {
        templates: current_user.email_templates.ordered.map(&:as_json)
      }
    }
  end

  # POST /api/v1/email_templates/create_defaults
  # Create default templates for current user
  def create_defaults
    EmailTemplate.create_defaults_for(current_user)

    render json: {
      success: true,
      message: "Default templates created",
      data: {
        templates: current_user.email_templates.ordered.map(&:as_json)
      }
    }
  end

  private

  def set_template
    @template = EmailTemplate.available_to(current_user).find(params[:id])
  end

  def template_params
    params.require(:template).permit(
      :name,
      :subject,
      :body_html,
      :body_text,
      :category,
      :is_shared,
      :is_favorite,
      :position
    )
  end

  def quick_reply_json(template)
    {
      id: template.id,
      name: template.name,
      subject: template.subject,
      body_text: template.body_text&.truncate(100),
      variables: template.variables,
      usage_count: template.usage_count
    }
  end

  def find_missing_variables(result, context)
    missing = []
    all_text = "#{result[:subject]} #{result[:body_html]} #{result[:body_text]}"

    all_text.scan(EmailTemplate::VARIABLE_PATTERN).flatten.uniq.each do |var|
      missing << var unless context.key?(var) || context.key?(var.to_sym)
    end

    missing
  end
end
