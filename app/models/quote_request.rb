class QuoteRequest < ApplicationRecord
  # Associations
  belongs_to :construction
  belongs_to :created_by, class_name: 'User'
  belongs_to :selected_quote_response, class_name: 'QuoteResponse', optional: true
  has_many :quote_responses, dependent: :destroy
  has_many :quote_request_contacts, dependent: :destroy
  has_many :contacts, through: :quote_request_contacts

  # Enums
  enum status: {
    draft: 'draft',
    sent: 'sent',
    quotes_received: 'quotes_received',
    accepted: 'accepted',
    cancelled: 'cancelled'
  }

  # Validations
  validates :title, presence: true
  validates :status, presence: true
  validates :construction_id, presence: true
  validates :created_by_id, presence: true
  validates :budget_min, numericality: { greater_than: 0, allow_nil: true }
  validates :budget_max, numericality: { greater_than: 0, allow_nil: true }
  validate :budget_max_greater_than_min

  # Callbacks
  after_create :set_sent_status, if: -> { draft? }

  # Scopes
  scope :active, -> { where(status: %w[sent quotes_received]) }
  scope :pending_response, -> { where(status: 'sent') }
  scope :recent, -> { order(created_at: :desc) }
  scope :by_trade, ->(trade) { where(trade_category: trade) }

  # Instance Methods
  def send_to_suppliers!(contact_ids)
    transaction do
      contact_ids.each do |contact_id|
        quote_request_contacts.create!(
          contact_id: contact_id,
          notified_at: Time.current,
          notification_method: 'email'
        )
      end
      sent!
    end
  end

  def accept_quote!(quote_response)
    transaction do
      update!(
        selected_quote_response: quote_response,
        status: 'accepted'
      )
      quote_response.accepted!

      # Mark other responses as rejected
      quote_responses.where.not(id: quote_response.id).each(&:rejected!)
    end
  end

  def days_waiting
    return 0 unless created_at
    (Time.current - created_at).to_i / 1.day
  end

  def has_responses?
    quote_responses.submitted.any?
  end

  def response_count
    quote_responses.submitted.count
  end

  private

  def budget_max_greater_than_min
    return if budget_min.nil? || budget_max.nil?
    if budget_max < budget_min
      errors.add(:budget_max, 'must be greater than minimum budget')
    end
  end

  def set_sent_status
    # Override if needed - default is draft
  end
end
