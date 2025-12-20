# frozen_string_literal: true

# Organization model - SSoT for multi-org isolation
# Created as part of Microsoft credential org isolation fix
#
# Each organization has its own Microsoft credentials and other resources.
# This model is THE source of truth for organization identity.
class Organization < ApplicationRecord
  # Associations - credentials belong to organizations
  has_many :microsoft_credentials, dependent: :destroy
  has_many :organization_microsoft_app_credentials, dependent: :destroy

  # Validations
  validates :name, presence: true, uniqueness: true
  validates :slug, presence: true, uniqueness: true

  # Scopes
  scope :active, -> { where(is_active: true) }

  # Callbacks
  before_validation :generate_slug, on: :create

  # Class methods
  def self.find_by_name_or_slug(identifier)
    find_by(slug: identifier) || find_by(name: identifier)
  end

  private

  def generate_slug
    self.slug ||= name&.parameterize
  end
end
