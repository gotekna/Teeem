class Api::V1::GrokController < ApplicationController
  # POST /api/v1/grok/chat
  def chat
    message = params[:message]
    context = params[:context] || {}

    if message.blank?
      return render json: { success: false, error: "Message is required" }, status: :bad_request
    end

    begin
      grok = GrokService.new
      response = grok.chat(message, context.to_h.symbolize_keys)

      render json: {
        success: true,
        response: response[:message],
        model: response[:model],
        usage: response[:usage]
      }
    rescue StandardError => e
      Rails.logger.error "Grok API error: #{e.message}"
      render json: {
        success: false,
        error: "Failed to get response from Grok: #{e.message}"
      }, status: :internal_server_error
    end
  end

  # GET /api/v1/grok/suggest-features
  def suggest_features
    table_id = params[:table_id]

    context = {
      current_page: "Feature Planning",
      team_context: "Team is planning next features for the application"
    }

    if table_id
      foundation = Foundation.find_by(id: table_id)
      context[:current_table] = {
        name: foundation&.name,
        columns: foundation&.columns&.count
      }
    end

    message = "Based on the current application structure, suggest 5 practical features we should build next. Be specific and consider database design, user experience, and development complexity."

    begin
      grok = GrokService.new
      response = grok.chat(message, context)

      render json: {
        success: true,
        suggestions: response[:message]
      }
    rescue StandardError => e
      Rails.logger.error "Grok API error: #{e.message}"
      render json: {
        success: false,
        error: "Failed to get feature suggestions: #{e.message}"
      }, status: :internal_server_error
    end
  end

  # POST /api/v1/grok/plans
  def create_plan
    plan = @current_user.grok_plans.create(
      title: params[:title],
      description: params[:description],
      conversation: params[:conversation] || [],
      status: params[:status] || "planning"
    )

    if plan.persisted?
      render json: { success: true, plan: plan }
    else
      render json: { success: false, errors: plan.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # GET /api/v1/grok/plans
  def list_plans
    plans = @current_user.grok_plans.recent
    render json: { success: true, plans: plans }
  end

  # GET /api/v1/grok/plans/:id
  def show_plan
    plan = @current_user.grok_plans.find(params[:id])
    render json: { success: true, plan: plan }
  rescue ActiveRecord::RecordNotFound
    render json: { success: false, error: "Plan not found" }, status: :not_found
  end

  # PATCH /api/v1/grok/plans/:id
  def update_plan
    plan = @current_user.grok_plans.find(params[:id])

    if plan.update(plan_params)
      render json: { success: true, plan: plan }
    else
      render json: { success: false, errors: plan.errors.full_messages }, status: :unprocessable_entity
    end
  rescue ActiveRecord::RecordNotFound
    render json: { success: false, error: "Plan not found" }, status: :not_found
  end

  private

  def plan_params
    params.permit(:title, :description, :status, conversation: [])
  end
end
