# frozen_string_literal: true

# EmailAlias - Email forwarding aliases for PolarisMail subscriptions
#
# Supports:
# - Regular aliases (info -> rob@domain.com)
# - Catch-all aliases (* -> rob@domain.com)
#
class EmailAlias < ApplicationRecord
  belongs_to :email_subscription

  # Constants
  ALIAS_TYPES = %w[alias catchall].freeze

  # Validations
  validates :alias_address, presence: true
  validates :target_address, presence: true
  validates :alias_type, inclusion: { in: ALIAS_TYPES }
  validates :alias_address, uniqueness: { scope: :email_subscription_id }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :catchall, -> { where(alias_type: "catchall") }

  # Callbacks
  before_validation :normalize_addresses
  before_validation :set_alias_type

  # Full alias address with domain
  def full_alias_address
    return "*@#{email_subscription.domain}" if alias_address == "*"
    "#{alias_address}@#{email_subscription.domain}"
  end

  # Check if this is a catch-all
  def catchall?
    alias_address == "*" || alias_type == "catchall"
  end

  private

  def normalize_addresses
    self.alias_address = alias_address&.strip&.downcase
    self.target_address = target_address&.strip&.downcase
  end

  def set_alias_type
    self.alias_type = alias_address == "*" ? "catchall" : "alias"
  end
end
