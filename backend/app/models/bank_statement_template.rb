# frozen_string_literal: true

# BankStatementTemplate - SSoT for bank statement PDF generation branding
#
# This model stores all configuration for generating bank-branded PDF statements.
# The BankTransactionReportService reads from this table instead of hardcoded values.
#
# Admin UI: Admin > System > Company > Doc Templates > Bank Statements
#
class BankStatementTemplate < ApplicationRecord
  # == Validations ==
  validates :bank_code, presence: true, uniqueness: { case_sensitive: false }
  validates :bank_name, presence: true
  validates :primary_color, presence: true, format: {
    with: /\A[0-9A-Fa-f]{6}\z/,
    message: "must be a valid 6-character hex color (e.g., C20000)"
  }
  validates :secondary_color, format: {
    with: /\A[0-9A-Fa-f]{6}\z/,
    message: "must be a valid 6-character hex color",
    allow_blank: true
  }
  validates :text_on_primary, format: {
    with: /\A[0-9A-Fa-f]{6}\z/,
    message: "must be a valid 6-character hex color",
    allow_blank: true
  }
  validates :layout_style, inclusion: {
    in: %w[nab westpac boq commbank anz stripe default],
    message: "%{value} is not a valid layout style"
  }, allow_blank: true

  # == Scopes ==
  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:bank_name) }

  # == Class Methods ==

  # Find the appropriate template for a given bank account name
  # Uses detection_patterns (array of regex patterns) to match
  #
  # @param bank_name [String] The bank account name to match
  # @return [BankStatementTemplate, nil] The matching template or default
  def self.for_bank(bank_name)
    return find_by(bank_code: "default") if bank_name.blank?

    name = bank_name.to_s.downcase

    # Try to find a matching active template by detection patterns
    active.find do |template|
      patterns = template.detection_patterns
      next false if patterns.blank?

      patterns.any? do |pattern|
        name.match?(Regexp.new(pattern, Regexp::IGNORECASE))
      rescue RegexpError
        false
      end
    end || find_by(bank_code: "default")
  end

  # List of available layout styles for dropdown
  def self.layout_styles
    %w[nab westpac boq commbank anz stripe default]
  end

  # Common date format options for dropdown
  def self.date_format_options
    [
      { value: "%-d %b %Y", label: "5 Jun 2024 (NAB style)" },
      { value: "%d/%m/%y", label: "05/06/24 (Westpac style)" },
      { value: "%d/%m/%Y", label: "05/06/2024 (BOQ style)" },
      { value: "%d %b %Y", label: "05 Jun 2024 (CBA/ANZ style)" },
      { value: "%-d %B %Y", label: "5 June 2024 (Long month)" },
      { value: "%Y-%m-%d", label: "2024-06-05 (ISO format)" }
    ]
  end

  # == Instance Methods ==

  # Get the formatted date using this template's format
  def format_date(date)
    return "" if date.nil?

    format_string = date_format.presence || "%-d %b %Y"
    date.strftime(format_string)
  end

  # Preview the date format with today's date
  def date_format_preview
    format_date(Date.current)
  end

  # Get branding hash for PDF generation (backwards compatible with old BANK_BRANDING format)
  def to_branding_hash
    {
      primary_color: primary_color || "5D2E46",
      secondary_color: secondary_color || "333333",
      text_on_primary: text_on_primary || "FFFFFF",
      bank_title: bank_name || "Bank",
      account_type: account_type || "Account"
    }
  end
end
