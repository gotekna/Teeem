class CorporateShareholding < ApplicationRecord
  acts_as_tenant :tenant  # Multi-tenancy: Auto-scope queries to current tenant

  # Explicit table name since we renamed from corporate_company_shareholdings
  self.table_name = "corporate_shareholdings"

  # Associations
  belongs_to :tenant
  belongs_to :corporate, foreign_key: "company_id"
  belongs_to :shareholder, polymorphic: true

  # Alias company to corporate for backwards compatibility
  alias_method :company, :corporate

  # Validations
  validates :number_of_shares, presence: true, numericality: { greater_than: 0 }
  validates :share_class, presence: true
  validates :shareholder_id, uniqueness: { scope: [ :company_id, :shareholder_type, :share_class ], message: "already holds this class of shares" }

  # Scopes
  scope :ordinary, -> { where(share_class: "ordinary") }
  scope :preference, -> { where(share_class: "preference") }
  scope :beneficially_held, -> { where(beneficially_held: true) }

  # Callbacks
  after_create :ensure_ssot_shareholder_membership
  after_commit :sync_to_contact_relationship

  # Calculate percentage of total shares
  def percentage_of_total
    return 0 unless corporate.shares_on_issue.to_i > 0
    (number_of_shares.to_f / corporate.shares_on_issue * 100).round(2)
  end

  def shareholder_name
    case shareholder
    when Contact
      shareholder.display_name || shareholder.first_name
    when Corporate
      shareholder.name
    else
      "Unknown"
    end
  end

  private

  # SSoT: Automatically create ContactCompanyGroupMembership for shareholders
  def ensure_ssot_shareholder_membership
    return unless corporate&.company_group_id.present?
    return unless shareholder_type == "Contact" && shareholder_id.present?

    ContactCompanyGroupMembership.find_or_create_by!(
      contact_id: shareholder_id,
      company_group_id: corporate.company_group_id,
      membership_type: "shareholder"
    ) do |m|
      m.is_active = true
    end

    # Also set company_group_id and link_to_cg on the Contact (for person contacts)
    shareholder_contact = Contact.find_by(id: shareholder_id)
    shareholder_contact&.update_columns(company_group_id: corporate.company_group_id, link_to_cg: true) if shareholder_contact&.company_group_id.nil?
  rescue StandardError => e
    Rails.logger.error("CorporateShareholding##{id}: SSoT shareholder membership creation failed - #{e.message}")
  end

  # SSoT: Sync shareholder status to ContactRelationship table
  # This ensures shareholder_of relationships in Overview tab stay in sync with Corporate tab
  def sync_to_contact_relationship
    # Prevent infinite loop when ContactRelationship triggers this callback
    return if Thread.current[:syncing_shareholder_relationship]

    # Only sync if shareholder is a Contact (not a Corporate)
    return unless shareholder_type == "Contact"

    # Company must be linked to a Contact for this to work
    return unless corporate&.contact_id.present?
    return unless shareholder_id.present?

    # Skip self-referential relationships (e.g., company owns its own shares / treasury)
    # ContactRelationship doesn't allow source == related
    return if shareholder_id == corporate.contact_id

    Thread.current[:syncing_shareholder_relationship] = true

    # Shareholding is active if there's no disposal date
    is_active = disposal_date.nil?

    if is_active
      # Create or update the relationship
      rel = ContactRelationship.find_or_initialize_by(
        source_contact_id: shareholder_id,
        related_contact_id: corporate.contact_id,
        relationship_type: "shareholder_of"
      )
      rel.is_active = true
      rel.start_date ||= acquisition_date
      rel.ownership_percentage = percentage_of_total
      rel.save!
    else
      # Deactivate the relationship
      rel = ContactRelationship.find_by(
        source_contact_id: shareholder_id,
        related_contact_id: corporate.contact_id,
        relationship_type: "shareholder_of"
      )
      if rel
        rel.update!(is_active: false, end_date: disposal_date)
      end
    end
  rescue StandardError => e
    Rails.logger.error("CorporateShareholding##{id}: SSoT contact relationship sync failed - #{e.message}")
  ensure
    Thread.current[:syncing_shareholder_relationship] = false
  end
end
