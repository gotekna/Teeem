# CaseContact - links contacts to cases with relationship visualization
class CaseContact < ApplicationRecord
  # SSoT: Alignment values - which side the contact is on
  # Used by: CaseContact, KnownParty
  ALIGNMENT_VALUES = %w[friendly neutral opposing].freeze

  ROLES = {
    "subject" => "Subject of Investigation",
    "witness" => "Witness",
    "advisor" => "Advisor",
    "opposing_party" => "Opposing Party",
    "related_party" => "Related Party"
  }.freeze

  ALIGNMENTS = {
    "friendly" => { name: "Friendly", color: "green", icon: "user-check" },
    "neutral" => { name: "Neutral", color: "gray", icon: "user" },
    "opposing" => { name: "Opposing", color: "red", icon: "user-x" }
  }.freeze

  # Relationship types for the visual chart - more granular than roles
  RELATIONSHIP_TYPES = {
    "client" => { name: "Client", color: "blue", icon: "user" },
    "accountant" => { name: "Accountant", color: "green", icon: "calculator" },
    "lawyer" => { name: "Lawyer", color: "purple", icon: "scale" },
    "previous_accountant" => { name: "Previous Accountant", color: "emerald", icon: "calculator" },
    "advisor" => { name: "Advisor", color: "teal", icon: "lightbulb" },
    "opposing_party" => { name: "Opposing Party", color: "orange", icon: "alert-triangle" },
    "witness" => { name: "Witness", color: "yellow", icon: "eye" },
    "related_party" => { name: "Related Party", color: "gray", icon: "users" },
    "ato_officer" => { name: "ATO Officer", color: "red", icon: "landmark" },
    "afsa_officer" => { name: "AFSA Officer", color: "red", icon: "landmark" },
    "inspector_general" => { name: "Inspector-General", color: "red", icon: "landmark" },
    "trustee" => { name: "Trustee (Bankruptcy)", color: "amber", icon: "briefcase" },
    "director" => { name: "Director", color: "indigo", icon: "briefcase" },
    "shareholder" => { name: "Shareholder", color: "pink", icon: "pie-chart" },
    "bank_manager" => { name: "Bank Manager", color: "cyan", icon: "building" },
    "insurer" => { name: "Insurer", color: "amber", icon: "shield" },
    "broker" => { name: "Broker", color: "lime", icon: "trending-up" },
    "creditor" => { name: "Creditor", color: "orange", icon: "building" },
    "debtor" => { name: "Debtor", color: "rose", icon: "user" }
  }.freeze

  belongs_to :case_record, foreign_key: :case_id, class_name: "CaseRecord"
  belongs_to :contact
  belongs_to :added_by, class_name: "User", optional: true

  validates :case_id, uniqueness: { scope: :contact_id }
  validates :reason, presence: true
  validates :role, inclusion: {
    in: %w[subject witness advisor opposing_party related_party],
    allow_blank: true
  }
  validates :relationship_type, inclusion: {
    in: %w[client accountant lawyer previous_accountant advisor opposing_party witness related_party ato_officer afsa_officer inspector_general trustee director shareholder bank_manager insurer broker creditor debtor],
    allow_blank: true
  }
  validates :alignment, inclusion: {
    in: ALIGNMENT_VALUES,
    allow_blank: true
  }

  scope :primary, -> { where(is_primary: true) }
  scope :by_role, ->(role) { where(role: role) }
  scope :by_relationship_type, ->(type) { where(relationship_type: type) }
  scope :by_alignment, ->(alignment) { where(alignment: alignment) }
  scope :subjects, -> { where(role: "subject") }
  scope :friendly, -> { where(alignment: "friendly") }
  scope :neutral, -> { where(alignment: "neutral") }
  scope :opposing, -> { where(alignment: "opposing") }
  scope :with_auto_include, -> { where(include_all_emails: true) }

  # Callback to trigger auto-linking when flag changes
  after_save :trigger_auto_link_emails, if: :saved_change_to_include_all_emails?

  def formatted_role
    ROLES[role] || role&.titleize
  end

  def formatted_relationship_type
    RELATIONSHIP_TYPES.dig(relationship_type, :name) || relationship_type&.titleize
  end

  def relationship_color
    RELATIONSHIP_TYPES.dig(relationship_type, :color) || "gray"
  end

  def relationship_icon
    RELATIONSHIP_TYPES.dig(relationship_type, :icon) || "user"
  end

  def formatted_alignment
    ALIGNMENTS.dig(alignment, :name) || alignment&.titleize || "Neutral"
  end

  def alignment_color
    ALIGNMENTS.dig(alignment, :color) || "gray"
  end

  def alignment_icon
    ALIGNMENTS.dig(alignment, :icon) || "user"
  end

  # For chart positioning
  def chart_position
    display_position.presence || { "x" => 0, "y" => 0 }
  end

  def update_chart_position!(x:, y:)
    update!(display_position: { "x" => x, "y" => y })
  end

  # Count emails in this case that involve this contact's email address
  def email_count
    return 0 unless contact&.email.present?

    CaseEmail.joins(:email_warehouse)
             .where(case_id: case_id)
             .where(
               "email_warehouse.from_email = ? OR
                ? = ANY(email_warehouse.to_emails) OR
                ? = ANY(email_warehouse.cc_emails) OR
                ? = ANY(email_warehouse.bcc_emails)",
               contact.email, contact.email, contact.email, contact.email
             ).count
  end

  private

  def trigger_auto_link_emails
    return unless include_all_emails?

    # Queue background job to link emails
    AutoLinkContactEmailsJob.perform_later(id)
  end
end
