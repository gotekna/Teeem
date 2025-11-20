class SubcontractorInvoice < ApplicationRecord
  # Associations
  belongs_to :purchase_order
  belongs_to :contact
  belongs_to :accounting_integration, optional: true

  # Enums
  enum status: {
    draft: 'draft',
    sent: 'sent',
    paid: 'paid',
    overdue: 'overdue',
    cancelled: 'cancelled'
  }

  # Validations
  validates :purchase_order_id, presence: true
  validates :contact_id, presence: true
  validates :amount, presence: true, numericality: { greater_than: 0 }
  validates :status, presence: true
  validate :amount_not_exceeds_po_amount

  # Callbacks
  after_create :sync_to_accounting_system, if: :should_auto_sync?
  after_update :check_overdue_status

  # Scopes
  scope :unsent, -> { where(status: 'draft') }
  scope :pending_payment, -> { where(status: 'sent') }
  scope :paid, -> { where(status: 'paid') }
  scope :overdue, -> { where(status: 'overdue') }
  scope :recent, -> { order(created_at: :desc) }

  # Instance Methods
  def send!
    transaction do
      update!(status: 'sent')

      if accounting_integration.present?
        accounting_integration.create_invoice!(self)
      end
    end
  end

  def mark_paid!(paid_date = Time.current)
    update!(
      status: 'paid',
      paid_at: paid_date
    )
  end

  def mark_overdue!
    return if paid? || cancelled?
    update!(status: 'overdue')
  end

  def days_outstanding
    return 0 unless created_at
    return nil if paid?

    (Time.current - created_at).to_i / 1.day
  end

  def payment_terms_days
    contact.default_payment_terms || 30
  end

  def due_date
    return nil unless created_at
    created_at + payment_terms_days.days
  end

  def is_overdue?
    return false if paid? || cancelled?
    return false unless due_date

    Time.current > due_date
  end

  def sync_payment_status!
    return unless accounting_integration && external_invoice_id

    status_data = accounting_integration.fetch_payment_status(external_invoice_id)

    if status_data[:paid]
      mark_paid!(status_data[:paid_at])
    elsif is_overdue? && !overdue?
      mark_overdue!
    end
  end

  private

  def amount_not_exceeds_po_amount
    return unless purchase_order && amount

    if amount > purchase_order.total
      errors.add(:amount, "cannot exceed purchase order amount of #{purchase_order.total}")
    end
  end

  def should_auto_sync?
    accounting_integration.present? && accounting_integration.connected?
  end

  def sync_to_accounting_system
    accounting_integration.create_invoice!(self)
  rescue => e
    Rails.logger.error("Failed to sync invoice #{id} to accounting system: #{e.message}")
    # Don't fail the invoice creation, just log the error
  end

  def check_overdue_status
    if is_overdue? && !overdue?
      mark_overdue!
    end
  end
end
