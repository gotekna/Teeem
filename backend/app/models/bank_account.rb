class BankAccount < ApplicationRecord
  # Bank code mapping for standardized naming
  BANK_CODES = {
    "nab" => "NAB",
    "national australia" => "NAB",
    "westpac" => "WBC",
    "wbc" => "WBC",
    "boq" => "BOQ",
    "bank of queensland" => "BOQ",
    "commonwealth" => "CBA",
    "commbank" => "CBA",
    "cba" => "CBA",
    "anz" => "ANZ",
    "stripe" => "STRIPE",
    "simple saver" => "SS"
  }.freeze

  # Associations
  belongs_to :corporate_company, foreign_key: "company_id"
  has_many :bank_transactions, dependent: :nullify

  # Validations
  validates :institution_name, presence: true
  validates :bsb, format: { with: /\A\d{6}\z/, message: "must be 6 digits", allow_blank: true }
  validates :account_number, presence: true
  validates :status, inclusion: { in: %w[active closed] }
  validate :date_closed_after_opened

  # Callbacks - auto-detect bank_code from institution_name
  before_save :detect_bank_code, if: -> { bank_code.blank? && institution_name.present? }

  # Scopes
  scope :active, -> { where(status: "active") }
  scope :closed, -> { where(status: "closed") }
  scope :by_institution, ->(institution) { where(institution_name: institution) }
  scope :by_bank_code, ->(code) { where(bank_code: code.upcase) }
  scope :linked_to_xero, -> { where.not(xero_account_id: nil) }

  # Callbacks
  after_create :create_activity
  after_update :create_update_activity, if: :saved_change_to_status?

  # Instance methods
  def formatted_bsb
    return nil unless bsb.present?
    # Format as XXX-XXX
    "#{bsb[0..2]}-#{bsb[3..5]}"
  end

  def display_name
    "#{institution_name} - #{masked_account_number}"
  end

  def masked_account_number
    return nil unless account_number.present?
    # Show last 4 digits only
    "****#{account_number.last(4)}"
  end

  def active?
    status == "active"
  end

  def linked_to_xero?
    xero_account_id.present?
  end

  def last_transaction_date
    bank_transactions.maximum(:transaction_date)
  end

  def first_transaction_date
    bank_transactions.minimum(:transaction_date)
  end

  def link_to_xero!(xero_account_id)
    update!(xero_account_id: xero_account_id)
  end

  def unlink_from_xero!
    update!(xero_account_id: nil)
  end

  private

  def date_closed_after_opened
    return unless date_opened.present? && date_closed.present?
    if date_closed < date_opened
      errors.add(:date_closed, "cannot be before date opened")
    end
  end

  def create_activity
    user = defined?(Current) && Current.respond_to?(:user) ? Current.user : nil
    corporate_company.corporate_company_activities.create!(
      activity_type: "bank_account_added",
      description: "Bank account added: #{display_name}",
      change_details: { bank_account_id: id, institution: institution_name },
      user: user || User.first
    )
  end

  def create_update_activity
    if status == "closed"
      user = defined?(Current) && Current.respond_to?(:user) ? Current.user : nil
      corporate_company.corporate_company_activities.create!(
        activity_type: "bank_account_closed",
        description: "Bank account closed: #{display_name}",
        change_details: { bank_account_id: id, date_closed: date_closed },
        user: user || User.first
      )
    end
  end

  def detect_bank_code
    name = institution_name.to_s.downcase
    BANK_CODES.each do |pattern, code|
      if name.include?(pattern)
        self.bank_code = code
        return
      end
    end
    self.bank_code = "OTHER"
  end
end
