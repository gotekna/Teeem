# frozen_string_literal: true

# CustomQuote - A custom quote applied to a specific job
#
# Created by applying a CustomQuoteTemplate to a job, or built from scratch.
# Contains a tree of CustomQuoteLines (CC → PO) with job-specific SmTasks resolved.
#
# Status flow: draft → in_progress → completed
#
class CustomQuote < ApplicationRecord
  acts_as_tenant :tenant

  STATUSES = %w[draft in_progress completed].freeze

  # Associations
  belongs_to :job
  belongs_to :custom_quote_template, optional: true
  belongs_to :created_by, class_name: "User", optional: true
  has_many :lines, class_name: "CustomQuoteLine", dependent: :destroy
  has_many :root_lines, -> { where(parent_id: nil).order(:position) },
           class_name: "CustomQuoteLine"

  # Validations
  validates :name, presence: true, length: { maximum: 200 }
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :for_job, ->(job_id) { where(job_id: job_id) }
  scope :draft, -> { where(status: 'draft') }
  scope :in_progress, -> { where(status: 'in_progress') }
  scope :completed, -> { where(status: 'completed') }

  # Tree structure as nested JSON
  def as_tree
    root_lines.includes(children: :suppliers, suppliers: :supplier).map(&:as_tree_node)
  end

  # Recalculate totals from supplier prices and allocations
  def recalculate_totals!
    quoted = lines.joins(:suppliers)
                  .where(custom_quote_suppliers: { status: 'accepted' })
                  .sum('custom_quote_suppliers.price_quoted')

    allocated = CustomQuoteAllocation
                  .joins(:custom_quote_supplier)
                  .where(custom_quote_suppliers: { custom_quote_line_id: lines.select(:id) })
                  .sum(:allocated_amount)

    update_columns(total_quoted: quoted, total_allocated: allocated)
  end

  def variance
    (total_quoted || 0) - (total_allocated || 0)
  end
end
