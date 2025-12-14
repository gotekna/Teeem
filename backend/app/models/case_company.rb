# CaseCompany - links companies to cases
class CaseCompany < ApplicationRecord
  belongs_to :case_record, foreign_key: :case_id, class_name: "CaseRecord"
  belongs_to :corporate_company, foreign_key: "company_id"

  # Alias company to corporate_company for backwards compatibility
  alias_method :company, :corporate_company

  validates :case_id, uniqueness: { scope: :company_id }
  validates :role, inclusion: {
    in: %w[subject co_primary related_entity counterparty],
    allow_blank: true
  }

  scope :primary, -> { where(is_primary: true) }
  scope :by_role, ->(role) { where(role: role) }
  scope :subjects, -> { where(role: "subject") }

  ROLES = {
    "subject" => "Subject of Investigation",
    "co_primary" => "Co-Primary Entity",
    "related_entity" => "Related Entity",
    "counterparty" => "Counterparty"
  }.freeze

  def formatted_role
    ROLES[role] || role&.titleize
  end
end
