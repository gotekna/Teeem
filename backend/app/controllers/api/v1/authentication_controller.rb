module Api
  module V1
    class AuthenticationController < ApplicationController
      skip_before_action :authorize_request, only: [ :login, :signup, :dev_login, :impersonate, :users ]

      # GET /api/v1/auth/dev_login
      # Dev mode only: Auto-login as default dev user
      def dev_login
        unless dev_mode_enabled?
          render json: {
            success: false,
            error: "Dev mode is not enabled. Set DEV_MODE_AUTH_BYPASS=true in .env"
          }, status: :forbidden
          return
        end

        # Try to find an existing user (prefer robert@tekna.com.au for local dev)
        dev_user = User.find_by(email: "robert@tekna.com.au") ||
                   User.find_by(email: "rob@teeem.com.au") ||
                   User.where(role: "admin").first ||
                   User.first

        # If no users exist, create a dev user
        unless dev_user
          dev_user = User.create!(
            email: "dev@teeem.local",
            name: "Dev User",
            password: "DevPassword123!",
            role: "admin"
          )
        end

        token = JsonWebToken.encode(user_id: dev_user.id)
        render json: {
          success: true,
          token: token,
          dev_mode: true,
          user: {
            id: dev_user.id,
            email: dev_user.email,
            name: dev_user.name,
            role_names: dev_user.role_names,
            permissions: dev_user.permissions
          }
        }
      end

      # POST /api/v1/auth/signup
      def signup
        user = User.new(signup_params)

        if user.save
          # SSoT: Assign default role via user_roles join table
          default_role = Role.find_by(name: "user")
          user.roles << default_role if default_role && user.roles.empty?

          Rails.logger.info "New user signup: #{user.email}"

          token = JsonWebToken.encode(user_id: user.id)
          render json: {
            success: true,
            token: token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role_names: user.role_names,
              permissions: user.permissions
            }
          }, status: :created
        else
          render json: {
            success: false,
            errors: user.errors.full_messages
          }, status: :unprocessable_entity
        end
      end

      # POST /api/v1/auth/login
      def login
        user = User.find_by(email: login_params[:email])

        if user&.authenticate(login_params[:password])
          # Update last login timestamp
          user.update_column(:last_login_at, Time.current)

          token = JsonWebToken.encode(user_id: user.id)
          render json: {
            success: true,
            token: token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role_names: user.role_names,
              permissions: user.permissions
            }
          }
        else
          render json: {
            success: false,
            error: "Invalid email or password"
          }, status: :unauthorized
        end
      end

      # GET /api/v1/auth/impersonate/:user_id
      # Admin-only: Login as another user (requires admin secret)
      def impersonate
        # Require admin secret for security
        admin_secret = ENV["ADMIN_IMPERSONATE_SECRET"] || "tekna-admin-2024"
        provided_secret = params[:secret] || request.headers["X-Admin-Secret"]

        unless provided_secret == admin_secret
          render json: { success: false, error: "Invalid admin secret" }, status: :unauthorized
          return
        end

        # Find user by ID or email
        user = if params[:user_id].to_s.match?(/\A\d+\z/)
                 User.find_by(id: params[:user_id])
        else
                 User.find_by(email: params[:user_id])
        end

        unless user
          render json: { success: false, error: "User not found" }, status: :not_found
          return
        end

        token = JsonWebToken.encode(user_id: user.id)
        render json: {
          success: true,
          token: token,
          impersonating: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role_names: user.role_names,
            permissions: user.permissions
          }
        }
      end

      # GET /api/v1/auth/users
      # List all users (for admin impersonation UI)
      def users
        # Require admin secret
        admin_secret = ENV["ADMIN_IMPERSONATE_SECRET"] || "tekna-admin-2024"
        provided_secret = params[:secret] || request.headers["X-Admin-Secret"]

        unless provided_secret == admin_secret
          render json: { success: false, error: "Invalid admin secret" }, status: :unauthorized
          return
        end

        users = User.where("email LIKE ?", "%@tekna.com.au").order(:name).map do |u|
          {
            id: u.id,
            email: u.email,
            name: u.name,
            role_names: u.role_names,
            has_outlook: u.outlook_credential.present?,
            last_login_at: u.last_login_at
          }
        end

        render json: { success: true, users: users }
      end

      # GET /api/v1/auth/me
      def me
        render json: {
          success: true,
          user: {
            id: @current_user.id,
            email: @current_user.email,
            name: @current_user.name,
            role_names: @current_user.role_names,
            permissions: @current_user.permissions,
            preload_price_books: @current_user.preload_price_books
          }
        }
      end

      private

      def dev_mode_enabled?
        ENV["DEV_MODE_AUTH_BYPASS"] == "true"
      end

      def signup_params
        params.require(:user).permit(:email, :password, :password_confirmation, :name)
      end

      def login_params
        params.require(:user).permit(:email, :password)
      end
    end
  end
end
