class Job < ApplicationRecord
  # Explicitly set table name since it was renamed from 'constructions' to 'jobs'
  self.table_name = "jobs"

  # =============================================================================
  # SSoT: contract_price is THE ONE for total contract price
  # See: TEEEM_DOCS/SSOT_CONTRACT_VALUE_MIGRATION.md
  # =============================================================================

  # BPMN Workflow Triggers - fires when job status changes
  include BpmnTriggerable
  include Searchable

  # Searchable columns for full-text search (GIN index)
  searchable_columns :name, :location, :suburb, :street_name
  bpmn_status_trigger :job_status_id

  # SSoT: Standard includes - define once, use everywhere
  # Use Job.with_lookups for list views, Job.with_contacts for detail views
  scope :with_lookups, -> { includes(:job_type, :job_status, :job_stage) }
  scope :with_contacts, -> { includes(:job_type, :job_status, :job_stage, job_contacts: :contact) }

  # Associations
  has_many :purchase_orders, dependent: :destroy
  has_many :job_claims, dependent: :destroy
  has_many :job_claim_stages, dependent: :destroy
  # Note: schedule_tasks association removed in Phase 6 - SmTask is THE ONE task system (see sm_tasks)
  has_one :project, dependent: :destroy
  has_one :one_drive_credential, dependent: :destroy
  belongs_to :design, optional: true
  belongs_to :job_type, optional: true
  belongs_to :job_status, optional: true
  belongs_to :job_stage, optional: true
  has_many :chat_messages, dependent: :nullify
  has_many :emails, dependent: :nullify
  has_many :document_tasks, dependent: :destroy
  has_many :job_contacts, dependent: :destroy
  has_many :contacts, through: :job_contacts
  has_many :job_specifications, dependent: :destroy
  has_many :job_colour_selections, dependent: :destroy
  has_many :unreal_measurements, dependent: :destroy
  has_many :rain_logs, dependent: :destroy
  has_many :external_invoices, dependent: :nullify
  has_many :job_documents, dependent: :destroy

  # Plans (new plans tab with revision tracking)
  has_many :job_plan_tabs, dependent: :destroy
  has_many :job_plans, dependent: :destroy
  has_many :plan_uploads, dependent: :destroy
  has_many :plan_reextractions, dependent: :destroy
  has_many :batch_operations, dependent: :destroy

  # SM Gantt associations (Schedule Master v2)
  has_many :sm_tasks, dependent: :destroy
  has_many :sm_rollover_logs, dependent: :destroy

  # Site Presence & Cost Intelligence
  has_many :site_presence_sessions, dependent: :destroy
  has_many :labour_cost_entries, dependent: :destroy
  has_one :job_cost_budget, dependent: :destroy
  belongs_to :cost_centre, optional: true

  # Activity tracking
  has_many :job_activities, dependent: :destroy

  # Quantity variables (for recipe calculations)
  has_many :job_quantity_variables, dependent: :destroy

  # Recipes applied to this job (for BOQ)
  has_many :job_recipes, dependent: :destroy
  has_many :recipes, through: :job_recipes

  # Email proposals
  has_one :email_job_proposal, dependent: :nullify

  # Enums
  enum :sharepoint_folder_status, {
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
    # If association is loaded, use it directly
    if job_status.present?
      return job_status.name == "Enquiry"
    end

    # During creation, association may not be loaded yet - look up by ID
    if job_status_id.blank?
      Rails.logger.info "[Job#enquiry_status?] job_status_id is blank, returning false"
      return false
    end

    status = JobStatus.find_by(id: job_status_id)
    is_enquiry = status&.name == "Enquiry"
    Rails.logger.info "[Job#enquiry_status?] job_status_id=#{job_status_id}, status_name=#{status&.name}, is_enquiry=#{is_enquiry}"
    is_enquiry
  end

  # Callbacks
  before_validation :normalize_postcode
  before_validation :auto_generate_name, if: :should_generate_name?
  before_validation :ensure_name_present
  before_validation :auto_generate_council, if: :should_generate_council?
  after_create :log_job_created
  after_create :create_claim_stages_from_template
  after_create :apply_schedule_template_from_job_type
  after_commit :sync_xero_tracking_option, on: :create
  before_update :track_status_and_stage_changes
  after_update :log_status_and_stage_changes
  # Performance: Maintain JobAddressSearch for fast email matching
  after_save :update_address_search_terms, if: :saved_change_to_name_or_title?
  after_destroy :clear_address_search_terms

  # Email matching association
  has_many :job_address_searches, dependent: :destroy

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

  # Calculate live profit ex-GST: (contract_price - PO totals) / 1.1
  # SSoT: contract_price is THE ONE
  def calculate_live_profit
    contract = contract_price || 0
    po_total = purchase_orders.sum(:total) || 0
    ((contract - po_total) / 1.1).round(2)
  end

  # Calculate profit percentage
  # SSoT: contract_price is THE ONE
  def calculate_profit_percentage
    return 0 if contract_price.nil? || contract_price.zero?
    ((calculate_live_profit / contract_price) * 100).round(2)
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

  # Check if SharePoint folders have not been requested yet
  def folders_not_requested?
    sharepoint_folder_status == "not_requested"
  end

  # Trigger SharePoint folder creation if not already created
  def create_folders_if_needed!(template_id = nil)
    return unless folders_not_requested?

    update!(sharepoint_folder_status: "pending")
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

  # Get all quantity variable values as a hash (for recipe calculations)
  # Returns { variable_name => typed_value } including defaults for missing values
  def quantity_variable_values
    # Start with all system variables and their defaults
    values = QuantityVariable.all.index_by(&:variable_name).transform_values(&:typed_default)

    # Override with job-specific values
    job_quantity_variables.includes(:quantity_variable).each do |jqv|
      values[jqv.quantity_variable.variable_name] = jqv.typed_value
    end

    # Calculate computed variables
    QuantityVariable.where(is_computed: true).each do |var|
      values[var.variable_name] = var.calculate(values)
    end

    values
  end

  # Alias for recipe calculations
  alias_method :quantity_variables_hash, :quantity_variable_values

  # Set a quantity variable value
  def set_quantity_variable(variable_name, value, updated_by: nil)
    var = QuantityVariable.find_by!(variable_name: variable_name)
    jqv = job_quantity_variables.find_or_initialize_by(quantity_variable: var)
    jqv.value = value.to_s
    jqv.updated_by = updated_by
    jqv.save!
  end

  # Initialize claim stages from template for this job's type
  def initialize_claim_stages_from_template!
    return unless job_type_id.present?

    templates = ClaimStageTemplate.where(job_type_id: job_type_id).active.ordered
    return if templates.empty?

    transaction do
      job_claim_stages.destroy_all  # Clear existing stages

      templates.each do |template|
        # SSoT: contract_price is THE ONE
        expected = if contract_price.present? && template.percentage.present?
                     (contract_price.to_d * template.percentage / 100).round(2)
                   end

        job_claim_stages.create!(
          claim_stage_template: template,
          name: template.name,
          percentage: template.percentage,
          expected_amount: expected,
          sequence_order: template.sequence_order,
          description: template.description,
          is_custom: false
        )
      end
    end
  end

  # Recalculate expected amounts based on current contract price
  # SSoT: contract_price is THE ONE
  def recalculate_claim_stage_amounts!
    return unless contract_price.present?

    job_claim_stages.each do |stage|
      next unless stage.percentage.present?
      stage.update!(expected_amount: (contract_price.to_d * stage.percentage / 100).round(2))
    end
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
  # Schedule Template Methods
  # ============================================

  # Get the template used for this job's schedule
  def schedule_template
    job_type&.sm_schedule_master_template
  end

  # Check if a newer template version is available (versioning removed)
  def schedule_upgrade_available?
    false
  end

  # Get the default template for this job's type
  def default_schedule_template
    job_type&.sm_schedule_master_template
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
    # If no lot_number, don't show "Lot" at all
    # If street_number is missing/0, show "-" to indicate it's missing
    has_lot = lot_number.present?
    has_street_num = street_number.present? && street_number.to_s.strip != "0"

    if has_lot
      # Always show street number in parens - use "-" if missing
      street_display = has_street_num ? street_number : "-"
      parts << "Lot #{lot_number} (#{street_display})"
    elsif has_street_num
      # No lot number - just show street number
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

  # Queue SharePoint folder creation after job is created
  def queue_sharepoint_folder_creation
    # Only create folders if SharePoint is connected
    # SSoT: Use MicrosoftCredential
    credential = MicrosoftCredential.sharepoint_credential
    return unless credential&.valid_credential?

    # Queue the folder creation job (runs in background)
    CreateJobSharepointFoldersJob.perform_later(id)
    update_column(:sharepoint_folder_status, "pending")
  rescue StandardError => e
    Rails.logger.error "Failed to queue SharePoint folder creation for job #{id}: #{e.message}"
  end

  # Activity logging callbacks
  def log_job_created
    JobActivity.log_job_created(self, user: Current.user)
  rescue StandardError => e
    Rails.logger.error "Failed to log job creation activity: #{e.message}"
  end

  def sync_xero_tracking_option
    # Skip if already linked to Xero
    return if xero_tracking_option_id.present?

    # Skip if job is imported from Xero (already has tracking)
    return if imported_from_xero?

    # Create tracking option in Xero in background
    XeroTrackingSyncJob.perform_later(id)
  rescue StandardError => e
    Rails.logger.error "Failed to queue Xero tracking sync for job ##{id}: #{e.message}"
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

  # Auto-create claim stages from template when job is created
  def create_claim_stages_from_template
    return unless job_type_id.present?

    templates = ClaimStageTemplate.where(job_type_id: job_type_id).active.ordered
    return if templates.empty?

    templates.each do |template|
      # SSoT: contract_price is THE ONE
      expected = if contract_price.present? && template.percentage.present?
                   (contract_price.to_d * template.percentage / 100).round(2)
                 end

      job_claim_stages.create!(
        claim_stage_template: template,
        name: template.name,
        percentage: template.percentage,
        expected_amount: expected,
        sequence_order: template.sequence_order,
        description: template.description,
        is_custom: false
      )
    end
  rescue StandardError => e
    Rails.logger.error "Failed to create claim stages from template for job ##{id}: #{e.message}"
  end

  # Auto-apply schedule template from job type when job is created
  # Applies the schedule template from the job type
  def apply_schedule_template_from_job_type
    return unless job_type.present?
    return unless job_type.has_schedule_template?

    template = job_type.sm_schedule_master_template
    return unless template.present?

    # Use the copy service to apply the template
    result = SmScheduleMasterTemplateCopyService.new(template, self, {
      start_date: start_date || Date.current,
      user: nil, # System-initiated, no user context
      clear_existing: false,
      create_purchase_orders: false # Don't auto-create POs on job creation
    }).execute

    if result[:success]
      # Record when template was applied
      update_columns(template_applied_at: Time.current)
      Rails.logger.info "[Job##{id}] Applied schedule template '#{template.name}' (#{result[:tasks_created]} tasks)"
    else
      Rails.logger.error "[Job##{id}] Failed to apply schedule template: #{result[:errors].join(', ')}"
    end
  rescue StandardError => e
    Rails.logger.error "[Job##{id}] Failed to apply schedule template: #{e.message}"
    Rails.logger.error e.backtrace.first(5).join("\n")
  end

  # Performance: Check if name or title changed (for address search update)
  def saved_change_to_name_or_title?
    saved_change_to_name? || (respond_to?(:saved_change_to_title?) && saved_change_to_title?)
  end

  # Performance: Update JobAddressSearch terms for fast email-to-job matching
  # Part of 6-month email performance masterpiece plan
  def update_address_search_terms
    return unless JobAddressSearch.table_exists?

    # Clear existing terms
    job_address_searches.destroy_all

    terms = []

    # Job number (exact match)
    if job_number.present?
      terms << { term: job_number.to_s.downcase, type: 'job_number' }
    end

    # Full address from name field
    if name.present?
      terms << { term: name.downcase.strip, type: 'full_address' }

      # Extract street name (e.g., "32 Mcilwraith Street" -> "mcilwraith")
      street_match = name.match(/\d+\s+(.+?)\s+(Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Court|Ct|Place|Pl|Crescent|Cres|Boulevard|Blvd|Lane|Ln|Way|Terrace|Tce|Circuit|Cct|Close|Cl)/i)
      if street_match
        terms << { term: street_match[1].downcase.strip, type: 'street_name' }
      end
    end

    # Create new terms
    terms.each do |term|
      job_address_searches.create!(
        search_term: term[:term],
        term_type: term[:type]
      )
    end
  rescue StandardError => e
    Rails.logger.error "Failed to update address search terms for job ##{id}: #{e.message}"
  end

  # Performance: Clear address search terms when job is deleted
  def clear_address_search_terms
    job_address_searches.destroy_all if JobAddressSearch.table_exists?
  rescue StandardError => e
    Rails.logger.error "Failed to clear address search terms for job ##{id}: #{e.message}"
  end
end
