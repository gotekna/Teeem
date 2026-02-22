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
class QuoteTracker < ApplicationRecord
  # Multi-tenancy: Scope all queries to current tenant (Tenant model is SSoT)
  acts_as_tenant :tenant

  STATUSES = %w[draft sent responded accepted rejected].freeze

  # Associations
  belongs_to :job
  belongs_to :sm_trade, optional: true        # Category (e.g. "Roof Trusses")
  belongs_to :supplier, class_name: 'Contact', optional: true
  belongs_to :contact, class_name: 'ContactPerson', optional: true  # Employee at supplier
  belongs_to :quote_template, optional: true  # Which template created this row
  belongs_to :sent_by, class_name: 'User', optional: true
  belongs_to :purchase_order, optional: true  # Created when quote is accepted

  # Validations
  validates :job, presence: true
  validates :status, inclusion: { in: STATUSES }

  # Scopes
  scope :for_trade, ->(trade_id) { where(sm_trade_id: trade_id) }
  scope :draft, -> { where(status: 'draft') }
  scope :sent, -> { where(status: 'sent') }
  scope :responded, -> { where(status: 'responded') }
  scope :accepted, -> { where(status: 'accepted') }
  scope :with_price, -> { where.not(price_quoted: nil) }

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
      po = PurchaseOrder.create!(
        job: job,
        supplier: supplier,
        description: "#{sm_trade&.name} - Quote #{quote_number}".strip,
        status: 'draft',
        budget: price_quoted
      )

      update!(status: 'accepted', purchase_order: po)

      # Mark other quotes for same trade as rejected
      QuoteTracker.where(job_id: job_id, sm_trade_id: sm_trade_id)
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

  # Recalculate is_best_price for all quotes with the same job + trade
  def recalculate_best_prices!
    siblings = QuoteTracker.where(job_id: job_id, sm_trade_id: sm_trade_id)
                           .where.not(price_quoted: nil)

    return if siblings.empty?

    # Find the lowest price
    best = siblings.order(:price_quoted).first

    # Reset all, then set the best
    siblings.update_all(is_best_price: false)
    best.update_column(:is_best_price, true) if best
  end
end
