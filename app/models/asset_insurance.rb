class AssetInsurance < ApplicationRecord
  # Associations
  belongs_to :asset

  # Validations
  validates :renewal_date, presence: true
  validates :status, inclusion: { in: %w[active expired cancelled] }
  validates :premium_amount, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true
  validates :coverage_amount, numericality: { greater_than_or_equal_to: 0 }, allow_nil: true

  # Scopes
  scope :active, -> { where(status: 'active') }
  scope :expired, -> { where(status: 'expired') }
  scope :expiring_soon, ->(days = 30) {
    where('renewal_date BETWEEN ? AND ? AND status = ?', Date.today, days.days.from_now, 'active')
  }
  scope :overdue, -> { where('renewal_date < ? AND status = ?', Date.today, 'active') }

  # Callbacks
  before_save :update_status_based_on_renewal_date
  after_create :create_activity
  after_update :create_update_activity

  # Instance methods
  def days_until_renewal
    return nil unless renewal_date.present?
    (renewal_date - Date.today).to_i
  end

  def expired?
    renewal_date.present? && renewal_date < Date.today
  end

  def expiring_soon?(days = 30)
    return false if expired?
    renewal_date.present? && days_until_renewal <= days && days_until_renewal >= 0
  end

  def display_name
    "#{insurer_name || 'Insurance'} - #{asset.display_name}"
  end

  private

  def update_status_based_on_renewal_date
    if renewal_date.present? && renewal_date < Date.today
      self.status = 'expired'
    end
  end

  def create_activity
    asset.company.company_activities.create!(
      activity_type: 'asset_insurance_added',
      description: "Insurance added for #{asset.display_name}",
      metadata: {
        asset_id: asset.id,
        insurer: insurer_name,
        renewal_date: renewal_date,
        coverage_amount: coverage_amount
      },
      performed_by: Current.user || User.first,
      occurred_at: Time.current
    )
  end

  def create_update_activity
    return unless saved_changes.any?

    asset.company.company_activities.create!(
      activity_type: 'asset_insurance_updated',
      description: "Insurance updated for #{asset.display_name}",
      metadata: {
        asset_id: asset.id,
        changes: saved_changes.except('updated_at')
      },
      performed_by: Current.user || User.first,
      occurred_at: Time.current
    )
  end
end
