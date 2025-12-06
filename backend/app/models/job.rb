class Job < ApplicationRecord
  # Explicitly set table name since it was renamed from 'constructions' to 'jobs'
  self.table_name = "jobs"

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

  # Validations
  validates :title, presence: true
  validates :site_supervisor_name, presence: true, unless: -> { imported_from_xero? || enquiry_status? }
  # TODO: Re-enable once jobs have contacts assigned
  # validate :must_have_at_least_one_contact, on: :update
  validate :stage_must_be_valid_for_type_and_status

  # Check if job is in Enquiry status (relaxed validations for leads/proposals)
  def enquiry_status?
    job_status&.name == "Enquiry"
  end

  # Callbacks
  after_create :create_documentation_tabs_from_categories
  after_create :queue_onedrive_folder_creation
  after_create :log_job_created
  before_update :track_status_and_stage_changes
  after_update :log_status_and_stage_changes

  # Scopes
  scope :active, -> { joins(:job_status).where(job_statuses: { name: "Active Job" }) }

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
  def create_project!(project_manager:, name: nil)
    create_project(
      name: name || "#{title} - Master Schedule",
      project_code: "PROJ-#{id}",
      project_manager: project_manager,
      status: "planning",
      start_date: CompanySetting.today
    )
  end

  def schedule_ready?
    purchase_orders.for_schedule.any?
  end

  # Calculate live profit based on contract value minus all PO totals
  def calculate_live_profit
    contract = contract_value || 0
    po_total = purchase_orders.sum(:total) || 0
    contract - po_total
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
      email: site_supervisor_email,
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

  private

  def must_have_at_least_one_contact
    if job_contacts.empty?
      errors.add(:base, "Job must have at least one contact")
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
