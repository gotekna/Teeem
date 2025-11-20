class WhsSwmsAcknowledgment < ApplicationRecord
  # Associations
  belongs_to :whs_swms
  belongs_to :user, optional: true

  # Validations
  validates :worker_name, presence: true
  validates :acknowledged_at, presence: true

  # Callbacks
  before_validation :set_acknowledged_at, on: :create
  before_create :capture_ip_address

  # Scopes
  scope :recent, -> { order(acknowledged_at: :desc) }
  scope :by_worker, ->(name) { where('worker_name ILIKE ?', "%#{name}%") }
  scope :for_user, ->(user) { where(user: user) }
  scope :today, -> { where('acknowledged_at >= ?', CompanySetting.today.beginning_of_day) }

  # Helper methods
  def worker_display_name
    worker_company.present? ? "#{worker_name} (#{worker_company})" : worker_name
  end

  def has_signature?
    signature_data.present?
  end

  private

  def set_acknowledged_at
    self.acknowledged_at ||= Time.current
  end

  def capture_ip_address
    # IP address should be set by controller
    # This is just a fallback
    self.ip_address ||= 'unknown'
  end
end
