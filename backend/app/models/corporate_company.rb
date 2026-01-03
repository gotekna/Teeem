class CorporateCompany < ApplicationRecord
  include SelfHealing  # Auto-fix formatting issues (ABN, ACN) and earn System kudos

  # Associations
  belongs_to :corporate_group, optional: true, foreign_key: "company_group_id"
  belongs_to :contact, optional: true  # SSoT - links Company to Contact identity store

  # Hierarchy - parent/subsidiary relationships
  belongs_to :parent_company, class_name: "CorporateCompany", optional: true
  has_many :subsidiaries, class_name: "CorporateCompany", foreign_key: "parent_company_id", dependent: :nullify

  # Consolidation - financial consolidation parent/children
  belongs_to :consolidation_parent, class_name: "CorporateCompany", optional: true
  has_many :consolidated_children, class_name: "CorporateCompany", foreign_key: "consolidation_parent_id", dependent: :nullify

  # Investments - what this company owns (as shareholder)
  has_many :investments, class_name: "CorporateCompanyShareholding", as: :shareholder, dependent: :destroy

  has_many :corporate_company_directors, foreign_key: "company_id", dependent: :destroy
  has_many :directors, through: :corporate_company_directors, source: :contact
  has_many :current_directors, -> { where(corporate_company_directors: { is_current: true }) },
           through: :corporate_company_directors, source: :contact

  has_many :bank_accounts, foreign_key: "company_id", dependent: :destroy
  has_many :active_bank_accounts, -> { where(status: "active") }, class_name: "BankAccount", foreign_key: "company_id"
  has_many :bank_transactions, foreign_key: "company_id", dependent: :destroy

  has_many :assets, foreign_key: "company_id", dependent: :destroy
  has_many :active_assets, -> { where(status: "active") }, class_name: "Asset", foreign_key: "company_id"

  has_many :corporate_company_compliance_items, foreign_key: "company_id", dependent: :destroy
  has_many :pending_compliance_items, -> { where(completed: false) }, class_name: "CorporateCompanyComplianceItem", foreign_key: "company_id"

  has_many :corporate_company_documents, foreign_key: "company_id", dependent: :destroy
  has_many :corporate_company_activities, foreign_key: "company_id", dependent: :destroy
  has_one :corporate_company_xero_connection, foreign_key: "company_id", dependent: :destroy
  has_many :corporate_company_monthly_pls, dependent: :destroy  # Cached Xero P&L data

  # SSoT Aliases - Backwards compatibility (shorter names)
  alias_method :company_activities, :corporate_company_activities
  alias_method :company_xero_connection, :corporate_company_xero_connection

  # New corporate associations
  has_many :corporate_company_shareholdings, foreign_key: "company_id", dependent: :destroy
  has_many :shareholders, through: :corporate_company_shareholdings, source: :shareholder
  has_many :share_transfers, foreign_key: "company_id", dependent: :destroy
  has_many :dividends, foreign_key: "company_id", dependent: :destroy
  has_many :corporate_company_minutes, foreign_key: "company_id", dependent: :destroy
  has_many :loans_as_lender, class_name: "CorporateCompanyLoan", foreign_key: "lender_company_id", dependent: :destroy
  has_many :loans_as_borrower, class_name: "CorporateCompanyLoan", foreign_key: "borrower_company_id", dependent: :destroy

  # Intercompany balances for consolidated financials
  has_many :intercompany_balances, foreign_key: "company_id", dependent: :destroy
  has_many :intercompany_balances_as_related, class_name: "IntercompanyBalance", foreign_key: "related_company_id", dependent: :destroy

  # Finance / Accounts Payable
  has_many :bill_inboxes, dependent: :destroy
  has_many :bill_payment_batches, dependent: :destroy
  has_many :company_approval_rules, dependent: :destroy
  has_many :ap_enabled_bank_accounts, -> { where(is_ap_enabled: true) }, class_name: "BankAccount", foreign_key: "company_id"

  # Financial reports
  has_many :profit_loss_reports, foreign_key: "company_id", dependent: :destroy
  has_many :balance_sheet_reports, foreign_key: "company_id", dependent: :destroy

  # GL System associations
  has_many :gl_bank_rule_learnings, class_name: "Gl::BankRuleLearning", dependent: :destroy
  has_many :gl_scheduled_invoices, class_name: "Gl::ScheduledInvoice", dependent: :destroy
  has_many :gl_scheduled_reports, class_name: "Gl::ScheduledReport", dependent: :destroy
  has_many :gl_period_locks, class_name: "Gl::PeriodLock", dependent: :destroy
  has_many :gl_progress_claims, class_name: "Gl::ProgressClaim", dependent: :destroy
  has_many :gl_billing_milestones, class_name: "Gl::BillingMilestone", dependent: :destroy
  has_many :gl_deposits, class_name: "Gl::Deposit", dependent: :destroy
  has_many :gl_approval_workflows, class_name: "Gl::ApprovalWorkflow", dependent: :destroy
  has_many :gl_approval_requests, class_name: "Gl::ApprovalRequest", dependent: :destroy
  has_many :gl_inventory_items, class_name: "Gl::InventoryItem", dependent: :destroy
  has_many :gl_stock_counts, class_name: "Gl::StockCount", dependent: :destroy
  has_many :gl_budget_scenarios, class_name: "Gl::BudgetScenario", dependent: :destroy
  has_many :gl_wip_reports, class_name: "Gl::WipReport", dependent: :destroy
  has_many :gl_billable_rates, class_name: "Gl::BillableRate", dependent: :destroy
  has_many :gl_billable_time_entries, class_name: "Gl::BillableTimeEntry", dependent: :destroy
  has_many :gl_time_billing_batches, class_name: "Gl::TimeBillingBatch", dependent: :destroy
  has_many :gl_quotes, class_name: "Gl::Quote", dependent: :destroy
  has_many :gl_payment_batches, class_name: "Gl::PaymentBatch", dependent: :destroy
  has_many :gl_tpar_reports, class_name: "Gl::TparReport", dependent: :destroy
  has_many :gl_lien_waivers, class_name: "Gl::LienWaiver", dependent: :destroy
  has_many :gl_change_orders, class_name: "Gl::ChangeOrder", dependent: :destroy
  has_many :gl_equipment, class_name: "Gl::Equipment", dependent: :destroy
  has_many :gl_portal_tokens, class_name: "Gl::PortalToken", dependent: :destroy
  has_many :gl_portal_sessions, class_name: "Gl::PortalSession", dependent: :destroy
  has_many :gl_customer_statements, class_name: "Gl::CustomerStatement", dependent: :destroy
  has_many :gl_direct_debit_mandates, class_name: "Gl::DirectDebitMandate", dependent: :destroy
  has_many :gl_billable_expenses, class_name: "Gl::BillableExpense", dependent: :destroy
  has_many :gl_audit_logs, class_name: "Gl::AuditLog", dependent: :destroy
  has_many :gl_audit_snapshots, class_name: "Gl::AuditSnapshot", dependent: :destroy
  has_many :gl_retainage_releases, class_name: "Gl::RetainageRelease", dependent: :destroy
  has_many :gl_custom_reports, class_name: "Gl::CustomReport", dependent: :destroy
  has_many :gl_report_dashboards, class_name: "Gl::ReportDashboard", dependent: :destroy
  has_many :gl_transaction_categories, class_name: "Gl::TransactionCategory", dependent: :destroy
  has_many :gl_categorization_predictions, class_name: "Gl::CategorizationPrediction", dependent: :destroy
  has_many :gl_anomalies, class_name: "Gl::Anomaly", dependent: :destroy
  has_many :gl_anomaly_rules, class_name: "Gl::AnomalyRule", dependent: :destroy
  has_many :gl_duplicate_groups, class_name: "Gl::DuplicateGroup", dependent: :destroy
  has_many :gl_payment_predictions, class_name: "Gl::PaymentPrediction", dependent: :destroy
  has_many :gl_customer_payment_stats, class_name: "Gl::CustomerPaymentStats", dependent: :destroy
  has_many :gl_departments, class_name: "Gl::Department", dependent: :destroy
  has_many :gl_tracking_classes, class_name: "Gl::TrackingClass", dependent: :destroy
  has_many :gl_split_transactions, class_name: "Gl::SplitTransaction", dependent: :destroy
  has_many :gl_period_snapshots, class_name: "Gl::PeriodSnapshot", dependent: :destroy
  has_many :gl_kpi_definitions, class_name: "Gl::KpiDefinition", dependent: :destroy
  has_many :gl_document_requests, class_name: "Gl::DocumentRequest", dependent: :destroy

  # Encrypted attributes
  encrypts :tfn, deterministic: true
  encrypts :encrypted_asic_password
  encrypts :encrypted_recovery_answer

  # Safe accessors for encrypted fields that may have decryption issues
  def tfn
    super
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.warn("Company##{id}: TFN decryption failed - #{e.message}")
    nil
  end

  def encrypted_asic_password
    super
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.warn("Company##{id}: ASIC password decryption failed - #{e.message}")
    nil
  end

  def encrypted_recovery_answer
    super
  rescue ActiveRecord::Encryption::Errors::Decryption => e
    Rails.logger.warn("Company##{id}: Recovery answer decryption failed - #{e.message}")
    nil
  end

  # Validations
  validates :name, presence: true
  validates :acn, uniqueness: { allow_blank: true }, format: { with: /\A\d{9}\z/, message: "must be 9 digits", allow_blank: true }
  validates :abn, uniqueness: { allow_blank: true }, format: { with: /\A\d{11}\z/, message: "must be 11 digits", allow_blank: true }
  validates :status, inclusion: { in: %w[active struck_off in_liquidation dormant] }
  # Legacy company_group validation - now using company_group_id relation
  # validates :company_group, inclusion: { in: %w[tekna team_harder promise charity other] }, allow_blank: true
  validates :gst_registration_status, inclusion: { in: %w[registered not_registered] }, allow_blank: true
  validates :accounting_method, inclusion: { in: %w[cash accrual] }, allow_blank: true
  validates :bas_frequency, inclusion: { in: %w[quarterly monthly] }, allow_blank: true
  validates :code, uniqueness: true, allow_blank: true, format: { with: /\A[A-Z0-9\-]+\z/, message: "must be uppercase letters, numbers, or hyphens", allow_blank: true }
  validates :slug, uniqueness: true, allow_blank: true

  # Scopes
  scope :active, -> { where(status: "active") }
  scope :by_group, ->(group) { where(company_group: group) }
  # SSoT: Join through to xero_credentials table for connection status
  scope :with_xero, -> { joins(corporate_company_xero_connection: :xero_credential).where(xero_credentials: { status: "connected" }) }
  scope :top_level, -> { where(parent_company_id: nil) }
  scope :with_parent, -> { where.not(parent_company_id: nil) }
  scope :trustees, -> { where(is_trustee: true) }
  scope :trusts, -> { where.not(trust_name: [ nil, "" ]) }
  scope :compliance_due_soon, -> {
    joins(:corporate_company_compliance_items)
      .where("corporate_company_compliance_items.due_date BETWEEN ? AND ?", Date.today, 90.days.from_now)
      .where(corporate_company_compliance_items: { completed: false })
      .distinct
  }

  # Callbacks
  before_validation :normalize_acn_abn
  before_validation :normalize_status
  before_validation :normalize_code
  before_validation :generate_slug
  after_create :create_initial_activity
  after_create :ensure_ssot_contact_and_membership
  after_update :create_update_activity
  after_update :update_ssot_membership, if: :saved_change_to_company_group_id?

  # SSoT: Sync ABN back to Contact (two-way sync for ABN only)
  after_commit :sync_abn_to_contact, if: :should_sync_abn_to_contact?

  # Instance methods
  def display_name
    name
  end

  def formatted_acn
    return nil unless acn.present?
    # Strip all non-digits first, then format as XXX XXX XXX
    digits = acn.gsub(/\D/, "")
    return acn if digits.length != 9
    "#{digits[0..2]} #{digits[3..5]} #{digits[6..8]}"
  end

  def formatted_abn
    return nil unless abn.present?
    # Strip all non-digits first, then format as XX XXX XXX XXX
    digits = abn.gsub(/\D/, "")
    return abn if digits.length != 11
    "#{digits[0..1]} #{digits[2..4]} #{digits[5..7]} #{digits[8..10]}"
  end

  def active?
    status == "active"
  end

  # SSoT: Use connected? which delegates to XeroConnectionHealth service
  def has_xero_connection?
    corporate_company_xero_connection.present? && corporate_company_xero_connection.connected?
  end

  # SSoT: Check if this company is a consolidation parent (has children)
  # Used to show/hide head-only Xero tabs (e.g., consolidated P&L, balance sheet)
  def has_consolidated_children?
    consolidated_children.exists?
  end

  # SharePoint folder URL for this company's root folder (SSoT: from CorporateCompanySetting)
  # Structure: [company_path] / [Group Name] / [Company Name]
  def sharepoint_folder_url
    return nil unless corporate_group.present?

    # SSoT: Use MicrosoftCredential
    credential = MicrosoftCredential.sharepoint_credential
    return nil unless credential&.metadata&.dig("site_web_url")

    base_url = credential.metadata["site_web_url"]
    group_name = corporate_group.name
    company_folder_name = "#{code.presence || name[0..2].upcase} - #{name}"

    # SSoT: Get company folder path from CorporateCompanySetting
    company_folder_path = CorporateCompanySetting.instance.sharepoint_company_path.presence || "00 TEEEM PRIVATE"

    # URL encode the path components
    encoded_path = [
      company_folder_path,
      group_name,
      company_folder_name
    ].map { |p| ERB::Util.url_encode(p) }.join("/")

    "#{base_url}/Shared%20Documents/#{encoded_path}"
  end

  # SharePoint folder URL for a specific document type/tab folder
  # Structure: [company_path] / [Group Name] / [Company Name] / [Folder Name]
  def sharepoint_folder_url_for_tab(folder_name)
    base_url = sharepoint_folder_url
    return nil unless base_url

    "#{base_url}/#{ERB::Util.url_encode(folder_name)}"
  end

  def overdue_compliance_items
    corporate_company_compliance_items.where("due_date < ? AND completed = ?", Date.today, false)
  end

  def upcoming_compliance_items(days = 30)
    corporate_company_compliance_items.where(
      "due_date BETWEEN ? AND ? AND completed = ?",
      Date.today,
      days.days.from_now,
      false
    ).order(:due_date)
  end

  def total_asset_value
    assets.where(status: "active").sum(:current_book_value) || 0
  end

  # All loans (as lender or borrower)
  def all_loans
    CorporateCompanyLoan.where("lender_company_id = ? OR borrower_company_id = ?", id, id)
  end

  # Calculate and update health score
  def calculate_health!
    issues = []
    warnings = []

    # Critical issues (major impact)
    issues << "Missing ACN" if acn.blank?
    issues << "Missing ABN" if abn.blank?
    issues << "No current directors" if corporate_company_directors.where(is_current: true).empty?
    issues << "Missing registered office address" if registered_office_address.blank?

    # Warnings (minor impact)
    warnings << "Missing TFN" if tfn.blank?
    warnings << "No bank accounts" if bank_accounts.empty?
    warnings << "No shareholders recorded" if corporate_company_shareholdings.empty?
    warnings << "Missing incorporation date" if date_incorporated.blank?
    warnings << "No secretary appointed" if corporate_company_directors.where(is_current: true, position: "secretary").empty?
    warnings << "No public officer" unless corporate_company_directors.where(is_current: true).any? { |d| d.notes&.downcase&.include?("public officer") }

    # Only check for corporate credentials if this is an actual company (has ACN)
    # Individuals and trusts don't need ASIC logins
    if acn.present?
      warnings << "Missing corporate key" if corporate_key.blank?
      warnings << "Missing ASIC credentials" if asic_username.blank?
    end

    warnings << "No review date set" if review_date.blank?
    warnings << "Missing principal place of business" if principal_place_of_business.blank?
    warnings << "No compliance items tracked" if corporate_company_compliance_items.empty?

    # Calculate score
    total_checks = 15
    passed = total_checks - issues.count - (warnings.count * 0.5)
    score = [ (passed / total_checks * 100).round, 0 ].max

    # Determine status
    status_value = if issues.any?
                     "critical"
    elsif score >= 80
                     "excellent"
    elsif score >= 60
                     "good"
    else
                     "needs_attention"
    end

    update_columns(health_score: score, health_status: status_value)
    { score: score, status: status_value, issues: issues, warnings: warnings }
  end

  # Class method to recalculate all health scores
  def self.recalculate_all_health!
    find_each(&:calculate_health!)
  end

  # Find by slug or ID (for friendly URLs)
  def self.find_by_slug_or_id(slug_or_id)
    # If it looks like a numeric ID, try finding by ID first
    if slug_or_id.to_s.match?(/\A\d+\z/)
      find_by(id: slug_or_id) || find_by(slug: slug_or_id)
    else
      find_by(slug: slug_or_id)
    end
  end

  # Class method to populate slugs for all companies without one
  def self.populate_all_slugs!
    where(slug: nil).find_each do |company|
      company.send(:generate_slug)
      company.save!
      Rails.logger.info "[CorporateCompany] Generated slug for #{company.name}: #{company.slug}"
    end
  end

  # Total owed to this company
  def total_loans_receivable
    loans_as_lender.active.sum(:current_balance) || 0
  end

  # Total owed by this company
  def total_loans_payable
    loans_as_borrower.active.sum(:current_balance) || 0
  end

  # Group name for display
  def group_name
    corporate_group&.name || company_group_legacy
  end

  # Legacy company_group field (string) - for backwards compatibility
  def company_group_legacy
    read_attribute(:company_group)
  end

  # Hierarchy methods

  # Get all ancestor companies (parent, grandparent, etc.)
  def ancestors
    result = []
    current = parent_company
    while current
      result << current
      current = current.parent_company
    end
    result
  end

  # Get all descendant companies (children, grandchildren, etc.)
  def descendants
    subsidiaries.flat_map { |s| [ s ] + s.descendants }
  end

  # Get the top-level parent (root of hierarchy)
  def root_company
    ancestors.last || self
  end

  # Check if this company is a subsidiary
  def subsidiary?
    parent_company_id.present?
  end

  # Check if this company has subsidiaries
  def has_subsidiaries?
    subsidiaries.exists?
  end

  # Build full hierarchy tree for this company
  def hierarchy_tree
    {
      id: id,
      name: name,
      code: code,
      entity_type: entity_type,
      is_trustee: is_trustee,
      trust_name: trust_name,
      ownership_percentage: ownership_percentage_from_parent,
      children: subsidiaries.includes(:subsidiaries).map(&:hierarchy_tree)
    }
  end

  # Calculate ownership percentage from parent (if 100% owned)
  def ownership_percentage_from_parent
    return nil unless parent_company_id.present?

    shareholding = company_shareholdings.find_by(
      shareholder_type: "Company",
      shareholder_id: parent_company_id
    )
    shareholding&.percentage_of_total
  end

  # Set parent company based on majority shareholding
  def set_parent_from_shareholdings!
    # Find if there's a single company shareholder with 100% ownership
    total_shares = shares_on_issue.to_i
    return if total_shares.zero?

    company_shareholdings.where(shareholder_type: "Company").each do |sh|
      percentage = (sh.number_of_shares.to_f / total_shares * 100).round(2)
      if percentage >= 100
        update!(parent_company_id: sh.shareholder_id, hierarchy_level: calculate_hierarchy_level(sh.shareholder_id))
        return
      end
    end
  end

  private

  def calculate_hierarchy_level(parent_id)
    parent = CorporateCompany.find_by(id: parent_id)
    return 0 unless parent
    parent.hierarchy_level + 1
  end

  # Normalize ACN and ABN by removing all non-numeric characters
  def normalize_acn_abn
    self.acn = acn.gsub(/[^0-9]/, "") if acn.present?
    self.abn = abn.gsub(/[^0-9]/, "") if abn.present?
  end

  # Normalize status to lowercase
  def normalize_status
    self.status = status.downcase if status.present?
  end

  # Normalize code to uppercase and remove invalid characters
  def normalize_code
    self.code = code.upcase.gsub(/[^A-Z0-9\-]/, "") if code.present?
  end

  # Generate a URL-friendly slug from the company name
  def generate_slug
    return if slug.present?
    return if name.blank?

    base_slug = name
      .downcase
      .gsub(/pty\.?\s*ltd\.?/i, "")      # Remove "Pty Ltd" variations
      .gsub(/\s+trust\s*$/i, "-trust")   # Keep "Trust" but clean format
      .gsub(/[^a-z0-9\s-]/, "")          # Remove special characters
      .gsub(/\s+/, "-")                  # Replace spaces with hyphens
      .gsub(/-+/, "-")                   # Remove consecutive hyphens
      .gsub(/^-|-$/, "")                 # Remove leading/trailing hyphens
      .truncate(50, omission: "")        # Limit length

    # Ensure uniqueness by adding a number suffix if needed
    candidate = base_slug
    counter = 1
    while CorporateCompany.where(slug: candidate).where.not(id: id).exists?
      counter += 1
      candidate = "#{base_slug}-#{counter}"
    end

    self.slug = candidate
  end

  def create_initial_activity
    user = defined?(Current) && Current.respond_to?(:user) ? Current.user : nil
    user ||= User.first

    corporate_company_activities.create!(
      activity_type: "company_created",
      description: "Company #{name} was created",
      user: user
    )
  end

  def create_update_activity
    return unless saved_changes.any?

    user = defined?(Current) && Current.respond_to?(:user) ? Current.user : nil
    user ||= User.first

    corporate_company_activities.create!(
      activity_type: "company_updated",
      description: "Company information was updated",
      user: user,
      change_details: saved_changes.except("updated_at")
    )
  end

  # SSoT: Automatically create Contact and ContactCorporateGroupMembership for new companies
  def ensure_ssot_contact_and_membership
    # 1. Create Contact for this company (SSoT identity)
    entity_type = trust_name.present? ? "trust" : "company"
    ssot_contact = Contact.find_or_create_by!(entity_type: entity_type, display_name: name) do |c|
      c.tax_number = abn
      c.company_group_id = company_group_id
      c.is_active = status == "active"
    end

    # 2. Link Company to Contact (bidirectional)
    update_column(:contact_id, ssot_contact.id) if contact_id.nil?

    # 3. Link Contact back to Company (bidirectional) and set link_to_cg flag
    ssot_contact.update_columns(linked_company_id: id, link_to_cg: true) if ssot_contact.linked_company_id.nil?

    # 4. Create membership if in a group
    create_ssot_membership(ssot_contact) if company_group_id.present?
  rescue StandardError => e
    Rails.logger.error("Company##{id}: SSoT contact/membership creation failed - #{e.message}")
  end

  def update_ssot_membership
    return unless contact_id.present?
    create_ssot_membership(contact)
  rescue StandardError => e
    Rails.logger.error("Company##{id}: SSoT membership update failed - #{e.message}")
  end

  def create_ssot_membership(contact_record)
    membership_type = trust_name.present? ? "trust_entity" : "company_entity"
    ContactCorporateGroupMembership.find_or_create_by!(
      contact_id: contact_record.id,
      company_group_id: company_group_id,
      membership_type: membership_type
    ) do |m|
      m.company_id = id
      m.is_active = status == "active"
    end
  end

  # SSoT: Check if ABN should sync back to Contact
  def should_sync_abn_to_contact?
    # Only sync ABN if we have a linked Contact and we're not already syncing from Contact
    contact_id.present? &&
      abn.present? &&
      !Thread.current[:syncing_contact_to_company]
  end

  # SSoT: Sync ABN back to Contact (two-way sync for ABN only)
  def sync_abn_to_contact
    # Prevent infinite loops
    return if Thread.current[:syncing_company_to_contact]

    Thread.current[:syncing_company_to_contact] = true

    # Strip spaces from ABN before syncing to Contact (Contact stores without formatting)
    contact.update!(tax_number: abn&.gsub(/\s/, ""))
  rescue StandardError => e
    Rails.logger.error("CorporateCompany##{id}: Sync ABN to Contact failed - #{e.message}")
  ensure
    Thread.current[:syncing_company_to_contact] = false
  end
end
