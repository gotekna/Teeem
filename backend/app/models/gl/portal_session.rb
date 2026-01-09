# frozen_string_literal: true

module Gl
  # Customer portal session
  class PortalSession < ApplicationRecord
    self.table_name = "gl_portal_sessions"

    belongs_to :portal_token, class_name: "Gl::PortalToken"
    belongs_to :contact

    validates :session_token, presence: true, uniqueness: true

    before_validation :generate_session_token, on: :create

    scope :active, -> { where("expires_at > ?", Time.current) }

    # Validate session
    def valid_session?
      expires_at > Time.current
    end

    # Touch activity
    def touch_activity!
      update!(last_activity_at: Time.current)
    end

    # Extend session
    def extend!(hours: 24)
      update!(expires_at: Time.current + hours.hours)
    end

    # End session
    def end!
      update!(expires_at: Time.current)
    end

    private

    def generate_session_token
      self.session_token ||= SecureRandom.urlsafe_base64(32)
    end
  end
end
