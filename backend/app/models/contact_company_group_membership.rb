class ContactCompanyGroupMembership < ApplicationRecord
  # Associations
  belongs_to :contact
  belongs_to :company_group, foreign_key: "company_group_id"
  belongs_to :corporate, foreign_key: "company_id", optional: true  # If this contact IS a company in the group

  # Constants
  MEMBERSHIP_TYPES = %w[
    director
    secretary
    corporate_officer
    shareholder
    beneficiary
    trustee
    appointor
    family_member
    advisor
    member
    company_entity
    trust_entity
  ].freeze

  # Beneficiary types for trust beneficiaries
  # - named: Specific named individuals
  # - class: Groups/classes of beneficiaries (e.g., "children of X", "relatives")
  # - default: Taker in default - receives if trustee doesn't exercise discretion
  BENEFICIARY_TYPES = %w[named class default].freeze

  # Validations
  # Allow same contact to have multiple roles (director + shareholder) in same group
  validates :contact_id, uniqueness: { scope: [ :company_group_id, :membership_type ], message: "already has this membership type in this company group" }
  validates :membership_type, inclusion: { in: MEMBERSHIP_TYPES, allow_blank: true }

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :with_type, ->(type) { where(membership_type: type) }
  scope :directors, -> { with_type("director") }
  scope :secretaries, -> { with_type("secretary") }
  scope :corporate_officers, -> { with_type("corporate_officer") }
  scope :shareholders, -> { with_type("shareholder") }
  scope :beneficiaries, -> { with_type("beneficiary") }
  scope :trustees, -> { with_type("trustee") }
  scope :appointors, -> { with_type("appointor") }
  scope :members, -> { with_type("member") }
  scope :company_entities, -> { with_type("company_entity") }
  scope :trust_entities, -> { with_type("trust_entity") }
  scope :people, -> { joins(:contact).where(contact: { entity_type: "person" }) }

  # Permission scopes
  scope :can_view_confidential, -> { where(can_view_confidential: true) }
  scope :can_edit, -> { where(can_edit: true) }

  # Instance methods
  def person_membership?
    !%w[company_entity trust_entity].include?(membership_type)
  end

  def entity_membership?
    %w[company_entity trust_entity].include?(membership_type)
  end
end
