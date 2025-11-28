class Company < ApplicationRecord
  # Associations
  belongs_to :company_group, optional: true

  has_many :company_directors, dependent: :destroy
  has_many :directors, through: :company_directors, source: :contact
  has_many :current_directors, -> { where(company_directors: { is_current: true }) },
           through: :company_directors, source: :contact

  has_many :bank_accounts, dependent: :destroy
  has_many :active_bank_accounts, -> { where(status: 'active') }, class_name: 'BankAccount'

  has_many :assets, dependent: :destroy
  has_many :active_assets, -> { where(status: 'active') }, class_name: 'Asset'

  has_many :company_compliance_items, dependent: :destroy
  has_many :pending_compliance_items, -> { where(status: 'pending') }, class_name: 'CompanyComplianceItem'

  has_many :company_documents, dependent: :destroy
  has_many :company_activities, dependent: :destroy
  has_one :company_xero_connection, dependent: :destroy

  # New corporate associations
  has_many :company_shareholdings, dependent: :destroy
  has_many :shareholders, through: :company_shareholdings, source: :shareholder
  has_many :share_transfers, dependent: :destroy
  has_many :dividends, dependent: :destroy
  has_many :company_minutes, dependent: :destroy
  has_many :loans_as_lender, class_name: 'CompanyLoan', foreign_key: 'lender_company_id', dependent: :destroy
  has_many :loans_as_borrower, class_name: 'CompanyLoan', foreign_key: 'borrower_company_id', dependent: :destroy

  # Encrypted attributes
  encrypts :tfn, deterministic: true
  encrypts :encrypted_asic_password
  encrypts :encrypted_recovery_answer

  # Validations
  validates :name, presence: true
  validates :acn, uniqueness: { allow_blank: true }, format: { with: /\A\d{9}\z/, message: "must be 9 digits", allow_blank: true }
  validates :abn, uniqueness: { allow_blank: true }, format: { with: /\A\d{11}\z/, message: "must be 11 digits", allow_blank: true }
  validates :status, inclusion: { in: %w[active struck_off in_liquidation dormant] }
  # Legacy company_group validation - now using company_group_id relation
  # validates :company_group, inclusion: { in: %w[tekna team_harder promise charity other] }, allow_blank: true
  validates :gst_registration_status, inclusion: { in: %w[registered not_registered] }, allow_blank: true
  validates :accounting_method, inclusion: { in: %w[cash accrual] }, allow_blank: true

  # Scopes
  scope :active, -> { where(status: 'active') }
  scope :by_group, ->(group) { where(company_group: group) }
  scope :with_xero, -> { joins(:company_xero_connection).where(company_xero_connections: { connection_status: 'connected' }) }
  scope :compliance_due_soon, -> {
    joins(:company_compliance_items)
      .where('company_compliance_items.due_date BETWEEN ? AND ?', Date.today, 90.days.from_now)
      .where(company_compliance_items: { status: 'pending' })
      .distinct
  }

  # Callbacks
  after_create :create_initial_activity
  after_update :create_update_activity

  # Instance methods
  def display_name
    name
  end

  def formatted_acn
    return nil unless acn.present?
    # Format as XXX XXX XXX
    acn.scan(/.{1,3}/).join(' ')
  end

  def formatted_abn
    return nil unless abn.present?
    # Format as XX XXX XXX XXX
    "#{abn[0..1]} #{abn[2..4]} #{abn[5..7]} #{abn[8..10]}"
  end

  def active?
    status == 'active'
  end

  def has_xero_connection?
    company_xero_connection.present? && company_xero_connection.connection_status == 'connected'
  end

  def overdue_compliance_items
    company_compliance_items.where('due_date < ? AND status = ?', Date.today, 'pending')
  end

  def upcoming_compliance_items(days = 30)
    company_compliance_items.where(
      'due_date BETWEEN ? AND ? AND status = ?',
      Date.today,
      days.days.from_now,
      'pending'
    ).order(:due_date)
  end

  def total_asset_value
    assets.where(status: 'active').sum(:current_book_value) || 0
  end

  # All loans (as lender or borrower)
  def all_loans
    CompanyLoan.where('lender_company_id = ? OR borrower_company_id = ?', id, id)
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
    company_group&.name || company_group_legacy
  end

  # Legacy company_group field (string) - for backwards compatibility
  def company_group_legacy
    read_attribute(:company_group)
  end

  private

  def create_initial_activity
    user = defined?(Current) && Current.respond_to?(:user) ? Current.user : nil
    user ||= User.first

    company_activities.create!(
      activity_type: 'company_created',
      description: "Company #{name} was created",
      user: user
    )
  end

  def create_update_activity
    return unless saved_changes.any?

    user = defined?(Current) && Current.respond_to?(:user) ? Current.user : nil
    user ||= User.first

    company_activities.create!(
      activity_type: 'company_updated',
      description: "Company information was updated",
      user: user,
      change_details: saved_changes.except('updated_at')
    )
  end
end
