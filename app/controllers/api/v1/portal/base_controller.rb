module Api
  module V1
    module Portal
      class BaseController < ApplicationController
        skip_before_action :authorize_request
        before_action :authorize_portal_user

        private

        def authorize_portal_user
          header = request.headers['Authorization']
          header = header.split(' ').last if header

          begin
            decoded = JsonWebToken.decode(header)
            @current_portal_user = PortalUser.find(decoded[:portal_user_id]) if decoded

            unless @current_portal_user&.active?
              render json: { error: 'Portal access unauthorized' }, status: :unauthorized
              return
            end

            if @current_portal_user.locked?
              render json: { error: 'Account is locked' }, status: :forbidden
              return
            end

            # Log portal access
            log_portal_access

          rescue ActiveRecord::RecordNotFound, JWT::DecodeError => e
            render json: { error: 'Invalid or expired token' }, status: :unauthorized
          end
        end

        def current_portal_user
          @current_portal_user
        end

        def current_contact
          @current_contact ||= current_portal_user&.contact
        end

        def current_subcontractor_account
          @current_subcontractor_account ||= current_portal_user&.subcontractor_account
        end

        def require_subcontractor
          unless current_portal_user&.subcontractor?
            render json: { error: 'Subcontractor access required' }, status: :forbidden
          end
        end

        def log_portal_access
          PortalAccessLog.create!(
            portal_user: current_portal_user,
            action: "#{controller_name}##{action_name}",
            ip_address: request.remote_ip,
            user_agent: request.user_agent
          )
        rescue => e
          Rails.logger.error("Failed to log portal access: #{e.message}")
          # Don't fail the request if logging fails
        end
      end
    end
  end
end
