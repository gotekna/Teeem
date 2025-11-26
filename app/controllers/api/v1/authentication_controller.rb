module Api
  module V1
    class AuthenticationController < ApplicationController
      skip_before_action :authorize_request, only: [ :login, :signup, :dev_login ]

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
        dev_user = User.find_by(email: 'robert@tekna.com.au') ||
                   User.find_by(email: 'rob@trapid.com.au') ||
                   User.where(role: 'admin').first ||
                   User.first

        # If no users exist, create a dev user
        unless dev_user
          dev_user = User.create!(
            email: 'dev@trapid.local',
            name: 'Dev User',
            password: 'DevPassword123!',
            role: 'admin'
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
            role: dev_user.role,
            permissions: dev_user.permissions
          }
        }
      end

      # POST /api/v1/auth/signup
      def signup
        user = User.new(signup_params)

        # Auto-approve Tekna employees
        if user.email&.end_with?('@tekna.com.au')
          user.role ||= 'user'  # Default role for Tekna employees
          Rails.logger.info "Auto-approving Tekna employee: #{user.email}"
        else
          # Non-Tekna emails default to user role as well
          user.role ||= 'user'
        end

        if user.save
          token = JsonWebToken.encode(user_id: user.id)
          render json: {
            success: true,
            token: token,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
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
              role: user.role,
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

      # GET /api/v1/auth/me
      def me
        render json: {
          success: true,
          user: {
            id: @current_user.id,
            email: @current_user.email,
            name: @current_user.name,
            role: @current_user.role,
            permissions: @current_user.permissions,
            preload_price_books: @current_user.preload_price_books
          }
        }
      end

      private

      def dev_mode_enabled?
        ENV['DEV_MODE_AUTH_BYPASS'] == 'true'
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
