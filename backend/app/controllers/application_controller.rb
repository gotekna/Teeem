class ApplicationController < ActionController::API
  include ActionController::Cookies
  include SsotAuthorization

  # Multi-tenancy: Set up tenant scoping
  set_current_tenant_through_filter

  before_action :authorize_request
  before_action :set_tenant  # Must be after authorize_request to have current_user
  after_action :update_last_seen

  # Global exception handlers
  rescue_from StandardError, with: :handle_standard_error
  rescue_from ActiveRecord::RecordNotFound, with: :handle_not_found
  rescue_from ActiveRecord::RecordInvalid, with: :handle_validation_error
  rescue_from ActionController::ParameterMissing, with: :handle_parameter_missing
  rescue_from ActiveRecord::DeleteRestrictionError, with: :handle_delete_restriction
  # REMOVED (Jan 2026): rescue_from ActiveStorage::FileNotFoundError - SSoT is now StorageBlob

  private

  # Multi-tenancy: Determine and set the current tenant
  # Priority order:
  # 1. Admin override (for TEEEM staff switching tenants via session)
  # 2. Subdomain (pilgrim.teeem.com.au → Pilgrim tenant)
  # 3. User's assigned tenant
  def set_tenant
    tenant = determine_tenant
    set_current_tenant(tenant)
  end

  def determine_tenant
    # Priority 1: Admin override via header (for TEEEM staff switching tenants)
    # X-Tenant-Override header replaces cookies which fail cross-origin (Vercel → Heroku)
    if current_user&.teeem_staff? && request.headers["X-Tenant-Override"].present?
      tenant = Tenant.find_by(id: request.headers["X-Tenant-Override"])
      return tenant if tenant
    end

    # Priority 1b: Admin override via cookie (legacy/local dev fallback)
    if current_user&.teeem_staff? && cookies.signed[:admin_tenant_id]
      tenant = Tenant.find_by(id: cookies.signed[:admin_tenant_id])
      return tenant if tenant
    end

    # Priority 2: Subdomain
    subdomain = request.subdomain
    if subdomain.present? && !%w[www api staging beta].include?(subdomain)
      tenant = Tenant.find_by(slug: subdomain)
      return tenant if tenant
    end

    # Priority 3: User's assigned tenant (SSoT)
    current_user&.tenant
  end

  def current_tenant
    ActsAsTenant.current_tenant
  end

  def authorize_request
    # Try JWT token first (Authorization header)
    header = request.headers["Authorization"]
    header = header.split(" ").last if header

    begin
      decoded = JsonWebToken.decode(header)
      @current_user = User.find(decoded[:user_id]) if decoded
    rescue ActiveRecord::RecordNotFound, JWT::DecodeError => e
      # JWT auth failed - try session cookie fallback
    end

    # Fallback: Try auth_token cookie (for session-based auth)
    unless @current_user
      auth_token = cookies.signed[:auth_token] || cookies[:auth_token]
      if auth_token.present?
        begin
          decoded = JsonWebToken.decode(auth_token)
          @current_user = User.find(decoded[:user_id]) if decoded
        rescue ActiveRecord::RecordNotFound, JWT::DecodeError
          # Cookie auth also failed
        end
      end
    end

    # Require authentication - no default user fallback
    # Use throw :abort to properly halt the filter chain in Rails API mode
    unless @current_user
      render json: { error: "Unauthorized" }, status: :unauthorized
      return false  # Explicitly halt the filter chain
    end
    true
  end

  def current_user
    @current_user
  end

  # Get the organization for the current request
  # SSoT (Jan 2026): Derive from tenant, not Organization.first
  # TODO: Add proper multi-org support when users can belong to multiple orgs
  def current_organization
    @current_organization ||= begin
      if current_tenant
        current_tenant.organizations.first
      else
        Rails.logger.warn "[ApplicationController] No tenant context - cannot determine organization"
        nil
      end
    end
  end

  # SSoT (Jan 2026): Require tenant context for operations that need storage
  def require_tenant!
    return if current_tenant.present?

    render json: {
      success: false,
      error: "Tenant context required for this operation"
    }, status: :unprocessable_entity
  end

  def require_admin
    unless current_user&.admin?
      render json: { error: "Unauthorized. Admin access required." }, status: :forbidden
    end
  end

  # Try to set current_user from token if present, but don't require it
  # Used for endpoints that work for both authenticated and unauthenticated users
  def set_current_user_if_token_present
    header = request.headers["Authorization"]
    header = header.split(" ").last if header
    return unless header

    begin
      decoded = JsonWebToken.decode(header)
      @current_user = User.find(decoded[:user_id]) if decoded
    rescue ActiveRecord::RecordNotFound, JWT::DecodeError
      # Silently ignore auth failures - this is optional auth
    end
  end

  # Update user's last_seen_at timestamp (throttled to once per minute to reduce DB writes)
  def update_last_seen
    return unless @current_user
    return if @current_user.last_seen_at && @current_user.last_seen_at > 1.minute.ago

    # Use update_column to skip callbacks and validations for performance
    @current_user.update_column(:last_seen_at, Time.current)
  end

  # Exception handlers
  def handle_standard_error(exception)
    Rails.logger.error("Unhandled exception: #{exception.class} - #{exception.message}")
    Rails.logger.error(exception.backtrace.first(10).join("\n"))

    render json: {
      success: false,
      error: "#{exception.class}: #{exception.message}"
    }, status: :internal_server_error
  end

  def handle_not_found(exception)
    render json: {
      success: false,
      error: "Resource not found"
    }, status: :not_found
  end

  def handle_validation_error(exception)
    render json: {
      success: false,
      error: "Validation failed",
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

  # REMOVED (Jan 2026): handle_file_not_found - ActiveStorage no longer used
  # StorageBlob handles file-not-found via standard exception handling
end
