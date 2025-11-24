class QuoteRequestContact < ApplicationRecord
  # Associations
  belongs_to :quote_request
  belongs_to :contact

  # Validations
  validates :quote_request_id, presence: true
  validates :contact_id, presence: true
  validates :quote_request_id, uniqueness: { scope: :contact_id, message: 'contact already added to this quote request' }

  # Scopes
  scope :notified, -> { where.not(notified_at: nil) }
  scope :pending_notification, -> { where(notified_at: nil) }

  # Instance Methods
  def mark_notified!(method = 'email')
    update!(
      notified_at: Time.current,
      notification_method: method
    )
  end

  def notified?
    notified_at.present?
  end
end
