class CorporateDirector < ApplicationRecord
  acts_as_tenant :tenant  # Multi-tenancy: Auto-scope queries to current tenant

  # Explicit table name since we renamed from corporate_company_directors
  self.table_name = "corporate_directors"

  # Associations
  belongs_to :tenant
  belongs_to :corporate, foreign_key: "company_id"
  alias_method :company, :corporate  # Alias for convenience
  belongs_to :contact

  # Validations
  # Positions: director, secretary, public_officer, corporate_officer, chairman, and combinations
  validates :position, inclusion: { in: %w[director secretary public_officer corporate_officer director_secretary director_public_officer director_corporate_officer secretary_public_officer secretary_corporate_officer director_secretary_public_officer director_secretary_corporate_officer chairman] }, allow_blank: true
  validates :contact_id, uniqueness: { scope: :company_id, conditions: -> { where(is_current: true) },
                                       message: "is already a current director/officer of this company" }
  validate :resignation_date_after_appointment

  # Scopes
  scope :current, -> { where(is_current: true) }
  scope :historical, -> { where(is_current: false) }
  scope :directors, -> { where("position LIKE '%director%' OR position = 'chairman'") }
  scope :secretaries, -> { where("position LIKE '%secretary%'") }
  scope :corporate_officers, -> { where("position LIKE '%corporate_officer%'") }
  scope :public_officers, -> { where("position LIKE '%public_officer%'") }

  # Callbacks
  before_save :update_current_status
  after_create :create_appointment_activity
  after_create :ensure_ssot_director_membership
  after_commit :sync_to_contact_relationship
  after_update :create_resignation_activity, if: :saved_change_to_resignation_date?
  after_update :update_ssot_director_membership, if: :saved_change_to_is_current?

  # SSoT: Update contact's cached director flag when directorship changes
  after_commit :refresh_contact_director_flag, on: [:create, :destroy]
  after_commit :refresh_contact_director_flag, on: :update, if: :saved_change_to_is_current?

  # Instance methods
  def active_duration
    start_date = appointment_date || created_at.to_date
    end_date = resignation_date || Date.today
    (end_date - start_date).to_i
  end

  def formatted_position
    position.to_s.titleize.gsub("_", " / ")
  end

  private

  def update_current_status
    if resignation_date.present? && resignation_date <= Date.today
      self.is_current = false
    end
  end

  def resignation_date_after_appointment
    return unless appointment_date.present? && resignation_date.present?
    if resignation_date < appointment_date
      errors.add(:resignation_date, "cannot be before appointment date")
    end
  end

  def create_appointment_activity
    user = defined?(Current) && Current.respond_to?(:user) ? Current.user : nil
    user ||= User.first
    corporate.company_activities.create!(
      activity_type: "director_appointed",
      description: "#{contact.display_name} was appointed as #{formatted_position}",
      user: user
    )
  end

  def create_resignation_activity
    user = defined?(Current) && Current.respond_to?(:user) ? Current.user : nil
    user ||= User.first
    corporate.company_activities.create!(
      activity_type: "director_resigned",
      description: "#{contact.display_name} resigned as #{formatted_position}",
      user: user
    )
  end

  # SSoT: Automatically create ContactCorporateGroupMembership for directors
  def ensure_ssot_director_membership
    return unless company&.company_group_id.present?
    return unless contact_id.present?

    ContactCorporateGroupMembership.find_or_create_by!(
      contact_id: contact_id,
      company_group_id: company.company_group_id,
      membership_type: "director"
    ) do |m|
      m.is_active = is_current
    end

    # Also set company_group_id and link_to_cg on the Contact (for person contacts)
    contact.update_columns(company_group_id: company.company_group_id, link_to_cg: true) if contact.company_group_id.nil?
  rescue StandardError => e
    Rails.logger.error("CorporateDirector##{id}: SSoT director membership creation failed - #{e.message}")
  end

  def update_ssot_director_membership
    return unless company&.company_group_id.present?

    membership = ContactCorporateGroupMembership.find_by(
      contact_id: contact_id,
      company_group_id: company.company_group_id,
      membership_type: "director"
    )
    membership&.update!(is_active: is_current)
  rescue StandardError => e
    Rails.logger.error("CorporateDirector##{id}: SSoT director membership update failed - #{e.message}")
  end

  # SSoT: Sync director status to ContactRelationship table
  # This ensures director_of relationships in Overview tab stay in sync with Corporate tab
  def sync_to_contact_relationship
    # Prevent infinite loop when ContactRelationship triggers this callback
    return if Thread.current[:syncing_director_relationship]

    # Company must be linked to a Contact for this to work
    return unless company&.contact_id.present?
    return unless contact_id.present?

    Thread.current[:syncing_director_relationship] = true

    if is_current
      # Create or activate the relationship
      rel = ContactRelationship.find_or_initialize_by(
        source_contact_id: contact_id,
        related_contact_id: company.contact_id,
        relationship_type: "director_of"
      )
      rel.is_active = true
      rel.start_date ||= appointment_date
      rel.save!
    else
      # Deactivate the relationship
      rel = ContactRelationship.find_by(
        source_contact_id: contact_id,
        related_contact_id: company.contact_id,
        relationship_type: "director_of"
      )
      if rel
        rel.update!(is_active: false, end_date: resignation_date || Date.today)
      end
    end
  rescue StandardError => e
    Rails.logger.error("CorporateDirector##{id}: SSoT contact relationship sync failed - #{e.message}")
  ensure
    Thread.current[:syncing_director_relationship] = false
  end

  # SSoT: Refresh contact's is_director_cached flag
  def refresh_contact_director_flag
    return unless contact_id.present?
    contact&.refresh_director_flag!
  rescue StandardError => e
    Rails.logger.error("CorporateDirector##{id}: Failed to refresh contact director flag - #{e.message}")
  end
end

# Backwards compatibility alias (deprecated - use CorporateDirector directly)
CorporateCompanyDirector = CorporateDirector
