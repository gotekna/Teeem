class ContactRelationship < ApplicationRecord
  belongs_to :source_contact, class_name: "Contact"
  belongs_to :related_contact, class_name: "Contact"

  # Relationship type options
  RELATIONSHIP_TYPES = [
    # Employment
    "employee_of",
    "contractor_for",

    # Company roles
    "director_of",
    "shareholder_of",
    "authorized_signatory_of",
    "beneficial_owner_of",

    # Trust roles
    "trustee_of",
    "beneficiary_of",
    "appointor_of",

    # Ownership
    "owner_of",
    "co_owner_with",

    # Business relationships
    "partner_in",
    "parent_company",
    "subsidiary",

    # Legacy/General
    "previous_client",
    "referral",
    "supplier_alternate",
    "related_project",
    "family_member",
    "other"
  ].freeze

  # Validations
  validates :relationship_type, presence: true, inclusion: { in: RELATIONSHIP_TYPES }
  validates :source_contact_id, presence: true
  validates :related_contact_id, presence: true
  validate :cannot_relate_to_self
  validate :unique_relationship_pair
  validates :ownership_percentage, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :inactive, -> { where(is_active: false) }
  scope :by_type, ->(type) { where(relationship_type: type) }
  scope :employment, -> { where(relationship_type: [ "employee_of", "contractor_for" ]) }
  scope :company_roles, -> { where(relationship_type: [ "director_of", "shareholder_of", "authorized_signatory_of", "beneficial_owner_of" ]) }
  scope :trust_roles, -> { where(relationship_type: [ "trustee_of", "beneficiary_of", "appointor_of" ]) }
  scope :ownership, -> { where(relationship_type: [ "owner_of", "co_owner_with", "shareholder_of" ]) }

  # Callbacks for bidirectional sync
  after_create :create_reverse_relationship
  after_update :update_reverse_relationship
  after_destroy :destroy_reverse_relationship

  # Callback to sync primary_company_id when employee_of relationships change
  after_commit :sync_primary_company_id, if: :should_sync_primary_company?

  # Find the reverse relationship (must match relationship_type too)
  def reverse_relationship
    ContactRelationship.find_by(
      source_contact_id: related_contact_id,
      related_contact_id: source_contact_id,
      relationship_type: relationship_type
    )
  end

  private

  def cannot_relate_to_self
    # Allow sole traders to have self-referential relationships (they are both person and business)
    return if source_contact&.entity_type == "sole_trader" && source_contact_id == related_contact_id

    if source_contact_id == related_contact_id
      errors.add(:related_contact_id, "cannot be the same as source contact")
    end
  end

  def unique_relationship_pair
    # Check if this exact relationship (same type) already exists
    # Allows multiple relationships between same contacts with different types
    # e.g., someone can be both employee_of AND director_of the same company
    existing = ContactRelationship.where(
      source_contact_id: source_contact_id,
      related_contact_id: related_contact_id,
      relationship_type: relationship_type
    ).where.not(id: id)

    if existing.exists?
      errors.add(:base, "This relationship type already exists between these contacts")
    end
  end

  def create_reverse_relationship
    # Skip if reverse already exists or if we're being called from the reverse creation
    return if reverse_relationship.present?
    return if Thread.current[:creating_reverse_relationship]

    Thread.current[:creating_reverse_relationship] = true
    ContactRelationship.create!(
      source_contact_id: related_contact_id,
      related_contact_id: source_contact_id,
      relationship_type: relationship_type,
      notes: notes,
      role_in_relationship: role_in_relationship,
      ownership_percentage: ownership_percentage,
      context: context,
      start_date: start_date,
      end_date: end_date,
      is_active: is_active,
      metadata: metadata
    )
  ensure
    Thread.current[:creating_reverse_relationship] = false
  end

  def update_reverse_relationship
    return if Thread.current[:updating_reverse_relationship]

    reverse = reverse_relationship
    return unless reverse

    Thread.current[:updating_reverse_relationship] = true
    reverse.update!(
      relationship_type: relationship_type,
      notes: notes,
      role_in_relationship: role_in_relationship,
      ownership_percentage: ownership_percentage,
      context: context,
      start_date: start_date,
      end_date: end_date,
      is_active: is_active,
      metadata: metadata
    )
  ensure
    Thread.current[:updating_reverse_relationship] = false
  end

  def destroy_reverse_relationship
    return if Thread.current[:destroying_reverse_relationship]

    reverse = reverse_relationship
    return unless reverse

    Thread.current[:destroying_reverse_relationship] = true
    reverse.destroy!
  ensure
    Thread.current[:destroying_reverse_relationship] = false
  end

  # Guard method to determine if primary_company_id should be synced
  def should_sync_primary_company?
    relationship_type == "employee_of" &&
    (source_contact&.entity_type == "person" || source_contact&.entity_type == "sole_trader")
  end

  # Sync primary_company_id field when employee_of relationships change
  # This keeps the legacy primary_company_id field in sync with ContactRelationship data
  def sync_primary_company_id
    person = source_contact
    return unless person

    # Find all active employee_of relationships for this person
    active_relationships = person.outgoing_relationships
      .active
      .where(relationship_type: "employee_of")

    # Set primary_company_id to first active relationship (or nil if none)
    new_primary_company_id = active_relationships.first&.related_contact_id

    # Only update if changed (avoid unnecessary writes)
    if person.primary_company_id != new_primary_company_id
      person.update_column(:primary_company_id, new_primary_company_id)
    end
  end
end
