# frozen_string_literal: true

# JobMarkupCharge - Per-job charge for insurance, levies, and overheads
#
# Each job can have one charge per type. Charges are calculated from rates
# (% of sell subtotal or cost total) or can be overridden with a fixed $ amount.
#
# SSoT: MarkupChargeCalculator is THE ONE service for computing amounts.
#
class JobMarkupCharge < ApplicationRecord
  acts_as_tenant :tenant

  CHARGE_TYPES = %w[construction_insurance qleave overheads qbcc_insurance builds_contingency project_prelims project_management maintenance_fee].freeze

  LABELS = {
    "construction_insurance" => "Builder's Construction Insurance",
    "qleave" => "QLeave",
    "overheads" => "Overheads",
    "qbcc_insurance" => "QBCC Home Warranty Insurance",
    "builds_contingency" => "Build Contingency",
    "project_prelims" => "Project Prelims",
    "project_management" => "Project Management",
    "maintenance_fee" => "Maintenance Fee"
  }.freeze

  belongs_to :job
  belongs_to :purchase_order, optional: true

  validates :charge_type, presence: true, inclusion: { in: CHARGE_TYPES }
  validates :charge_type, uniqueness: { scope: :job_id }
  validates :rate_percent, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :override_amount, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :calculated_amount, numericality: true, allow_nil: true

  def label
    LABELS[charge_type] || charge_type.humanize
  end

  def using_override?
    override_amount.present? && override_amount > 0
  end

  # The effective amount (override takes precedence over calculated)
  def effective_amount
    using_override? ? override_amount : (calculated_amount || 0)
  end
end
