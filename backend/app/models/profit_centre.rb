# frozen_string_literal: true

# ProfitCentre - Revenue/cost tracking by business segment per job
#
# Enables P&L reporting per profit centre: Design vs Base Contract vs Variations.
# Global templates (is_template: true) are available to all jobs.
# Job-specific profit centres (job_id set) track variations per job.
#
# Default cascade: Job.default_profit_centre → PO line items / Claim lines (UI convenience only)
#
class ProfitCentre < ApplicationRecord
  acts_as_tenant :tenant

  # Centre types
  CENTRE_TYPES = %w[base design variation other].freeze

  # Associations
  belongs_to :job, optional: true

  has_many :purchase_order_line_items, dependent: :nullify
  has_many :progress_claim_lines, class_name: "Gl::ProgressClaimLine", dependent: :nullify
  has_many :job_claims, dependent: :nullify

  # Jobs that use this as their default
  has_many :jobs_as_default, class_name: "Job", foreign_key: :default_profit_centre_id, dependent: :nullify

  # Validations
  validates :code, presence: true, length: { maximum: 20 }
  validates :name, presence: true, length: { maximum: 100 }
  validates :centre_type, inclusion: { in: CENTRE_TYPES }, allow_nil: true
  validates :budget_amount, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  # Uniqueness: global templates unique by tenant+code, job-specific unique by tenant+job+code
  validates :code, uniqueness: {
    scope: :tenant_id,
    conditions: -> { where(job_id: nil) },
    message: "already exists as a global template"
  }, if: -> { job_id.nil? }

  validates :code, uniqueness: {
    scope: [:tenant_id, :job_id],
    message: "already exists for this job"
  }, if: -> { job_id.present? }

  # Scopes
  scope :active, -> { where(active: true) }
  scope :templates, -> { where(is_template: true, job_id: nil) }
  scope :global, -> { where(job_id: nil) }
  scope :for_job, ->(job_id) { where(job_id: [nil, job_id]) }
  scope :variations, -> { where(centre_type: "variation") }
  scope :ordered, -> { order(:sort_order, :name) }

  # Display label (code + name)
  def display_label
    "#{code} - #{name}"
  end

  # Check if this is a global template
  def template?
    is_template? && job_id.nil?
  end

  # Check if this is job-specific
  def job_specific?
    job_id.present?
  end

  # Check if this is a variation
  def variation?
    centre_type == "variation"
  end
end
