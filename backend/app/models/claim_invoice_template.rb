# frozen_string_literal: true

# ClaimInvoiceTemplate - Defines visual styles for claim invoices
#
# SSoT for claim invoice appearance. Each template defines:
# - Visual style (colors, fonts, layout)
# - Content options (what sections to show)
# - Custom text (headers, footers, payment instructions)
#
# Templates are selected at the Schedule Master level, so all jobs
# from a template use the same invoice style for that claim stage.
#
class ClaimInvoiceTemplate < ApplicationRecord
  acts_as_tenant :tenant
  include ConfigSyncable

  # Style keys for the different template designs
  STYLE_KEYS = %w[classic modern bold minimal].freeze
  HEADER_STYLES = %w[standard banner minimal].freeze
  LOGO_POSITIONS = %w[left center right].freeze

  # Validations
  validates :name, presence: true, length: { maximum: 100 }
  validates :style_key, presence: true, inclusion: { in: STYLE_KEYS }
  validates :header_style, inclusion: { in: HEADER_STYLES }, allow_nil: true
  validates :logo_position, inclusion: { in: LOGO_POSITIONS }, allow_nil: true
  validates :primary_color, format: { with: /\A#[0-9a-fA-F]{6}\z/, message: "must be a valid hex color" }, allow_nil: true
  validates :secondary_color, format: { with: /\A#[0-9a-fA-F]{6}\z/, message: "must be a valid hex color" }, allow_nil: true

  # Ensure only one default template
  validate :only_one_default, if: :is_default?

  # Associations
  has_many :sm_schedule_masters, dependent: :nullify

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :by_style, ->(style) { where(style_key: style) }

  # Class methods
  def self.default_template
    find_by(is_default: true) || active.first
  end

  # Get preview data for frontend display
  def preview_data
    {
      id: id,
      name: name,
      description: description,
      style_key: style_key,
      is_default: is_default,
      primary_color: primary_color,
      secondary_color: secondary_color,
      font_family: font_family,
      logo_position: logo_position,
      header_style: header_style,
      show_logo: show_logo,
      show_company_details: show_company_details,
      show_bank_details: show_bank_details
    }
  end

  private

  def only_one_default
    if is_default? && self.class.where(is_default: true).where.not(id: id).exists?
      errors.add(:is_default, "can only be set for one template")
    end
  end
end
