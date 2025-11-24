class Construction < ApplicationRecord
  # Associations
  has_many :purchase_orders, dependent: :destroy
  has_many :schedule_tasks, dependent: :destroy
  has_one :project, dependent: :destroy
  has_one :one_drive_credential, dependent: :destroy
  belongs_to :design, optional: true
  has_many :chat_messages, dependent: :nullify
  has_many :emails, dependent: :nullify
  has_many :construction_documentation_tabs, dependent: :destroy
  has_many :construction_contacts, dependent: :destroy
  has_many :contacts, through: :construction_contacts
  has_many :rain_logs, dependent: :destroy

  # SM Gantt associations (Schedule Master v2)
  has_many :sm_tasks, dependent: :destroy
  has_many :sm_rollover_logs, dependent: :destroy

  # Enums
  enum :onedrive_folder_creation_status, {
    not_requested: 'not_requested',
    pending: 'pending',
    processing: 'processing',
    completed: 'completed',
    failed: 'failed'
  }, prefix: :folders, default: :not_requested

  # Validations
  validates :title, presence: true
  validates :status, presence: true
  validates :site_supervisor_name, presence: true
  validate :must_have_at_least_one_contact, on: :update

  # Callbacks
  after_create :create_documentation_tabs_from_categories

  # Scopes
  scope :active, -> { where(status: 'Active') }

  # Methods
  def create_project!(project_manager:, name: nil)
    create_project(
      name: name || "#{title} - Master Schedule",
      project_code: "PROJ-#{id}",
      project_manager: project_manager,
      status: 'planning',
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
    onedrive_folder_creation_status == 'not_requested'
  end

  # Trigger OneDrive folder creation if not already created
  def create_folders_if_needed!(template_id = nil)
    return unless folders_not_requested?

    update!(onedrive_folder_creation_status: 'pending')
    CreateJobFoldersJob.perform_later(id, template_id)
  end

  # Get primary contact
  def primary_contact
    construction_contacts.primary.first&.contact
  end

  # Get all contacts with their relationship info
  def contacts_with_details
    construction_contacts.includes(contact: :outgoing_relationships).map do |cc|
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

  private

  def must_have_at_least_one_contact
    if construction_contacts.empty?
      errors.add(:base, "Job must have at least one contact")
    end
  end

  # Create job-specific documentation tabs from global categories
  def create_documentation_tabs_from_categories
    DocumentationCategory.active.ordered.each do |category|
      construction_documentation_tabs.create!(
        name: category.name,
        icon: category.icon,
        color: category.color,
        description: category.description,
        sequence_order: category.sequence_order,
        is_active: true
      )
    end
  end
end
