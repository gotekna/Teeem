class PropertySetting < ApplicationRecord
  acts_as_tenant :tenant
  belongs_to :xero_credential, optional: true

  validates :tenant_id, uniqueness: true

  def configured?
    xero_credential_id.present? || trading_name.present?
  end
end
