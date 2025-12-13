class Job < ApplicationRecord
  # Explicitly set table name since it was renamed from 'constructions' to 'jobs'
  self.table_name = "jobs"

  # BPMN Workflow Triggers - fires when job status changes
  include BpmnTriggerable
  bpmn_status_trigger :job_status_id

  # SSoT: Standard includes - define once, use everywhere
  # Use Job.with_lookups for list views, Job.with_contacts for detail views
  scope :with_lookups, -> { includes(:job_type, :job_status, :job_stage) }
  scope :with_contacts, -> { includes(:job_type, :job_status, :job_stage, job_contacts: :contact) }

  # Associations
  has_many :purchase_orders, dependent: :destroy
  has_many :job_claims, dependent: :destroy
  has_many :schedule_tasks, dependent: :destroy
  has_one :project, dependent: :destroy
  has_one :one_drive_credential, dependent: :destroy
  belongs_to :design, optional: true
  belongs_to :job_type, optional: true
  belongs_to :job_status, optional: true
  belongs_to :job_stage, optional: true
  has_many :chat_messages, dependent: :nullify
  has_many :emails, dependent: :nullify
  has_many :job_documentation_tabs, dependent: :destroy
  has_many :document_tasks, dependent: :destroy
  has_many :job_contacts, dependent: :destroy
  has_many :contacts, through: :job_contacts
  has_many :rain_logs, dependent: :destroy
  has_many :external_invoices, dependent: :nullify
  has_many :job_documents, dependent: :destroy

  # SM Gantt associations (Schedule Master v2)
  has_many :sm_tasks, dependent: :destroy
  has_many :sm_rollover_logs, dependent: :destroy

  # Activity tracking
  has_many :job_activities, dependent: :destroy

  # Email proposals
  has_one :email_job_proposal, dependent: :nullify

  # Enums
  enum :onedrive_folder_creation_status, {
    not_requested: "not_requested",
    pending: "pending",
    processing: "processing",
    completed: "completed",
    failed: "failed"
  }, prefix: :folders, default: :not_requested

  # Alias title to name for backwards compatibility
  # Many parts of the codebase reference job.title but the column is 'name'
  alias_attribute :title, :name

  # Address method for backwards compatibility
  # Combines address components into a single string (same as name)
  def address
    name
  end

  # Status method for backwards compatibility (used in document templates)
  # Returns the job_status name
  def status
    job_status&.name
  end

  # Job number for document templates (uses ID with padding)
  def job_number
    id&.to_s&.rjust(4, "0")
  end

  # Description placeholder for document templates
  def description
    nil
  end

  # Validations
  validates :name, presence: true
  validates :site_supervisor_name, presence: true, unless: -> { imported_from_xero? || enquiry_status? }
  validates :suburb, presence: true, if: :has_address_components?
  validates :state, presence: true, if: :has_address_components?
  validates :postcode, length: { is: 4 }, allow_blank: true, if: -> { postcode.present? }
  validate :at_least_lot_or_street_number, if: :has_address_components?
  # TODO: Re-enable once jobs have contacts assigned
  # validate :must_have_at_least_one_contact, on: :update
  validate :stage_must_be_valid_for_type_and_status

  # Check if job is in Enquiry status (relaxed validations for leads/proposals)
  def enquiry_status?
    job_status&.name == "Enquiry"
  end

  # Callbacks
  before_validation :normalize_postcode
  before_validation :auto_generate_name, if: :should_generate_name?
  before_validation :ensure_name_present
  before_validation :auto_generate_council, if: :should_generate_council?
  after_create :create_documentation_tabs_from_categories
  after_create :queue_onedrive_folder_creation
  after_create :log_job_created
  before_update :track_status_and_stage_changes
  after_update :log_status_and_stage_changes

  # Scopes
  scope :active, -> { joins(:job_status).where(job_status: { name: "Active Job" }) }

  # Archival scopes (Sprint 8: Scale Preparation)
  scope :archived, -> { where.not(archived_at: nil) }
  scope :not_archived, -> { where(archived_at: nil) }
  scope :archivable, -> {
    # Jobs that are completed/cancelled and haven't been modified in 90+ days
    joins(:job_status)
      .where(job_status: { name: [ "Completed", "Cancelled", "Archived" ] })
      .where("jobs.updated_at < ?", 90.days.ago)
      .where(archived_at: nil)
  }

  # Methods
  def create_project!(project_manager:, project_name: nil)
    create_project(
      name: project_name || "#{name} - Master Schedule",
      project_code: "PROJ-#{id}",
      project_manager: project_manager,
      status: "planning",
      start_date: CorporateCompanySetting.today
    )
  end

  def schedule_ready?
    purchase_orders.for_schedule.any?
  end

  # Calculate live profit ex-GST: (contract_value - PO totals) / 1.1
  def calculate_live_profit
    contract = contract_value || 0
    po_total = purchase_orders.sum(:total) || 0
    ((contract - po_total) / 1.1).round(2)
  end

  # Calculate profit percentage
  def calculate_profit_percentage
    return 0 if contract_value.nil? || contract_value.zero?
    ((calculate_live_profit / contract_value) * 100).round(2)
  end

  # Update live_profit and profit_percentage fields in database
  def calculate_and_update_profit!
    update_columns(
      live_profit: calculate_live_profit,
      profit_percentage: calculate_profit_percentage
    )
  end

  # Override getters to always return calculated values
  # This ensures values are always fresh even if DB is stale
  def live_profit
    calculate_live_profit
  end

  def profit_percentage
    calculate_profit_percentage
  end

  # Site supervisor info for prepopulating POs
  def site_supervisor_info
    {
      name: site_supervisor_name,
      phone: site_supervisor_phone
    }
  end

  # Check if OneDrive folders have not been requested yet
  def folders_not_requested?
    onedrive_folder_creation_status == "not_requested"
  end

  # Trigger OneDrive folder creation if not already created
  def create_folders_if_needed!(template_id = nil)
    return unless folders_not_requested?

    update!(onedrive_folder_creation_status: "pending")
    CreateJobFoldersJob.perform_later(id, template_id)
  end

  # Get primary contact
  def primary_contact
    job_contacts.primary.first&.contact
  end

  # Get client contact (from invoices)
  def client
    job_contacts.find_by(role: "client")&.contact
  end

  # Link client from invoice contacts
  def link_client_from_invoices!
    JobClientLinkerService.new.link_client_to_job(self)
  end

  # Get all contacts with their relationship info
  def contacts_with_details
    job_contacts.includes(contact: :outgoing_relationships).map do |cc|
      {
        id: cc.id,
        contact_id: cc.contact_id,
        primary: cc.primary,
        role: cc.role,
        contact: cc.contact,
        relationships_count: cc.contact.outgoing_relationships.count
      }
    end
  end

  # Check if job was imported from Xero (has tracking option linked)
  def imported_from_xero?
    xero_tracking_option_id.present?
  end

  # ============================================
  # Archival Methods (Sprint 8: Scale Preparation)
  # ============================================

  def archived?
    archived_at.present?
  end

  def archive!(reason: nil, user: nil)
    return false if archived?

    update!(
      archived_at: Time.current,
      archive_reason: reason,
      archived_by_id: user&.id
    )
    true
  end

  def unarchive!
    return false unless archived?

    update!(
      archived_at: nil,
      archive_reason: nil,
      archived_by_id: nil
    )
    true
  end

  # Check if job can be archived (has no recent activity)
  def can_archive?
    return false if archived?

    # Must be in a terminal status
    return false unless job_status&.name.in?([ "Completed", "Cancelled", "Archived" ])

    # Must have no recent activity (90 days)
    updated_at < 90.days.ago
  end

  # Auto-generate job name from address components
  # Format: "Lot X (Y) Street Name Type Suburb Postcode State"
  # or:     "Lot X Street Name Type Suburb Postcode State"
  # or:     "Y Street Name Type Suburb Postcode State"
  # If no address components, generate placeholder: "New Job #{id}"
  def auto_generate_name
    parts = []

    # Lot number and street number (house number in parentheses)
    if lot_number.present? && street_number.present?
      parts << "Lot #{lot_number} (#{street_number})"
    elsif lot_number.present?
      parts << "Lot #{lot_number}"
    elsif street_number.present?
      parts << street_number
    end

    # Street name and type
    parts << street_name if street_name.present?
    parts << street_type if street_type.present?

    # Suburb
    parts << suburb if suburb.present?

    # Postcode
    parts << postcode if postcode.present?

    # State (abbreviated)
    parts << abbreviate_state(state) if state.present?

    if parts.any?
      self.name = parts.join(" ")
    elsif new_record?
      # Generate placeholder for new records without address
      self.name = "New Job (Pending Address)"
    end
  end

  # Auto-generate council from postcode/suburb
  def auto_generate_council
    council_name = CouncilLookupService.find_council(
      postcode: postcode,
      suburb: suburb
    )
    self.council = council_name if council_name.present?
  end

  # Check if job has any address components
  # Returns true only if we have a meaningful address (street_name is key indicator)
  def has_address_components?
    street_name.present?
  end

  # Check if we should generate name (new record or address changed)
  def should_generate_name?
    new_record? || address_components_changed?
  end

  # Check if we should generate council (new record with postcode/suburb or those fields changed)
  def should_generate_council?
    (new_record? && (postcode.present? || suburb.present?)) || postcode_or_suburb_changed?
  end

  # Check if address components have changed
  def address_components_changed?
    lot_number_changed? || street_number_changed? ||
      street_name_changed? || street_type_changed? ||
      suburb_changed? || state_changed?
  end

  # Check if postcode or suburb changed
  def postcode_or_suburb_changed?
    postcode_changed? || suburb_changed?
  end

  # Abbreviate Australian state names
  def abbreviate_state(state_value)
    return nil if state_value.blank?
    state_map = {
      "queensland" => "QLD",
      "new south wales" => "NSW",
      "victoria" => "VIC",
      "south australia" => "SA",
      "western australia" => "WA",
      "tasmania" => "TAS",
      "northern territory" => "NT",
      "australian capital territory" => "ACT"
    }
    state_map[state_value.downcase] || state_value.upcase
  end

  private

  # Normalize postcode: strip whitespace and clear invalid ones
  # Australian postcodes must be exactly 4 digits
  def normalize_postcode
    return if postcode.blank?

    # Strip whitespace
    self.postcode = postcode.to_s.strip

    # If postcode is not exactly 4 digits, clear it to allow auto-generation
    # This handles partial postcodes from location pickers
    unless postcode.match?(/\A\d{4}\z/)
      self.postcode = nil
    end
  end

  # Ensure name is always present - fallback safety net
  def ensure_name_present
    return if name.present?

    # Generate a placeholder name if still blank after auto_generate_name
    self.name = if new_record?
      "New Job (Pending Address)"
    else
      "Job ##{id}"
    end
  end

  def must_have_at_least_one_contact
    if job_contacts.empty?
      errors.add(:base, "Job must have at least one contact")
    end
  end

  def at_least_lot_or_street_number
    if lot_number.blank? && street_number.blank?
      errors.add(:base, "Must have either lot number or street number")
    end
  end

  # Create job-specific documentation tabs from global categories
  def create_documentation_tabs_from_categories
    DocumentationCategory.active.ordered.each do |category|
      job_documentation_tabs.create!(
        name: category.name,
        icon: category.icon,
        color: category.color,
        description: category.description,
        sequence_order: category.sequence_order,
        is_active: true
      )
    end
  end

  # Validate stage is valid for current type+status
  def stage_must_be_valid_for_type_and_status
    return if job_stage_id.nil?
    return if job_type_id.nil? || job_status_id.nil?

    valid_stage = JobStatusStage.exists?(
      job_type_id: job_type_id,
      job_status_id: job_status_id,
      job_stage_id: job_stage_id
    )

    unless valid_stage
      errors.add(:job_stage, "is not valid for this job type and status")
    end
  end

  # Queue OneDrive folder creation after job is created
  def queue_onedrive_folder_creation
    # Only create folders if OneDrive is connected
    credential = OrganizationOneDriveCredential.active_credential
    return unless credential&.valid_credential?

    # Queue the folder creation job (runs in background)
    CreateJobOnedriveFoldersJob.perform_later(id)
    update_column(:onedrive_folder_creation_status, "pending")
  rescue StandardError => e
    Rails.logger.error "Failed to queue OneDrive folder creation for job #{id}: #{e.message}"
  end

  # Activity logging callbacks
  def log_job_created
    JobActivity.log_job_created(self, user: Current.user)
  rescue StandardError => e
    Rails.logger.error "Failed to log job creation activity: #{e.message}"
  end

  def track_status_and_stage_changes
    @status_was = job_status&.name if job_status_id_changed?
    @stage_was = job_stage&.name if job_stage_id_changed?
  end

  def log_status_and_stage_changes
    if saved_change_to_job_status_id? && @status_was.present?
      new_status = job_status&.name
      JobActivity.log_status_change(self, old_status: @status_was, new_status: new_status, user: Current.user)
    end

    if saved_change_to_job_stage_id?
      new_stage = job_stage&.name
      JobActivity.log_stage_change(self, old_stage: @stage_was, new_stage: new_stage, user: Current.user)
    end
  rescue StandardError => e
    Rails.logger.error "Failed to log status/stage change activity: #{e.message}"
  end
end
