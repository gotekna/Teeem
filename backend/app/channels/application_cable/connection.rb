# frozen_string_literal: true

module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      # Get user from session or token
      # For session-based auth:
      if verified_user = User.find_by(id: cookies.encrypted[:user_id])
        verified_user
      # For token-based auth (Authorization header):
      elsif auth_header = request.headers["Authorization"]
        token = auth_header.split(" ").last
        user_id = decode_token(token)
        User.find_by(id: user_id)
      else
        reject_unauthorized_connection
      end
    end

    def decode_token(token)
      # Your JWT/token decoding logic here
      # This should match your API authentication
      return nil if token.blank?

      begin
        # If using JWT:
        # decoded = JWT.decode(token, Rails.application.credentials.secret_key_base)[0]
        # decoded["user_id"]

        # If using simple session token:
        session = UserSession.find_by(token: token)
        session&.user_id
      rescue
        nil
      end
    end
  end
end
