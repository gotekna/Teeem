# frozen_string_literal: true

module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      # Extract token from query string (wss://host/cable?token=xxx)
      token = request.params[:token]
      return reject_unauthorized_connection if token.blank?

      # Decode JWT token (same secret as API authentication)
      decoded = JWT.decode(
        token,
        Rails.application.secret_key_base,
        true,
        algorithm: "HS256"
      )

      user_id = decoded[0]["user_id"]
      user = User.find_by(id: user_id)

      return reject_unauthorized_connection unless user

      user
    rescue JWT::ExpiredSignature
      Rails.logger.warn("[ActionCable] JWT token expired")
      reject_unauthorized_connection
    rescue JWT::DecodeError => e
      Rails.logger.warn("[ActionCable] JWT decode error: #{e.message}")
      reject_unauthorized_connection
    rescue StandardError => e
      Rails.logger.error("[ActionCable] Connection error: #{e.message}")
      reject_unauthorized_connection
    end
  end
end
