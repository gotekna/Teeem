class CorporateGroup < ApplicationRecord
  # Associations
  has_many :corporate_companies, foreign_key: :company_group_id, dependent: :nullify
  has_many :xero_chart_of_accounts, dependent: :destroy
  has_many :reconciliation_reports, dependent: :destroy

  # Contact memberships (SSoT - all contacts linked to this group)
  has_many :contact_memberships, class_name: "ContactCorporateGroupMembership", foreign_key: :company_group_id, dependent: :destroy
  has_many :contacts, through: :contact_memberships

  # Validations
  validates :name, presence: true, uniqueness: true

  # Scopes
  scope :active, -> { where(active: true) }

  def display_name
    name
  end

  def corporate_companies_count
    corporate_companies.count
  end

  # SSoT Entity Queries - get entities by type from this group
  def people_in_group
    contacts.joins(:corporate_group_memberships)
            .where(contact_corporate_group_memberships: { corporate_group_id: id })
            .where(entity_type: "person")
            .distinct
  end

  def companies_in_group
    contacts.joins(:corporate_group_memberships)
            .where(contact_corporate_group_memberships: { corporate_group_id: id })
            .where(entity_type: "company")
            .distinct
  end

  def trusts_in_group
    contacts.joins(:corporate_group_memberships)
            .where(contact_corporate_group_memberships: { corporate_group_id: id })
            .where(entity_type: "trust")
            .distinct
  end

  def all_entities
    {
      companies: companies_in_group,
      trusts: trusts_in_group,
      people: people_in_group
    }
  end

  # Directors in this group (people who are directors of any company in the group)
  def directors
    contact_memberships.directors.active.includes(:contact).map(&:contact).uniq
  end

  # Shareholders in this group
  def shareholders
    contact_memberships.shareholders.active.includes(:contact).map(&:contact).uniq
  end

  # Beneficiaries in this group
  def beneficiaries
    contact_memberships.beneficiaries.active.includes(:contact).map(&:contact).uniq
  end
end
