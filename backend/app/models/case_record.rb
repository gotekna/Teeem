# Case model for investigations
# Note: Named CaseRecord to avoid conflict with Ruby's case keyword
# Table name is still 'cases'
class CaseRecord < ApplicationRecord
  self.table_name = "cases"

  # ============================================
  # ASSOCIATIONS
  # ============================================

  # Primary entity being investigated (optional)
  belongs_to :contact, optional: true
  belongs_to :corporate_company, foreign_key: "company_id", optional: true
  belongs_to :corporate_group, foreign_key: "company_group_id", optional: true

  # Case management
  belongs_to :assigned_to, class_name: "User", optional: true
  belongs_to :created_by, class_name: "User", optional: true

  # Parent/child case hierarchy (self-referential)
  belongs_to :parent_case, class_name: "CaseRecord", optional: true, foreign_key: :parent_case_id
  has_many :child_cases, class_name: "CaseRecord", foreign_key: :parent_case_id, dependent: :nullify

  # Related entities (many-to-many)
  has_many :case_contacts, foreign_key: :case_id, dependent: :destroy
  has_many :contacts, through: :case_contacts
  has_many :case_companies, foreign_key: :case_id, dependent: :destroy
  has_many :corporate_companies, through: :case_companies
  has_many :case_jobs, foreign_key: :case_id, dependent: :destroy
  has_many :jobs, through: :case_jobs

  # Case content
  has_many :case_actions, foreign_key: :case_id, dependent: :destroy
  has_many :case_documents, foreign_key: :case_id, dependent: :destroy
  has_many :corporate_company_documents, through: :case_documents
  has_many :case_emails, foreign_key: :case_id, dependent: :destroy
  has_many :emails, through: :case_emails, source: :email_warehouse
  has_many :case_timeline_events, foreign_key: :case_id, dependent: :destroy
  has_many :case_email_qas, foreign_key: :case_id, dependent: :destroy
  has_many :document_duplicate_reviews, foreign_key: :case_id, dependent: :destroy

  # ============================================
  # VALIDATIONS
  # ============================================

  validates :title, presence: true
  validates :case_number, presence: true, uniqueness: true
  validates :status, inclusion: { in: %w[open in_progress review closed archived] }
  validates :priority, inclusion: { in: %w[low normal high urgent] }
  validates :case_type, inclusion: {
    in: %w[ato_audit legal_dispute director_investigation compliance_review due_diligence fraud_investigation insolvency bankruptcy other],
    allow_blank: true
  }
  validates :risk_score, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true

  # ============================================
  # CALLBACKS
  # ============================================

  before_validation :generate_case_number, on: :create
  before_save :set_hierarchy_level

  # ============================================
  # SCOPES
  # ============================================

  scope :open_cases, -> { where(status: %w[open in_progress review]) }
  scope :closed_cases, -> { where(status: %w[closed archived]) }
  scope :by_status, ->(status) { where(status: status) }
  scope :by_type, ->(type) { where(case_type: type) }
  scope :by_priority, ->(priority) { where(priority: priority) }
  scope :overdue, -> { where("deadline < ?", Date.current).open_cases }
  scope :due_soon, -> { where(deadline: Date.current..7.days.from_now).open_cases }
  scope :assigned_to_user, ->(user_id) { where(assigned_to_id: user_id) }
  scope :recent_first, -> { order(created_at: :desc) }

  # Hierarchy scopes
  scope :root_cases, -> { where(parent_case_id: nil) }
  scope :child_cases_of, ->(parent_id) { where(parent_case_id: parent_id) }
  scope :with_children, -> { where(id: CaseRecord.select(:parent_case_id).distinct) }

  # ============================================
  # CONSTANTS
  # ============================================

  CASE_TYPES = {
    "ato_audit" => "ATO Audit",
    "legal_dispute" => "Legal Dispute",
    "director_investigation" => "Director Investigation",
    "compliance_review" => "Compliance Review",
    "due_diligence" => "Due Diligence",
    "fraud_investigation" => "Fraud Investigation",
    "insolvency" => "Insolvency",
    "bankruptcy" => "Bankruptcy",
    "other" => "Other"
  }.freeze

  STATUSES = {
    "open" => "Open",
    "in_progress" => "In Progress",
    "review" => "Under Review",
    "closed" => "Closed",
    "archived" => "Archived"
  }.freeze

  PRIORITIES = {
    "low" => "Low",
    "normal" => "Normal",
    "high" => "High",
    "urgent" => "Urgent"
  }.freeze

  # ============================================
  # WAREHOUSE INTEGRATION
  # ============================================

  # Get all related job IDs for warehouse queries
  def related_job_ids
    job_ids = jobs.pluck(:id)
    job_ids += contact.jobs.pluck(:id) if contact
    job_ids += corporate_companies.flat_map { |c| c.jobs.pluck(:id) }
    job_ids.uniq
  end

  # Get all related company IDs for warehouse queries
  def related_company_ids
    company_ids = corporate_companies.pluck(:id)
    company_ids << company_id if company_id
    company_ids += corporate_group.corporate_companies.pluck(:id) if corporate_group
    company_ids.uniq
  end

  # Get all related contact IDs
  def related_contact_ids
    contact_ids = contacts.pluck(:id)
    contact_ids << contact_id if contact_id
    contact_ids.uniq
  end

  # Get all related contact emails for email search
  def related_emails
    Contact.where(id: related_contact_ids).pluck(:email).compact
  end

  # Warehouse service for running queries
  def warehouse_service
    @warehouse_service ||= CaseWarehouseService.new(self)
  end

  # Quick access to warehouse data
  def job_metrics
    warehouse_service.job_metrics_for_entities
  end

  def search_emails(query, date_range: nil)
    warehouse_service.search_emails(query: query, date_range: date_range)
  end

  def invoice_reconciliation_issues
    warehouse_service.financial_anomalies
  end

  # ============================================
  # INSTANCE METHODS
  # ============================================

  def formatted_case_type
    CASE_TYPES[case_type] || case_type&.titleize
  end

  def formatted_status
    STATUSES[status] || status&.titleize
  end

  def formatted_priority
    PRIORITIES[priority] || priority&.titleize
  end

  def overdue?
    deadline.present? && deadline < Date.current && !%w[closed archived].include?(status)
  end

  def days_until_deadline
    return nil unless deadline
    (deadline - Date.current).to_i
  end

  def primary_entity
    contact || corporate_company || corporate_group
  end

  def primary_entity_name
    primary_entity&.respond_to?(:display_name) ? primary_entity.display_name : primary_entity&.name
  end

  # Investigation date range
  def investigation_range
    return nil unless investigation_start_date && investigation_end_date
    investigation_start_date..investigation_end_date
  end

  # Add a document to the case
  def add_document(company_document, relevance: "supporting", notes: nil, added_by: nil)
    case_documents.find_or_create_by(company_document: company_document) do |cd|
      cd.relevance = relevance
      cd.notes = notes
      cd.added_by = added_by
      cd.sequence = case_documents.maximum(:sequence).to_i + 1
    end
  end

  # Add an email to the case
  def add_email(email_warehouse, relevance: "supporting", notes: nil, added_by: nil)
    case_emails.find_or_create_by(email_warehouse: email_warehouse) do |ce|
      ce.relevance = relevance
      ce.notes = notes
      ce.added_by = added_by
      ce.sequence = case_emails.maximum(:sequence).to_i + 1
    end
  end

  # Add a contact to the case
  def add_contact(contact, role: "related_party", notes: nil, is_primary: false, reason: nil, added_by: nil)
    case_contacts.find_or_create_by(contact: contact) do |cc|
      cc.role = role
      cc.notes = notes
      cc.is_primary = is_primary
      cc.reason = reason
      cc.added_by = added_by
    end
  end

  # Remove a contact from the case and delete all case_emails involving this contact
  def remove_contact(contact)
    # First, find all case_emails that involve this contact's email
    if contact.email.present?
      case_emails.joins(:email_warehouse)
                 .where(
                   "email_warehouse.from_email = ? OR
                    ? = ANY(email_warehouse.to_emails) OR
                    ? = ANY(email_warehouse.cc_emails) OR
                    ? = ANY(email_warehouse.bcc_emails)",
                   contact.email, contact.email, contact.email, contact.email
                 ).destroy_all
    end

    # Then remove the case_contact relationship
    case_contacts.find_by(contact: contact)&.destroy
  end

  # Add a company to the case
  def add_company(company, role: "related_entity", notes: nil, is_primary: false)
    case_companies.find_or_create_by(company: company) do |cc|
      cc.role = role
      cc.notes = notes
      cc.is_primary = is_primary
    end
  end

  # Add a job to the case
  def add_job(job, relevance: "direct", notes: nil)
    case_jobs.find_or_create_by(job: job) do |cj|
      cj.relevance = relevance
      cj.notes = notes
    end
  end

  # Run an action and save results
  def run_action(action_type:, query: nil, parameters: {}, created_by: nil)
    action = case_actions.create!(
      action_type: action_type,
      query: query,
      parameters: parameters,
      created_by: created_by,
      status: "pending"
    )

    # Execute the action (async in production)
    CaseActionExecutorJob.perform_later(action.id)

    action
  end

  # ============================================
  # HIERARCHY METHODS
  # ============================================

  def root_case?
    parent_case_id.nil?
  end

  def has_children?
    child_cases.exists?
  end

  def child_case?
    parent_case_id.present?
  end

  # Get the root case (top of hierarchy)
  def root_case
    return self if root_case?
    parent_case.root_case
  end

  # Get all ancestors (parent, grandparent, etc.)
  def ancestors
    return [] if root_case?
    [ parent_case ] + parent_case.ancestors
  end

  # Get all descendants (children, grandchildren, etc.)
  def descendants
    child_cases.flat_map { |child| [ child ] + child.descendants }
  end

  # Get sibling cases (same parent)
  def siblings
    return CaseRecord.root_cases.where.not(id: id) if root_case?
    parent_case.child_cases.where.not(id: id)
  end

  # Get all cases in the same family tree
  def family_tree
    root = root_case
    [ root ] + root.descendants
  end

  # Count of open child cases
  def open_child_cases_count
    child_cases.open_cases.count
  end

  # Summary stats for child cases
  def child_cases_summary
    {
      total: child_cases.count,
      open: child_cases.open_cases.count,
      closed: child_cases.closed_cases.count,
      overdue: child_cases.overdue.count
    }
  end

  # Create a sub-case inheriting relevant attributes
  def create_child_case(attributes = {})
    child_cases.create!(
      {
        contact_id: contact_id,
        company_id: company_id,
        company_group_id: company_group_id,
        case_type: case_type,
        priority: priority,
        assigned_to_id: assigned_to_id,
        investigation_start_date: investigation_start_date,
        investigation_end_date: investigation_end_date
      }.merge(attributes)
    )
  end

  private

  def generate_case_number
    return if case_number.present?

    if parent_case_id.present?
      # Sub-case: generate hierarchical number (e.g., CASE-20251205-002.001)
      parent = parent_case
      return unless parent&.case_number.present?

      # Count existing children to determine next child sequence
      child_count = parent.child_cases.where.not(id: id).count + 1
      self.case_number = "#{parent.case_number}.#{child_count.to_s.rjust(3, '0')}"
    else
      # Top-level case: generate sequential number (e.g., CASE-20251205-001)
      date_part = Date.current.strftime("%Y%m%d")

      # Count only top-level cases (those without a parent) for the sequence
      sequence = CaseRecord.where(parent_case_id: nil)
                          .where("case_number LIKE ?", "CASE-#{date_part}-%")
                          .count + 1
      self.case_number = "CASE-#{date_part}-#{sequence.to_s.rjust(3, '0')}"
    end
  end

  def set_hierarchy_level
    self.hierarchy_level = parent_case ? parent_case.hierarchy_level + 1 : 0
  end
end
