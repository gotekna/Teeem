class ContactRelationship < ApplicationRecord
  belongs_to :source_contact, class_name: "Contact"
  belongs_to :related_contact, class_name: "Contact"

  # Relationship type options with metadata
  # source_types: what entity types can BE this relationship
  # target_types: what entity types can be the TARGET of this relationship
  # category: grouping for UI display
  RELATIONSHIP_TYPE_METADATA = {
    # Employment - Person works for Company/Trust
    "employee_of" => {
      label: "Employee",
      category: "employment",
      source_types: %w[person],
      target_types: %w[company trust sole_trader],
      description: "Works as an employee"
    },
    "contractor_for" => {
      label: "Contractor",
      category: "employment",
      source_types: %w[person sole_trader company],
      target_types: %w[company trust sole_trader],
      description: "Works as a contractor"
    },

    # Company/Trust roles - Person has role in Company/Trust
    "director_of" => {
      label: "Director",
      category: "company_role",
      source_types: %w[person company], # Companies can be corporate directors
      target_types: %w[company],
      description: "Director of the company",
      syncs_to_corporate: true
    },
    "shareholder_of" => {
      label: "Shareholder",
      category: "company_role",
      source_types: %w[person company trust], # Companies/Trusts can own shares
      target_types: %w[company],
      description: "Holds shares in the company",
      syncs_to_corporate: true
    },
    "authorized_signatory_of" => {
      label: "Authorized Signatory",
      category: "company_role",
      source_types: %w[person],
      target_types: %w[company trust],
      description: "Authorized to sign on behalf of"
    },
    "beneficial_owner_of" => {
      label: "Beneficial Owner",
      category: "company_role",
      source_types: %w[person company trust],
      target_types: %w[company trust],
      description: "Ultimate beneficial owner"
    },
    "partner_in" => {
      label: "Partner",
      category: "company_role",
      source_types: %w[person company],
      target_types: %w[company],
      description: "Partner in the business"
    },

    # Trust roles
    "trustee_of" => {
      label: "Trustee",
      category: "trust_role",
      source_types: %w[person company], # Corporate trustees are common
      target_types: %w[trust],
      description: "Trustee of the trust"
    },
    "beneficiary_of" => {
      label: "Beneficiary",
      category: "trust_role",
      source_types: %w[person company trust], # Trusts can be beneficiaries
      target_types: %w[trust],
      description: "Beneficiary of the trust"
    },
    "appointor_of" => {
      label: "Appointor",
      category: "trust_role",
      source_types: %w[person company],
      target_types: %w[trust],
      description: "Appointor of the trust"
    },

    # Ownership
    "owner_of" => {
      label: "Owner",
      category: "ownership",
      source_types: %w[person company trust],
      target_types: %w[company trust sole_trader],
      description: "Owner of the entity"
    },
    "co_owner_with" => {
      label: "Co-Owner",
      category: "ownership",
      source_types: %w[person company trust],
      target_types: %w[person company trust],
      description: "Co-owner with another entity"
    },

    # Corporate hierarchy
    "parent_company" => {
      label: "Parent Company",
      category: "corporate_structure",
      source_types: %w[company trust],
      target_types: %w[company trust],
      description: "Parent company of"
    },
    "subsidiary" => {
      label: "Subsidiary",
      category: "corporate_structure",
      source_types: %w[company trust],
      target_types: %w[company trust],
      description: "Subsidiary of"
    },

    # General relationships
    "previous_client" => {
      label: "Previous Client",
      category: "general",
      source_types: %w[person company trust sole_trader],
      target_types: %w[person company trust sole_trader],
      description: "Former client relationship"
    },
    "referral" => {
      label: "Referral",
      category: "general",
      source_types: %w[person company trust sole_trader],
      target_types: %w[person company trust sole_trader],
      description: "Referred by or referred to"
    },
    "supplier_alternate" => {
      label: "Alternative Supplier",
      category: "general",
      source_types: %w[company sole_trader],
      target_types: %w[company sole_trader],
      description: "Alternative supplier for same products"
    },
    "related_project" => {
      label: "Related Project",
      category: "general",
      source_types: %w[person company trust sole_trader],
      target_types: %w[person company trust sole_trader],
      description: "Related through a project"
    },
    "family_member" => {
      label: "Family Member",
      category: "personal",
      source_types: %w[person],
      target_types: %w[person],
      description: "Family relationship"
    },
    "other" => {
      label: "Other",
      category: "general",
      source_types: %w[person company trust sole_trader],
      target_types: %w[person company trust sole_trader],
      description: "Other relationship type"
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

  # SSoT: Sync director_of/shareholder_of to Corporate tables
  after_commit :sync_to_corporate_tables, if: :should_sync_to_corporate?

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
  def should_sync_to_corporate?
    %w[director_of shareholder_of].include?(relationship_type)
  end

  # SSoT: Sync director_of/shareholder_of relationships to Corporate tables
  # This ensures CompanyDirector/CompanyShareholding stay in sync with Overview tab changes
  def sync_to_corporate_tables
    # Prevent infinite loops
    return if Thread.current[:syncing_director_relationship]
    return if Thread.current[:syncing_shareholder_relationship]

    # Find the Company record linked to the related Contact (company contact)
    company = Company.find_by(contact_id: related_contact_id)
    return unless company # Skip if no linked Company record

    case relationship_type
    when "director_of"
      sync_director_to_corporate(company)
    when "shareholder_of"
      sync_shareholder_to_corporate(company)
    end
  end

  def sync_director_to_corporate(company)
    Thread.current[:syncing_director_relationship] = true

    if is_active
      # Create or activate director record
      director = CompanyDirector.find_or_initialize_by(
        contact_id: source_contact_id,
        company_id: company.id
      )
      director.position ||= "director"
      director.appointment_date ||= start_date || Date.today
      director.is_current = true
      director.resignation_date = nil
      director.save!
    else
      # Deactivate the director record
      director = CompanyDirector.find_by(contact_id: source_contact_id, company_id: company.id)
      director&.update!(is_current: false, resignation_date: end_date || Date.today)
    end
  rescue StandardError => e
    Rails.logger.error("ContactRelationship##{id}: SSoT director sync failed - #{e.message}")
  ensure
    Thread.current[:syncing_director_relationship] = false
  end

  def sync_shareholder_to_corporate(company)
    Thread.current[:syncing_shareholder_relationship] = true

    if is_active
      # Create or update shareholding record
      shareholding = CompanyShareholding.find_or_initialize_by(
        shareholder_id: source_contact_id,
        shareholder_type: "Contact",
        company_id: company.id,
        share_class: "ordinary"
      )
      shareholding.number_of_shares ||= 1 # Default to 1 share if not specified
      shareholding.acquisition_date ||= start_date || Date.today
      shareholding.disposal_date = nil
      shareholding.save!
    else
      # Set disposal date on shareholding
      shareholding = CompanyShareholding.find_by(
        shareholder_id: source_contact_id,
        shareholder_type: "Contact",
        company_id: company.id
      )
      shareholding&.update!(disposal_date: end_date || Date.today)
    end
  rescue StandardError => e
    Rails.logger.error("ContactRelationship##{id}: SSoT shareholder sync failed - #{e.message}")
  ensure
    Thread.current[:syncing_shareholder_relationship] = false
  end
end
