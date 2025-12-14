class ContactRelationship < ApplicationRecord
  belongs_to :source_contact, class_name: "Contact"
  belongs_to :related_contact, class_name: "Contact"

  # Relationship type options with metadata
  # source_types: what entity types can BE this relationship
  # target_types: what entity types can be the TARGET of this relationship
  # category: grouping for UI display
  # bidirectional: if true, automatically creates reverse relationship (A→B also creates B→A)
  RELATIONSHIP_TYPE_METADATA = {
    # Employment - Person works for Company/Trust
    "employee_of" => {
      label: "Employee",
      category: "employment",
      source_types: %w[person],
      target_types: %w[company trust sole_trader],
      description: "Works as an employee",
      bidirectional: false  # Directional: person → company only
    },
    "contractor_for" => {
      label: "Contractor",
      category: "employment",
      source_types: %w[person sole_trader company],
      target_types: %w[company trust sole_trader],
      description: "Works as a contractor",
      bidirectional: false  # Directional: contractor → company only
    },

    # Company/Trust roles - Person has role in Company/Trust
    # NOTE: director_of and shareholder_of removed - now managed via Corporate tables only
    # See: corporate_company_directors and corporate_company_shareholdings tables
    "authorized_signatory_of" => {
      label: "Authorized Signatory",
      category: "company_role",
      source_types: %w[person],
      target_types: %w[company trust],
      description: "Authorized to sign on behalf of",
      bidirectional: false  # Directional: person → company only
    },
    "beneficial_owner_of" => {
      label: "Beneficial Owner",
      category: "company_role",
      source_types: %w[person company trust],
      target_types: %w[company trust],
      description: "Ultimate beneficial owner",
      bidirectional: false  # Directional: owner → entity only
    },
    "partner_in" => {
      label: "Partner",
      category: "company_role",
      source_types: %w[person company],
      target_types: %w[company],
      description: "Partner in the business",
      bidirectional: false  # Directional: person → company only
    },

    # Trust roles
    "trustee_of" => {
      label: "Trustee",
      category: "trust_role",
      source_types: %w[person company], # Corporate trustees are common
      target_types: %w[trust],
      description: "Trustee of the trust",
      bidirectional: false  # Directional: trustee → trust only
    },
    "beneficiary_of" => {
      label: "Beneficiary",
      category: "trust_role",
      source_types: %w[person company trust], # Trusts can be beneficiaries
      target_types: %w[trust],
      description: "Beneficiary of the trust",
      bidirectional: false  # Directional: beneficiary → trust only
    },
    "appointor_of" => {
      label: "Appointor",
      category: "trust_role",
      source_types: %w[person company],
      target_types: %w[trust],
      description: "Appointor of the trust",
      bidirectional: false  # Directional: appointor → trust only
    },

    # Ownership
    "owner_of" => {
      label: "Owner",
      category: "ownership",
      source_types: %w[person company trust],
      target_types: %w[company trust sole_trader],
      description: "Owner of the entity",
      bidirectional: false  # Directional: owner → entity only
    },
    "co_owner_with" => {
      label: "Co-Owner",
      category: "ownership",
      source_types: %w[person company trust],
      target_types: %w[person company trust],
      description: "Co-owner with another entity",
      bidirectional: true  # Bidirectional: A co-owns with B, B co-owns with A
    },

    # Corporate hierarchy
    "parent_company" => {
      label: "Parent Company",
      category: "corporate_structure",
      source_types: %w[company trust],
      target_types: %w[company trust],
      description: "Parent company of",
      bidirectional: false  # Directional: parent → subsidiary only
    },
    "subsidiary" => {
      label: "Subsidiary",
      category: "corporate_structure",
      source_types: %w[company trust],
      target_types: %w[company trust],
      description: "Subsidiary of",
      bidirectional: false  # Directional: subsidiary → parent only
    },

    # General relationships
    "previous_client" => {
      label: "Previous Client",
      category: "general",
      source_types: %w[person company trust sole_trader],
      target_types: %w[person company trust sole_trader],
      description: "Former client relationship",
      bidirectional: false  # Directional: client → service provider
    },
    "referral" => {
      label: "Referral",
      category: "general",
      source_types: %w[person company trust sole_trader],
      target_types: %w[person company trust sole_trader],
      description: "Referred by or referred to",
      bidirectional: true  # Bidirectional: mutual referral relationship
    },
    "supplier_alternate" => {
      label: "Alternative Supplier",
      category: "general",
      source_types: %w[company sole_trader],
      target_types: %w[company sole_trader],
      description: "Alternative supplier for same products",
      bidirectional: true  # Bidirectional: alternatives to each other
    },
    "related_project" => {
      label: "Related Project",
      category: "general",
      source_types: %w[person company trust sole_trader],
      target_types: %w[person company trust sole_trader],
      description: "Related through a project",
      bidirectional: true  # Bidirectional: related to each other
    },
    "family_member" => {
      label: "Family Member",
      category: "personal",
      source_types: %w[person],
      target_types: %w[person],
      description: "Family relationship",
      bidirectional: true  # Bidirectional: family relationship is mutual
    },
    "other" => {
      label: "Other",
      category: "general",
      source_types: %w[person company trust sole_trader],
      target_types: %w[person company trust sole_trader],
      description: "Other relationship type",
      bidirectional: false  # Default to directional for safety
    }
  }.freeze

  # Simple list for validation (backwards compatible)
  RELATIONSHIP_TYPES = RELATIONSHIP_TYPE_METADATA.keys.freeze

  # Helper method to get valid relationship types for a source → target combination
  # If target_entity_type is nil, returns all types where source matches
  def self.valid_types_for(source_entity_type:, target_entity_type: nil)
    RELATIONSHIP_TYPE_METADATA.select do |_type, meta|
      source_match = source_entity_type.nil? || meta[:source_types].include?(source_entity_type)
      target_match = target_entity_type.nil? || meta[:target_types].include?(target_entity_type)
      source_match && target_match
    end.keys
  end

  # Helper method to get relationship types by category
  def self.types_by_category
    RELATIONSHIP_TYPE_METADATA.group_by { |_type, meta| meta[:category] }
      .transform_values { |pairs| pairs.map(&:first) }
  end

  # Check if a relationship type is bidirectional (auto-creates reverse)
  def self.bidirectional?(relationship_type)
    RELATIONSHIP_TYPE_METADATA.dig(relationship_type, :bidirectional) == true
  end

  # Instance method wrapper
  def bidirectional?
    self.class.bidirectional?(relationship_type)
  end

  # Get metadata as array for API responses
  def self.relationship_types_with_metadata
    RELATIONSHIP_TYPE_METADATA.map do |type, meta|
      {
        value: type,
        label: meta[:label],
        category: meta[:category],
        source_types: meta[:source_types],
        target_types: meta[:target_types],
        description: meta[:description],
        syncs_to_corporate: meta[:syncs_to_corporate] || false
      }
    end
  end

  # Validations
  validates :relationship_type, presence: true, inclusion: { in: RELATIONSHIP_TYPES }
  validates :source_contact_id, presence: true
  validates :related_contact_id, presence: true
  validate :cannot_relate_to_self
  validate :unique_relationship_pair
  validate :validate_entity_types_for_relationship
  validates :ownership_percentage, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true

  # Scopes
  scope :active, -> { where(is_active: true) }
  scope :inactive, -> { where(is_active: false) }
  scope :by_type, ->(type) { where(relationship_type: type) }
  scope :employment, -> { where(relationship_type: [ "employee_of", "contractor_for" ]) }
  scope :company_roles, -> { where(relationship_type: [ "authorized_signatory_of", "beneficial_owner_of" ]) }
  scope :trust_roles, -> { where(relationship_type: [ "trustee_of", "beneficiary_of", "appointor_of" ]) }
  scope :ownership, -> { where(relationship_type: [ "owner_of", "co_owner_with" ]) }

  # Callbacks for bidirectional sync
  after_create :create_reverse_relationship
  after_update :update_reverse_relationship
  after_destroy :destroy_reverse_relationship

  # Callback to sync primary_company_id when employee_of relationships change
  after_commit :sync_primary_company_id, if: :should_sync_primary_company?

  # SSoT: Update employees_count counter_cache on company when employee_of relationships change
  after_commit :update_company_employees_count, if: :employee_of_relationship?

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

  def validate_entity_types_for_relationship
    return if relationship_type.blank? || source_contact.blank? || related_contact.blank?

    metadata = RELATIONSHIP_TYPE_METADATA[relationship_type]
    return unless metadata # Skip for unknown relationship types

    source_types = metadata[:source_types]
    target_types = metadata[:target_types]

    # Validate source entity type
    if source_types.present? && !source_types.include?(source_contact.entity_type)
      errors.add(:source_contact, "must be #{source_types.join(' or ')} for #{relationship_type} relationship")
    end

    # Validate target entity type
    if target_types.present? && !target_types.include?(related_contact.entity_type)
      errors.add(:related_contact, "must be #{target_types.join(' or ')} for #{relationship_type} relationship (got #{related_contact.entity_type})")
    end
  end

  def create_reverse_relationship
    # Only create reverse for bidirectional relationship types
    return unless bidirectional?
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
    # Only update reverse for bidirectional relationship types
    return unless bidirectional?
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
    # Only destroy reverse for bidirectional relationship types
    return unless bidirectional?
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

  # Guard method for employees_count update
  def employee_of_relationship?
    relationship_type == "employee_of"
  end

  # SSoT: Update employees_count on company when employee_of relationships change
  # This keeps the counter_cache in sync with ContactRelationship data
  def update_company_employees_count
    company = related_contact
    return unless company&.persisted?
    return unless company.entity_type.in?(%w[company trust sole_trader])

    # Recount from SSoT (active employee_of relationships pointing to this company)
    count = ContactRelationship.where(
      related_contact_id: company.id,
      relationship_type: "employee_of",
      is_active: true
    ).count

    # Use update_column to skip callbacks and avoid infinite loops
    company.update_column(:employees_count, count)
  rescue StandardError => e
    Rails.logger.error("ContactRelationship##{id}: Failed to update employees_count - #{e.message}")
  end

  # Sync primary_company_id field when employee_of relationships change
  # This keeps the legacy primary_company_id field in sync with ContactRelationship data
  # SSoT: ContactRelationship (employee_of) → Contact.primary_company_id
  def sync_primary_company_id
    # Prevent infinite loop with Contact#sync_primary_company_to_relationship
    return if Thread.current[:syncing_primary_company_relationship]

    person = source_contact
    return unless person

    # Find all active employee_of relationships for this person
    active_relationships = person.outgoing_relationships
      .active
      .where(relationship_type: "employee_of")

    # Set primary_company_id to first active relationship (or nil if none)
    new_primary_company_id = active_relationships.first&.related_contact_id

    # Only update if changed (avoid unnecessary writes)
    # Use update_column to skip callbacks and avoid infinite loops
    if person.primary_company_id != new_primary_company_id
      person.update_column(:primary_company_id, new_primary_company_id)
    end
  end

  # Guard method to determine if we should sync to corporate tables
  # NOTE: sync_to_corporate_tables methods removed
  # Directors and shareholders are now managed ONLY via Corporate tables
  # See: corporate_company_directors and corporate_company_shareholdings
end
