# frozen_string_literal: true

# QuoteTracker - Tracks supplier quotes for construction jobs
#
# Tracks supplier quotes received for a job during the estimating phase.
# Enhanced with RFQ workflow: draft → sent → responded → accepted/rejected.
#
# SSoT: Foundation slug = 'quote-tracker'
# SSoT: Tab = Estimating > Quote Tracker
#
# Status flow:
#   draft → sent → responded → accepted (creates PO)
#                             → rejected
#
# Grouping: By PO Task (sm_schedule_master_id) — the template-level task
# Job linking: sm_task_id — the job-level task instance (for PO creation)
#
class QuoteTracker < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant

  STATUSES = %w[draft sent responded accepted rejected].freeze

  # Associations
  belongs_to :job
  belongs_to :sm_schedule_master, optional: true  # PO Task (template-level, for grouping)
  belongs_to :sm_task, class_name: 'SmTask', optional: true  # Job-level task instance
  belongs_to :sm_trade, optional: true             # Legacy category field
  belongs_to :supplier, class_name: 'Contact', optional: true
  belongs_to :contact, class_name: 'ContactPerson', optional: true  # Employee at supplier
  belongs_to :quote_template, optional: true  # Which template created this row
  belongs_to :sent_by, class_name: 'User', optional: true
  belongs_to :confirmed_by, class_name: 'User', optional: true
  belongs_to :purchase_order, optional: true  # Created when quote is accepted

  # Validations
  validates :job, presence: true
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :for_task, ->(master_id) { where(sm_schedule_master_id: master_id) }
  scope :for_trade, ->(trade_id) { where(sm_trade_id: trade_id) }  # Legacy
  scope :draft, -> { where(status: 'draft') }
  scope :sent, -> { where(status: 'sent') }
  scope :responded, -> { where(status: 'responded') }
  scope :accepted, -> { where(status: 'accepted') }
  scope :with_price, -> { where.not(price_quoted: nil) }

  # Display name for the grouping (PO Task name or trade name)
  def task_name
    sm_schedule_master&.name || sm_trade&.name
  end

  # Mark as sent (email was dispatched to supplier)
  def mark_sent!(user)
    update!(status: 'sent', sent_at: Time.current, sent_by: user)
  end

  # Record a supplier's response (price, timeframe, notes)
  def record_response!(price:, timeframe: nil, notes: nil)
    update!(
      status: 'responded',
      received: true,
      date_received: Date.current,
      price_quoted: price,
      timeframe: timeframe,
      response_notes: notes
    )
    recalculate_best_prices!
  end

  # Accept this quote and create a Purchase Order
  def accept_and_create_po!(user)
    raise "Cannot accept quote without a price" unless price_quoted.present?
    raise "Quote already accepted" if status == 'accepted'

    po = nil
    ActiveRecord::Base.transaction do
      po_attrs = {
        job: job,
        supplier: supplier,
        description: "#{task_name} - Quote #{quote_number}".strip,
        status: 'draft',
        budget: price_quoted
      }

      # Link PO to the job-level SmTask if available
      po_attrs[:sm_task] = sm_task if sm_task.present?

      po = PurchaseOrder.create!(po_attrs)

      update!(status: 'accepted', purchase_order: po)

      # Mark other quotes for same PO Task as rejected
      grouping_scope = if sm_schedule_master_id.present?
        QuoteTracker.where(job_id: job_id, sm_schedule_master_id: sm_schedule_master_id)
      elsif sm_trade_id.present?
        QuoteTracker.where(job_id: job_id, sm_trade_id: sm_trade_id)
      else
        QuoteTracker.none
      end

      grouping_scope
        .where.not(id: id)
        .where(status: %w[draft sent responded])
        .update_all(status: 'rejected')

      recalculate_best_prices!
    end

    po
  end

  # Reject this quote
  def reject!
    update!(status: 'rejected')
  end

  private

  # Recalculate is_best_price for all quotes in the same grouping
  def recalculate_best_prices!
    siblings = if sm_schedule_master_id.present?
      QuoteTracker.where(job_id: job_id, sm_schedule_master_id: sm_schedule_master_id)
    elsif sm_trade_id.present?
      QuoteTracker.where(job_id: job_id, sm_trade_id: sm_trade_id)
    else
      QuoteTracker.none
    end

    siblings = siblings.where.not(price_quoted: nil)
    return if siblings.empty?

    # Find the lowest price
    best = siblings.order(:price_quoted).first

    # Reset all, then set the best
    siblings.update_all(is_best_price: false)
    best.update_column(:is_best_price, true) if best
  end
end
