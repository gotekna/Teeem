class QuoteResponse < ApplicationRecord
  # Associations
  belongs_to :quote_request
  belongs_to :contact
  belongs_to :responded_by_portal_user, class_name: 'PortalUser', optional: true
  has_many :kudos_events, dependent: :destroy
  has_one :purchase_order, dependent: :nullify

  # Enums
  enum status: {
    pending: 'pending',
    submitted: 'submitted',
    accepted: 'accepted',
    rejected: 'rejected',
    invalid: 'invalid'
  }

  # Validations
  validates :quote_request_id, presence: true
  validates :contact_id, presence: true
  validates :price, presence: true, numericality: { greater_than: 0 }
  validates :status, presence: true
  validates :timeframe, presence: true, if: -> { submitted? || accepted? }

  # Callbacks
  after_update :record_kudos_event, if: :saved_change_to_status?
  after_create :update_quote_request_status

  # Scopes
  scope :for_contact, ->(contact_id) { where(contact_id: contact_id) }
  scope :pending_response, -> { where(status: 'pending') }
  scope :submitted, -> { where(status: 'submitted') }
  scope :accepted, -> { where(status: 'accepted') }
  scope :rejected, -> { where(status: 'rejected') }
  scope :recent, -> { order(created_at: :desc) }

  # Instance Methods
  def submit!(params = {})
    transaction do
      update!(
        price: params[:price],
        timeframe: params[:timeframe],
        notes: params[:notes],
        status: 'submitted',
        submitted_at: Time.current
      )
    end
  end

  def accept!
    update!(
      status: 'accepted',
      decision_at: Time.current
    )
  end

  def reject!
    update!(
      status: 'rejected',
      decision_at: Time.current
    )
  end

  def mark_invalid!
    update!(
      status: 'invalid',
      decision_at: Time.current
    )
  end

  def response_time_hours
    return nil unless submitted_at && quote_request.created_at
    ((submitted_at - quote_request.created_at) / 1.hour).round(2)
  end

  def builder
    quote_request.construction
  end

  private

  def record_kudos_event
    return unless contact.subcontractor_account.present?

    case status
    when 'submitted'
      KudosEvent.create!(
        subcontractor_account: contact.subcontractor_account,
        quote_response: self,
        event_type: 'quote_submitted',
        expected_time: quote_request.created_at + 24.hours,
        actual_time: submitted_at,
        points_awarded: calculate_quote_response_points
      )
    end
  end

  def calculate_quote_response_points
    hours = response_time_hours
    return 0 if hours.nil?

    # Award points based on speed
    if hours <= 2
      100
    elsif hours <= 6
      75
    elsif hours <= 24
      50
    elsif hours <= 48
      25
    else
      10
    end
  end

  def update_quote_request_status
    if quote_request.quote_responses.submitted.any?
      quote_request.quotes_received! unless quote_request.quotes_received?
    end
  end
end
