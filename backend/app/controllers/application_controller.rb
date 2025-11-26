class ApplicationController < ActionController::API
  before_action :authorize_request

  # Global exception handlers
  rescue_from StandardError, with: :handle_standard_error
  rescue_from ActiveRecord::RecordNotFound, with: :handle_not_found
  rescue_from ActiveRecord::RecordInvalid, with: :handle_validation_error
  rescue_from ActionController::ParameterMissing, with: :handle_parameter_missing
  rescue_from ActiveRecord::DeleteRestrictionError, with: :handle_delete_restriction

  private

  def authorize_request
    header = request.headers['Authorization']
    header = header.split(' ').last if header

    begin
      decoded = JsonWebToken.decode(header)
      @current_user = User.find(decoded[:user_id]) if decoded
    rescue ActiveRecord::RecordNotFound, JWT::DecodeError => e
      # Authentication failed - will be handled below
    end

    # Require authentication - no default user fallback
    unless @current_user
      render json: { error: 'Unauthorized' }, status: :unauthorized
    end
  end

  def current_user
    @current_user
  end

  def require_admin
    unless current_user&.admin?
      render json: { error: 'Unauthorized. Admin access required.' }, status: :forbidden
    end
  end

  # Exception handlers
  def handle_standard_error(exception)
    Rails.logger.error("Unhandled exception: #{exception.class} - #{exception.message}")
    Rails.logger.error(exception.backtrace.first(10).join("\n"))

    render json: {
      success: false,
      error: Rails.env.production? ? "An unexpected error occurred" : exception.message
    }, status: :internal_server_error
  end

  def handle_not_found(exception)
    render json: {
      success: false,
      error: 'Resource not found'
    }, status: :not_found
  end

  def handle_validation_error(exception)
    render json: {
      success: false,
      error: 'Validation failed',
      errors: exception.record.errors.full_messages
    }, status: :unprocessable_entity
  end

  def handle_parameter_missing(exception)
    render json: {
      success: false,
      error: "Missing required parameter: #{exception.param}"
    }, status: :bad_request
  end

  def handle_delete_restriction(exception)
    render json: {
      success: false,
      error: "Cannot delete this record because it has associated dependencies. Please remove or reassign the dependent records first.",
      error_code: "HAS_DEPENDENCIES"
    }, status: :unprocessable_entity
  end
end
