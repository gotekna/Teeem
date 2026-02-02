# frozen_string_literal: true

module Gl
  # Token for customer portal access
  class PortalToken < ApplicationRecord
    self.table_name = "gl_portal_tokens"

    TOKEN_TYPES = %w[invoice statement portal].freeze

    belongs_to :corporate_company, class_name: "Corporate"
    belongs_to :contact
    belongs_to :invoice, class_name: "Gl::Invoice", optional: true

    has_many :sessions, class_name: "Gl::PortalSession", dependent: :destroy

    validates :token, presence: true, uniqueness: true
    validates :token_type, inclusion: { in: TOKEN_TYPES }

    before_validation :generate_token, on: :create

    scope :active, -> { where(active: true) }
    scope :valid, -> { active.where("expires_at IS NULL OR expires_at > ?", Time.current) }

    # Generate token for single invoice
    def self.for_invoice(invoice, expires_in: 30.days)
      create!(
        corporate_company: invoice.corporate_company,
        contact: invoice.contact,
        invoice: invoice,
        token_type: "invoice",
        expires_at: Time.current + expires_in
      )
    end

    # Generate token for customer statement
    def self.for_statement(contact, expires_in: 7.days)
      create!(
        corporate_company: contact.corporate_company,
        contact: contact,
        token_type: "statement",
        expires_at: Time.current + expires_in
      )
    end

    # Generate full portal access token
    def self.for_portal(contact, expires_in: nil)
      create!(
        corporate_company: contact.corporate_company,
        contact: contact,
        token_type: "portal",
        expires_at: expires_in ? Time.current + expires_in : nil
      )
    end

    # Validate and record access
    def access!
      return false unless valid?

      update!(
        last_accessed_at: Time.current,
        access_count: access_count + 1
      )
      true
    end

    # Check if token is valid
    def valid_token?
      active? && (expires_at.nil? || expires_at > Time.current)
    end

    # Revoke token
    def revoke!
      update!(active: false)
    end

    # Create session for this token
    def create_session!(ip_address: nil, user_agent: nil)
      sessions.create!(
        contact: contact,
        ip_address: ip_address,
        user_agent: user_agent,
        expires_at: Time.current + 24.hours,
        last_activity_at: Time.current
      )
    end

    private

    def generate_token
      self.token ||= SecureRandom.urlsafe_base64(32)
    end
  end
end
