# frozen_string_literal: true

# CustomQuoteSupplier - Tracks a supplier's quote for a custom quote line
#
# Status flow: draft → sent → responded → accepted/rejected
#
# For CC-level quotes (line.quote_level == 'cost_centre'):
#   After acceptance, user creates allocations to break down into PO amounts.
#
# For PO-level quotes (line.quote_level == 'po'):
#   Acceptance directly creates a PurchaseOrder.
#
class CustomQuoteSupplier < ApplicationRecord
  STATUSES = %w[draft sent responded accepted rejected].freeze

  # Associations
  belongs_to :custom_quote_line
  belongs_to :supplier, class_name: "Contact"
  belongs_to :contact_person, class_name: "ContactPerson", optional: true
  belongs_to :sent_by, class_name: "User", optional: true
  belongs_to :purchase_order, optional: true
  belongs_to :warehouse_document, optional: true
  has_many :allocations, class_name: "CustomQuoteAllocation",
           dependent: :destroy

  # Validations
  validates :status, inclusion: { in: STATUSES }
  validates :supplier_id, uniqueness: { scope: :custom_quote_line_id,
            message: "is already assigned to this line" }

  # Scopes
  scope :draft, -> { where(status: 'draft') }
  scope :sent, -> { where(status: 'sent') }
  scope :responded, -> { where(status: 'responded') }
  scope :accepted, -> { where(status: 'accepted') }
  scope :rejected, -> { where(status: 'rejected') }
  scope :with_price, -> { where.not(price_quoted: nil) }

  # Mark as sent (RFQ email dispatched)
  def mark_sent!(user)
    update!(
      status: 'sent',
      sent_at: Time.current,
      sent_by: user,
      date_sent: Date.current
    )
  end

  # Record supplier's response
  def record_response!(price:, quote_number: nil, timeframe: nil, notes: nil, valid_to: nil)
    update!(
      status: 'responded',
      price_quoted: price,
      quote_number: quote_number,
      date_received: Date.current,
      timeframe: timeframe,
      response_notes: notes,
      valid_to: valid_to
    )
    recalculate_best_prices!
  end

  # Reject this quote
  def reject!
    update!(status: 'rejected')
  end

  # Summary for tree node serialization
  def as_json_summary
    {
      id: id,
      supplierId: supplier_id,
      supplierName: supplier&.name,
      contactPersonId: contact_person_id,
      contactEmail: contact_email,
      status: status,
      priceQuoted: price_quoted&.to_f,
      quoteNumber: quote_number,
      dateSent: date_sent,
      dateReceived: date_received,
      validTo: valid_to,
      timeframe: timeframe,
      isBestPrice: is_best_price,
      purchaseOrderId: purchase_order_id,
      warehouseDocumentId: warehouse_document_id
    }
  end

  private

  # Recalculate is_best_price for all suppliers on the same line
  def recalculate_best_prices!
    siblings = CustomQuoteSupplier
                 .where(custom_quote_line_id: custom_quote_line_id)
                 .where.not(price_quoted: nil)
    return if siblings.empty?

    best = siblings.order(:price_quoted).first
    siblings.update_all(is_best_price: false)
    best.update_column(:is_best_price, true) if best
  end
end
