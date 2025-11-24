module Api
  module V1
    module Portal
      class AuthenticationController < ApplicationController
        skip_before_action :authorize_request, only: [:login, :signup, :forgot_password, :reset_password]

        # POST /api/v1/portal/auth/login
        def login
          portal_user = PortalUser.find_by(email: params[:email])

          unless portal_user
            render json: { success: false, error: 'Invalid email or password' }, status: :unauthorized
            return
          end

          # Check if account is locked
          if portal_user.locked?
            render json: { success: false, error: 'Account is locked. Please try again later.' }, status: :forbidden
            return
          end

          # Check if account is active
          unless portal_user.active?
            render json: { success: false, error: 'Account is not active. Please contact your builder.' }, status: :forbidden
            return
          end

          # Authenticate with password
          if portal_user.authenticate(params[:password])
            # Generate JWT token
            token = JsonWebToken.encode(portal_user_id: portal_user.id)

            # Record successful login
            portal_user.record_successful_login!

            # Get subcontractor account info
            subcontractor_account = portal_user.subcontractor_account

            render json: {
              success: true,
              message: 'Login successful',
              token: token,
              user: {
                id: portal_user.id,
                email: portal_user.email,
                contact_id: portal_user.contact_id,
                contact_name: portal_user.contact.display_name,
                company_name: portal_user.contact.company_name,
                portal_type: portal_user.portal_type,
                kudos_score: subcontractor_account&.kudos_score,
                account_tier: subcontractor_account&.account_tier,
                last_login_at: portal_user.last_login_at
              }
            }, status: :ok
          else
            # Record failed login attempt
            portal_user.record_failed_login!

            render json: { success: false, error: 'Invalid email or password' }, status: :unauthorized
          end
        rescue => e
          Rails.logger.error("Portal login error: #{e.message}")
          render json: { success: false, error: 'An error occurred during login' }, status: :internal_server_error
        end

        # POST /api/v1/portal/auth/signup
        def signup
          # For now, signup is disabled - users must be invited by builders
          render json: {
            success: false,
            error: 'Signup is not available. Please contact your builder for portal access.'
          }, status: :forbidden
        end

        # POST /api/v1/portal/auth/forgot_password
        def forgot_password
          email = params[:email]

          unless email.present?
            render json: { success: false, error: 'Email is required' }, status: :bad_request
            return
          end

          result = SubcontractorActivationService.send_password_reset(email)

          if result[:success]
            render json: {
              success: true,
              message: 'Password reset instructions sent to your email'
            }, status: :ok
          else
            # Don't reveal if email exists or not for security
            render json: {
              success: true,
              message: 'If an account exists with that email, password reset instructions have been sent'
            }, status: :ok
          end
        rescue => e
          Rails.logger.error("Password reset error: #{e.message}")
          render json: { success: false, error: 'An error occurred' }, status: :internal_server_error
        end

        # POST /api/v1/portal/auth/reset_password
        def reset_password
          token = params[:token]
          new_password = params[:password]

          unless token.present? && new_password.present?
            render json: { success: false, error: 'Token and password are required' }, status: :bad_request
            return
          end

          result = SubcontractorActivationService.reset_password(token, new_password)

          if result[:success]
            render json: {
              success: true,
              message: result[:message]
            }, status: :ok
          else
            render json: {
              success: false,
              error: result[:error],
              errors: result[:errors]
            }, status: :unprocessable_entity
          end
        rescue => e
          Rails.logger.error("Password reset error: #{e.message}")
          render json: { success: false, error: 'An error occurred' }, status: :internal_server_error
        end

        # GET /api/v1/portal/auth/me
        def me
          # This uses the authorize_portal_user from BaseController
          header = request.headers['Authorization']
          header = header.split(' ').last if header

          begin
            decoded = JsonWebToken.decode(header)
            portal_user = PortalUser.find(decoded[:portal_user_id]) if decoded

            unless portal_user&.active?
              render json: { success: false, error: 'Unauthorized' }, status: :unauthorized
              return
            end

            subcontractor_account = portal_user.subcontractor_account

            render json: {
              success: true,
              user: {
                id: portal_user.id,
                email: portal_user.email,
                contact_id: portal_user.contact_id,
                contact_name: portal_user.contact.display_name,
                company_name: portal_user.contact.company_name,
                portal_type: portal_user.portal_type,
                kudos_score: subcontractor_account&.kudos_score,
                account_tier: subcontractor_account&.account_tier,
                last_login_at: portal_user.last_login_at,
                accounting_connected: subcontractor_account&.accounting_system_connected
              }
            }, status: :ok
          rescue ActiveRecord::RecordNotFound, JWT::DecodeError => e
            render json: { success: false, error: 'Invalid or expired token' }, status: :unauthorized
          rescue => e
            Rails.logger.error("Auth me error: #{e.message}")
            render json: { success: false, error: 'An error occurred' }, status: :internal_server_error
          end
        end
      end
    end
  end
end
