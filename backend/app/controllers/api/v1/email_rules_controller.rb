class Api::V1::EmailRulesController < ApplicationController
  before_action :set_rule, only: [:show, :update, :destroy, :apply]

  # GET /api/v1/email_rules
  # List user's email rules
  # SSoT: Supports both IMAP and MS365 account filtering
  def index
    rules = current_user.email_rules.by_priority
    rules = rules.where(imap_credential_id: params[:account_id]) if params[:account_id].present?
    rules = rules.where(microsoft_credential_id: params[:microsoft_credential_id]) if params[:microsoft_credential_id].present?

    render json: {
      success: true,
      data: rules.map { |r| rule_json(r) }
    }
  end

  # GET /api/v1/email_rules/:id
  def show
    render json: {
      success: true,
      data: rule_json(@rule)
    }
  end

  # POST /api/v1/email_rules
  # Create a new email rule
  def create
    rule = current_user.email_rules.build(rule_params)

    if rule.save
      render json: {
        success: true,
        data: rule_json(rule),
        message: "Rule created successfully"
      }, status: :created
    else
      render json: {
        success: false,
        error: rule.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # PATCH /api/v1/email_rules/:id
  def update
    if @rule.update(rule_params)
      render json: {
        success: true,
        data: rule_json(@rule),
        message: "Rule updated successfully"
      }
    else
      render json: {
        success: false,
        error: @rule.errors.full_messages.join(", ")
      }, status: :unprocessable_entity
    end
  end

  # DELETE /api/v1/email_rules/:id
  def destroy
    @rule.destroy!

    render json: {
      success: true,
      message: "Rule deleted successfully"
    }
  end

  # POST /api/v1/email_rules/:id/apply
  # Apply rule to existing emails
  # SSoT: Supports both IMAP and MS365 credentials
  def apply
    ApplyEmailRulesJob.perform_later(
      current_user.id,
      rule_id: @rule.id,
      credential_id: @rule.imap_credential_id,
      microsoft_credential_id: @rule.microsoft_credential_id
    )

    render json: {
      success: true,
      message: "Rule application started. This will run in the background."
    }
  end

  # POST /api/v1/email_rules/test
  # Test rule conditions against sample emails
  def test
    service = EmailRuleService.new(current_user)

    results = service.test_rule(
      rule_params.merge(user: current_user),
      limit: params[:limit]&.to_i || 100
    )

    render json: {
      success: true,
      data: results
    }
  end

  # POST /api/v1/email_rules/reorder
  # Reorder rules by priority
  def reorder
    rule_ids = params[:rule_ids] || []

    ActiveRecord::Base.transaction do
      rule_ids.each_with_index do |id, index|
        rule = current_user.email_rules.find_by(id: id)
        # Higher index = lower priority (first in list = highest priority)
        rule&.update!(priority: rule_ids.length - index)
      end
    end

    render json: {
      success: true,
      message: "Rules reordered successfully"
    }
  rescue => e
    render json: {
      success: false,
      error: "Failed to reorder rules: #{e.message}"
    }, status: :unprocessable_entity
  end

  # GET /api/v1/email_rules/condition_types
  # List available condition types for UI
  def condition_types
    render json: {
      success: true,
      data: EmailRule::CONDITION_TYPES.map do |type|
        {
          value: type,
          label: type.titleize.gsub("_", " "),
          description: condition_type_description(type)
        }
      end
    }
  end

  # GET /api/v1/email_rules/action_types
  # List available action types for UI
  def action_types
    render json: {
      success: true,
      data: EmailRule::ACTION_TYPES.map do |type|
        {
          value: type,
          label: type.titleize.gsub("_", " "),
          description: action_type_description(type)
        }
      end
    }
  end

  private

  def set_rule
    @rule = current_user.email_rules.find(params[:id])
  end

  def rule_params
    params.require(:email_rule).permit(
      :name,
      :priority,
      :is_active,
      :stop_processing,
      :imap_credential_id,
      :microsoft_credential_id,
      :mailbox_email,
      conditions: {},
      actions: {}
    )
  end

  def rule_json(rule)
    {
      id: rule.id,
      name: rule.name,
      priority: rule.priority,
      is_active: rule.is_active,
      stop_processing: rule.stop_processing,
      imap_credential_id: rule.imap_credential_id,
      microsoft_credential_id: rule.microsoft_credential_id,
      mailbox_email: rule.mailbox_email,
      conditions: rule.conditions,
      actions: rule.actions,
      emails_matched: rule.emails_matched,
      last_matched_at: rule.last_matched_at,
      created_at: rule.created_at,
      updated_at: rule.updated_at
    }
  end

  def condition_type_description(type)
    {
      "from_contains" => "Matches if sender email contains this text",
      "from_exact" => "Matches if sender email exactly equals this value",
      "from_domain" => "Matches if sender domain equals this value",
      "to_contains" => "Matches if any recipient contains this text",
      "to_exact" => "Matches if any recipient exactly equals this value",
      "subject_contains" => "Matches if subject contains this text",
      "subject_not_contains" => "Matches if subject does NOT contain this text",
      "subject_exact" => "Matches if subject exactly equals this value",
      "body_contains" => "Matches if body contains this text",
      "has_attachments" => "Matches based on attachment presence"
    }[type] || type.humanize
  end

  def action_type_description(type)
    {
      "move_to_folder" => "Move email to specified folder",
      "add_label" => "Add a label/tag to the email",
      "mark_as_read" => "Mark email as read or unread",
      "mark_as_spam" => "Mark email as spam",
      "delete" => "Delete the email permanently",
      "forward_to" => "Forward email to specified address"
    }[type] || type.humanize
  end
end
