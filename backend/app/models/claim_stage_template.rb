# frozen_string_literal: true

class ClaimStageTemplate < ApplicationRecord
  # Associations
  belongs_to :job_type, optional: true  # nil = default template for all job types
  has_many :job_claim_stages, dependent: :nullify

  # Validations
  validates :name, presence: true
  validates :name, uniqueness: { scope: :job_type_id, message: "already exists for this job type" }
  validates :percentage, presence: true,
                         numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }
  validates :sequence_order, presence: true, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:sequence_order) }
  scope :for_job_type, ->(job_type_id) { where(job_type_id: job_type_id) }

  # Default match patterns for common stage names
  DEFAULT_MATCH_PATTERNS = {
    "Deposit" => "deposit|dep",
    "Slab" => "slab|base",
    "Frame" => "frame",
    "Enclosed" => "enclos|lock",
    "Fixing" => "fix",
    "Practical Completion" => "pc|prac|completion",
    "Kitchen 2nd Draw" => "2nd|second",
    "Kitchen 3rd Draw" => "3rd|third",
    "Kitchen Final Draw" => "final|complet"
  }.freeze

  # Callbacks
  before_validation :set_default_match_pattern, on: :create

  # Instance methods
  def match_pattern_regex
    return nil if invoice_match_pattern.blank?
    Regexp.new(invoice_match_pattern, Regexp::IGNORECASE)
  rescue RegexpError
    nil
  end

  def matches_invoice_description?(description)
    return false if description.blank? || invoice_match_pattern.blank?
    regex = match_pattern_regex
    return false unless regex
    description.match?(regex)
  end

  private

  def set_default_match_pattern
    return if invoice_match_pattern.present?
    self.invoice_match_pattern = DEFAULT_MATCH_PATTERNS[name]
  end
end
