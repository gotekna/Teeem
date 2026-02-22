# frozen_string_literal: true

# QuoteTemplate - Reusable templates for RFQ workflows
#
# Links to a PO Template Pack which defines:
#   - SM Schedule Master Template (schedule)
#   - PO Tasks (SmScheduleMaster) with assigned suppliers
#   - Pricebook line items per task
#
# The PO Template Pack's items are used to seed QuoteTemplateTrades
# (tasks with suppliers). Users can add additional suppliers beyond
# the pack defaults for competitive quoting.
#
# When applied to a job, creates QuoteTracker rows for each task × supplier.
#
# SSoT: Foundation slug = 'quote-templates'
# SSoT: Settings > Operations > Quote Templates
#
class QuoteTemplate < ApplicationRecord
  acts_as_tenant :tenant

  # Associations
  belongs_to :po_template_pack, optional: true
  belongs_to :created_by, class_name: "User", optional: true
  belongs_to :updated_by, class_name: "User", optional: true
  has_many :quote_template_trades, -> { order(:position) }, dependent: :destroy
  has_many :quote_trackers, dependent: :nullify

  accepts_nested_attributes_for :quote_template_trades, allow_destroy: true

  # Validations
  validates :name, presence: true, length: { maximum: 100 },
                   uniqueness: { scope: :tenant_id, case_sensitive: false }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :ordered, -> { order(:position, :name) }

  # Delegate SM template access through pack
  delegate :sm_schedule_master_template, to: :po_template_pack, allow_nil: true

  def trade_count
    quote_template_trades.size
  end

  def supplier_count
    quote_template_trades.sum { |t| t.quote_template_trade_suppliers.size }
  end

  # Populate QuoteTemplateTrades from the linked PO Template Pack's items.
  # Each pack item with an sm_schedule_master creates a trade row,
  # and the pack item's supplier becomes the first (preferred) supplier.
  #
  # Idempotent: skips tasks and suppliers already present.
  #
  def populate_from_pack!
    return unless po_template_pack

    po_template_pack.po_template_items
      .includes(:supplier, :sm_schedule_master)
      .each do |item|
        next unless item.sm_schedule_master_id

        # Find or create trade for this PO task
        trade = quote_template_trades.find_or_initialize_by(
          sm_schedule_master_id: item.sm_schedule_master_id
        )
        if trade.new_record?
          trade.position = item.position
          trade.default_instructions = item.notes
          trade.save!
        end

        # Add the pack's supplier if present and not already on this trade
        next unless item.supplier_id.present?
        next if trade.quote_template_trade_suppliers.exists?(supplier_id: item.supplier_id)

        trade.quote_template_trade_suppliers.create!(
          supplier_id: item.supplier_id,
          position: 0,
          is_preferred: true
        )
      end

    reload
  end

  # Apply this template to a job, creating QuoteTracker rows for each PO Task × supplier
  #
  # For each PO Task (SmScheduleMaster) in the template:
  # - Find the matching SmTask in the target job (by sm_schedule_master_id)
  # - Create a QuoteTracker row for each supplier, linked to both the
  #   SmScheduleMaster (template-level) and SmTask (job-level)
  #
  def apply_to_job!(job, created_by:)
    rows_created = []

    # Build lookup: sm_schedule_master_id → SmTask for this job
    job_tasks = SmTask.where(job_id: job.id).where.not(sm_schedule_master_id: nil)
    task_by_master_id = job_tasks.index_by(&:sm_schedule_master_id)

    ActiveRecord::Base.transaction do
      quote_template_trades.includes(
        :sm_schedule_master,
        quote_template_trade_suppliers: [:supplier, :contact_person]
      ).each do |template_trade|
        sm_master = template_trade.sm_schedule_master
        sm_task = task_by_master_id[sm_master.id]

        template_trade.quote_template_trade_suppliers.each do |template_supplier|
          contact_email = template_supplier.contact_person&.email

          tracker = QuoteTracker.create!(
            job: job,
            sm_schedule_master: sm_master,
            sm_task: sm_task,
            sm_trade: nil, # Legacy field, not used for new records
            supplier: template_supplier.supplier,
            contact: template_supplier.contact_person,
            contact_email: contact_email,
            quote_request_instructions: template_trade.default_instructions,
            quote_template: self,
            status: 'draft'
          )
          rows_created << tracker
        end
      end
    end

    rows_created
  end
end
