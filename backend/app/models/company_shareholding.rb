class CompanyShareholding < ApplicationRecord
  # Associations
  belongs_to :company
  belongs_to :shareholder, polymorphic: true

  # Validations
  validates :number_of_shares, presence: true, numericality: { greater_than: 0 }
  validates :share_class, presence: true
  validates :shareholder_id, uniqueness: { scope: [:company_id, :shareholder_type, :share_class], message: 'already holds this class of shares' }

  # Scopes
  scope :ordinary, -> { where(share_class: 'ordinary') }
  scope :preference, -> { where(share_class: 'preference') }
  scope :beneficially_held, -> { where(beneficially_held: true) }

  # Callbacks
  after_create :ensure_ssot_shareholder_membership

  # Calculate percentage of total shares
  def percentage_of_total
    return 0 unless company.shares_on_issue.to_i > 0
    (number_of_shares.to_f / company.shares_on_issue * 100).round(2)
  end

  def shareholder_name
    case shareholder
    when Contact
      shareholder.full_name || shareholder.first_name
    when Company
      shareholder.name
    else
      'Unknown'
    end
  end

  private

  # SSoT: Automatically create ContactCompanyGroupMembership for shareholders
  def ensure_ssot_shareholder_membership
    return unless company&.company_group_id.present?
    return unless shareholder_type == 'Contact' && shareholder_id.present?

    ContactCompanyGroupMembership.find_or_create_by!(
      contact_id: shareholder_id,
      company_group_id: company.company_group_id,
      membership_type: 'shareholder'
    ) do |m|
      m.is_active = true
    end
  rescue StandardError => e
    Rails.logger.error("CompanyShareholding##{id}: SSoT shareholder membership creation failed - #{e.message}")
  end
end
