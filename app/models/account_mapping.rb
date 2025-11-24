class AccountMapping < ApplicationRecord
  # Associations
  belongs_to :accounting_integration
  belongs_to :keepr_account, class_name: 'Keepr::Account'

  # Validations
  validates :external_account_id, presence: true
  validates :keepr_account_id, uniqueness: {
    scope: :accounting_integration_id,
    message: 'already has a mapping for this integration'
  }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :for_integration, ->(integration_id) { where(accounting_integration_id: integration_id) }

  # Instance Methods
  def activate!
    update!(is_active: true)
  end

  def deactivate!
    update!(is_active: false)
  end

  def external_account_display
    if external_account_code.present?
      "#{external_account_code} - #{external_account_name}"
    else
      external_account_name
    end
  end

  def trapid_account_display
    "#{keepr_account.number} - #{keepr_account.name}"
  end
end
