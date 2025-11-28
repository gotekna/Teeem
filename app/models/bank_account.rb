class BankAccount < ApplicationRecord
  # Associations
  belongs_to :company

  # Validations
  validates :institution_name, presence: true
  validates :bsb, format: { with: /\A\d{6}\z/, message: "must be 6 digits", allow_blank: true }
  validates :account_number, presence: true
  validates :status, inclusion: { in: %w[active closed] }
  validate :date_closed_after_opened

  # Scopes
  scope :active, -> { where(status: 'active') }
  scope :closed, -> { where(status: 'closed') }
  scope :by_institution, ->(institution) { where(institution_name: institution) }

  # Callbacks
  after_create :create_activity
  after_update :create_update_activity, if: :saved_change_to_status?

  # Instance methods
  def formatted_bsb
    return nil unless bsb.present?
    # Format as XXX-XXX
    "#{bsb[0..2]}-#{bsb[3..5]}"
  end

  def display_name
    "#{institution_name} - #{masked_account_number}"
  end

  def masked_account_number
    return nil unless account_number.present?
    # Show last 4 digits only
    "****#{account_number.last(4)}"
  end

  def active?
    status == 'active'
  end

  private

  def date_closed_after_opened
    return unless date_opened.present? && date_closed.present?
    if date_closed < date_opened
      errors.add(:date_closed, "cannot be before date opened")
    end
  end

  def create_activity
    user = defined?(Current) && Current.respond_to?(:user) ? Current.user : nil
    company.company_activities.create!(
      activity_type: 'bank_account_added',
      description: "Bank account added: #{display_name}",
      change_details: { bank_account_id: id, institution: institution_name },
      user: user || User.first
    )
  end

  def create_update_activity
    if status == 'closed'
      user = defined?(Current) && Current.respond_to?(:user) ? Current.user : nil
      company.company_activities.create!(
        activity_type: 'bank_account_closed',
        description: "Bank account closed: #{display_name}",
        change_details: { bank_account_id: id, date_closed: date_closed },
        user: user || User.first
      )
    end
  end
end
